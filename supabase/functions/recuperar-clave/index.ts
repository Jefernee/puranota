// Edge Function: recuperar-clave
// Pregunta de seguridad para que el estudiante recupere su clave SIN correo.
// Tres acciones (en el body):
//   - { accion: 'definir', pregunta, respuesta }     → requiere sesión (define la pregunta del usuario)
//   - { accion: 'pregunta', correo }                 → anónimo (devuelve solo la pregunta)
//   - { accion: 'restablecer', correo, respuesta, nuevaContrasena } → anónimo (verifica y resetea)
//
// La respuesta NUNCA se guarda en texto plano: se normaliza (minúsculas + trim)
// y se hashea con PBKDF2-SHA256 + salt aleatorio. Formato: pbkdf2$iter$salt$hash.
// Todo el hashing vive acá (única fuente de verdad).
//
// Desplegar SIN verificación de JWT (las acciones anónimas no llevan sesión):
//   supabase functions deploy recuperar-clave --no-verify-jwt
// No requiere secrets nuevos (SUPABASE_URL, SUPABASE_ANON_KEY y
// SUPABASE_SERVICE_ROLE_KEY ya están inyectadas).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ITERACIONES = 100000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// ---------- PBKDF2 ----------
const bytesABase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const base64ABytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const normalizar = (s: string) => (s ?? '').trim().toLowerCase()

async function derivar(respuesta: string, salt: Uint8Array, iter: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(respuesta),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    key,
    256,
  )
  return bytesABase64(new Uint8Array(bits))
}

async function hashearRespuesta(respuesta: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivar(normalizar(respuesta), salt, ITERACIONES)
  return `pbkdf2$${ITERACIONES}$${bytesABase64(salt)}$${hash}`
}

function comparaConstante(a: string, b: string) {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

async function verificarRespuesta(respuesta: string, almacenado: string) {
  const partes = (almacenado || '').split('$')
  if (partes.length !== 4 || partes[0] !== 'pbkdf2') return false
  const iter = Number(partes[1])
  const salt = base64ABytes(partes[2])
  const calc = await derivar(normalizar(respuesta), salt, iter)
  return comparaConstante(calc, partes[3])
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const body = await req.json().catch(() => ({}))
    const accion = body?.accion

    // ----- definir: requiere sesión del propio usuario -----
    if (accion === 'definir') {
      const authHeader = req.headers.get('Authorization') ?? ''
      const comoUsuario = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      })
      const {
        data: { user },
      } = await comoUsuario.auth.getUser()
      if (!user) return json({ error: 'No autenticado.' }, 401)

      const pregunta = (body.pregunta || '').trim()
      const respuesta = (body.respuesta || '').trim()
      if (!pregunta || !respuesta)
        return json({ error: 'Elegí una pregunta y escribí la respuesta.' }, 400)

      const respuesta_hash = await hashearRespuesta(respuesta)
      const { error } = await admin
        .from('perfiles')
        .update({ pregunta_seguridad: pregunta, respuesta_hash })
        .eq('id', user.id)
      if (error) return json({ error: 'No se pudo guardar la pregunta.' }, 500)
      return json({ ok: true })
    }

    // ----- pregunta: anónimo, devuelve solo la pregunta -----
    if (accion === 'pregunta') {
      const correo = normalizar(body.correo)
      if (!correo) return json({ error: 'Escribí tu correo.' }, 400)
      const { data } = await admin
        .from('perfiles')
        .select('pregunta_seguridad')
        .eq('correo', correo)
        .maybeSingle()
      if (!data?.pregunta_seguridad)
        return json(
          { error: 'No encontramos una cuenta con pregunta de seguridad para ese correo.' },
          404,
        )
      return json({ pregunta: data.pregunta_seguridad })
    }

    // ----- restablecer: anónimo, verifica respuesta y resetea -----
    if (accion === 'restablecer') {
      const correo = normalizar(body.correo)
      const respuesta = body.respuesta || ''
      const nueva = body.nuevaContrasena || ''
      if (!correo || !respuesta) return json({ error: 'Faltan datos.' }, 400)
      if (nueva.length < 6)
        return json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' }, 400)

      const { data } = await admin
        .from('perfiles')
        .select('id, respuesta_hash')
        .eq('correo', correo)
        .maybeSingle()
      if (!data?.respuesta_hash)
        return json({ error: 'No se puede recuperar esta cuenta por pregunta.' }, 404)

      const ok = await verificarRespuesta(respuesta, data.respuesta_hash)
      if (!ok) return json({ error: 'La respuesta no coincide.' }, 403)

      const { error } = await admin.auth.admin.updateUserById(data.id, {
        password: nueva,
      })
      if (error) return json({ error: 'No se pudo cambiar la contraseña.' }, 500)
      return json({ ok: true })
    }

    return json({ error: 'Acción no reconocida.' }, 400)
  } catch (e) {
    return json({ error: (e as Error)?.message ?? 'Error en la recuperación.' }, 500)
  }
})
