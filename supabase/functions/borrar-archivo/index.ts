// Edge Function: borrar-archivo
// Limpieza de objetos en Cloudflare R2 cuando se elimina una clase / archivo /
// entrega (la base borra las filas por cascada, pero el objeto físico queda).
//
// Seguridad: solo borra objetos cuya key empieza con `entregas/{user.id}/`, es
// decir, archivos subidos por el PROPIO usuario autenticado. Así nadie puede
// borrar archivos ajenos aunque conozca la URL pública.
//
// Desplegar (verifica JWT, el que llama está logueado):
//   supabase functions deploy borrar-archivo
// Usa los mismos secrets de R2 que `firmar-subida` (ya configurados a nivel
// proyecto): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
// R2_PUBLIC_BASE. El token de R2 debe tener permiso de escritura/borrado.

import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!
const ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!
const SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!
const BUCKET = Deno.env.get('R2_BUCKET')!
const PUBLIC_BASE = (Deno.env.get('R2_PUBLIC_BASE') ?? '').replace(/\/+$/, '')

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  try {
    // 1) Verificar sesión.
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return json({ error: 'No autenticado.' }, 401)

    // 2) URLs a borrar.
    const { urls } = await req.json().catch(() => ({}))
    if (!Array.isArray(urls)) return json({ error: 'Faltan urls.' }, 400)

    const r2 = new AwsClient({
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    })

    // Autorización para borrar un objeto (la key es `{carpeta}/{owner}/{uuid.ext}`
    // con carpeta en {entregas, clases}):
    //  (a) lo subió el propio usuario (seg[1] === user.id), o
    //  (b) la URL figura en una fila que el usuario PUEDE VER por RLS
    //      (entrega_archivos / clase_archivos de SUS grupos). Así el docente puede
    //      limpiar los archivos de entregas de sus estudiantes al borrar el grupo,
    //      pero nadie puede borrar archivos de grupos ajenos.
    const carpetas = new Set(['entregas', 'clases', 'asignaciones'])
    let borrados = 0
    let omitidos = 0

    // Prefetch de las URLs autorizadas por base (RLS decide qué ve el que llama).
    const dentro = urls.filter(
      (u: unknown): u is string =>
        typeof u === 'string' && u.startsWith(PUBLIC_BASE + '/'),
    )
    const autorizadasDB = new Set<string>()
    if (dentro.length) {
      const [ea, ca] = await Promise.all([
        supabase.from('entrega_archivos').select('url').in('url', dentro),
        supabase.from('clase_archivos').select('url').in('url', dentro),
      ])
      for (const r of ea.data ?? []) autorizadasDB.add(r.url)
      for (const r of ca.data ?? []) autorizadasDB.add(r.url)
    }

    for (const url of urls) {
      if (typeof url !== 'string' || !url.startsWith(PUBLIC_BASE + '/')) {
        omitidos++
        continue
      }
      const key = url.slice(PUBLIC_BASE.length + 1)
      const seg = key.split('/')
      // El id del dueño puede estar en seg[2] (esquema nuevo
      // `{carpeta}/{grupo}/{usuario}/…`) o en seg[1] (esquema viejo
      // `{carpeta}/{usuario}/…`). Como son UUID, no hay falsos positivos.
      const esPropio =
        carpetas.has(seg[0]) && (seg[1] === user.id || seg[2] === user.id)
      if (!esPropio && !autorizadasDB.has(url)) {
        omitidos++ // ni propio ni visible por RLS: por seguridad, no se borra
        continue
      }
      const endpoint = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}/${key}`
      try {
        const resp = await r2.fetch(endpoint, { method: 'DELETE' })
        // 204 = borrado, 404 = ya no existía (lo damos por bueno).
        if (resp.ok || resp.status === 404) borrados++
        else omitidos++
      } catch {
        omitidos++
      }
    }

    return json({ borrados, omitidos })
  } catch (e) {
    return json({ error: (e as Error)?.message ?? 'Error borrando archivos.' }, 500)
  }
})
