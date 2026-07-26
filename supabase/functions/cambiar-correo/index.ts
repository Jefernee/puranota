// Edge Function: cambiar-correo
// El usuario logueado cambia su PROPIO correo (que es también su usuario de
// inicio de sesión) al instante, sin depender del correo de confirmación.
// Usa la admin API (service_role) con email_confirm:true y refleja el correo
// en la tabla perfiles, para que el correo nuevo quede en todos lados.
//
// Entrada: { correo }
// Seguridad: solo cambia el correo del propio usuario autenticado.
//
// Desplegar: supabase functions deploy cambiar-correo
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

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    const { correo } = await req.json().catch(() => ({}))
    const nuevo = (correo ?? '').trim().toLowerCase()
    if (!RE_CORREO.test(nuevo)) return json({ error: 'El correo no es válido.' }, 400)

    // 1) Sesión del que llama.
    const authHeader = req.headers.get('Authorization') ?? ''
    const comoUsuario = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await comoUsuario.auth.getUser()
    if (!user) return json({ error: 'No autenticado.' }, 401)

    // 2) Cambiar el correo del PROPIO usuario, al instante (sin confirmación).
    //    Llamada directa al endpoint admin para ver el error crudo si falla.
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: nuevo, email_confirm: true }),
    })
    if (!resp.ok) {
      const cuerpo = await resp.text().catch(() => '')
      console.error('admin email update failed', resp.status, cuerpo)
      const dup = /already|registered|exists|duplicate/i.test(cuerpo)
      return json(
        {
          error: dup
            ? 'Ese correo ya está en uso por otra cuenta.'
            : 'No se pudo cambiar el correo. Intentá de nuevo en un momento.',
        },
        400,
      )
    }

    // 3) Reflejar el correo en el perfil (se usa para prematrícula, listas, etc.).
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    await admin.from('perfiles').update({ correo: nuevo }).eq('id', user.id)

    return json({ ok: true, correo: nuevo })
  } catch (e) {
    return json({ error: (e as Error)?.message ?? 'Error al cambiar el correo.' }, 500)
  }
})
