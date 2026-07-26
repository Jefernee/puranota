// Edge Function: resetear-clave-estudiante
// El docente resetea la clave de un estudiante de SUS grupos (respaldo de
// emergencia). Genera una contraseña temporal, la aplica vía admin API y marca
// debe_cambiar_clave para forzar el cambio en el próximo ingreso.
//
// Entrada: { estudianteId }
// Seguridad (todo obligatorio):
//   - quien llama tiene sesión válida
//   - quien llama es docente
//   - el estudiante pertenece a algún grupo de ESE docente
//   - el objetivo es rol 'estudiante'
//
// Desplegar normal (con verificación de JWT):
//   supabase functions deploy resetear-clave-estudiante
// No requiere secrets nuevos (service_role auto-inyectada).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

// Contraseña temporal legible: 8 caracteres sin símbolos ambiguos (0/O, 1/l/I).
function generarTemporal() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => abc[b % abc.length]).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const { estudianteId } = await req.json().catch(() => ({}))
    if (!estudianteId) return json({ error: 'Falta el estudiante.' }, 400)

    // 1) Sesión del que llama.
    const authHeader = req.headers.get('Authorization') ?? ''
    const comoUsuario = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await comoUsuario.auth.getUser()
    if (!user) return json({ error: 'No autenticado.' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // 2) Quien llama es docente.
    const { data: docente } = await admin
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle()
    if (docente?.rol !== 'docente')
      return json({ error: 'Solo un docente puede resetear contraseñas.' }, 403)

    // 3) El estudiante pertenece a algún grupo de ESTE docente.
    const { data: gruposDocente } = await admin
      .from('grupos')
      .select('id')
      .eq('docente_id', user.id)
    const ids = (gruposDocente ?? []).map((g) => g.id)
    if (ids.length === 0)
      return json({ error: 'Ese estudiante no está en tus grupos.' }, 403)

    const { data: matricula } = await admin
      .from('grupo_estudiantes')
      .select('id')
      .eq('estudiante_id', estudianteId)
      .in('grupo_id', ids)
      .limit(1)
      .maybeSingle()
    if (!matricula)
      return json({ error: 'Ese estudiante no está en tus grupos.' }, 403)

    // 4) El objetivo es estudiante.
    const { data: objetivo } = await admin
      .from('perfiles')
      .select('rol')
      .eq('id', estudianteId)
      .maybeSingle()
    if (objetivo?.rol !== 'estudiante')
      return json({ error: 'Solo se puede resetear a un estudiante.' }, 403)

    // 5) Generar, aplicar y forzar cambio.
    const temporal = generarTemporal()
    const { error: errPass } = await admin.auth.admin.updateUserById(estudianteId, {
      password: temporal,
    })
    if (errPass) return json({ error: 'No se pudo cambiar la contraseña.' }, 500)

    await admin
      .from('perfiles')
      .update({ debe_cambiar_clave: true })
      .eq('id', estudianteId)

    return json({ ok: true, contrasenaTemporal: temporal })
  } catch (e) {
    return json({ error: (e as Error)?.message ?? 'Error al resetear.' }, 500)
  }
})
