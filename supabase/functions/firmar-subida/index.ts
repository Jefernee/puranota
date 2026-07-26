// Edge Function: firmar-subida
// Devuelve una URL PUT firmada y temporal para que el navegador suba un archivo
// DIRECTO a Cloudflare R2. Las credenciales de R2 viven solo acá (secrets).
// Ver ADR-002 en el README.
//
// Desplegar:
//   supabase functions deploy firmar-subida
// Secrets necesarios (supabase secrets set …):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE
//   (SUPABASE_URL y SUPABASE_ANON_KEY ya los inyecta Supabase.)

import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!
const ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')!
const SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!
const BUCKET = Deno.env.get('R2_BUCKET')!
const PUBLIC_BASE = (Deno.env.get('R2_PUBLIC_BASE') ?? '').replace(/\/+$/, '')

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

// Tipos permitidos -> extensión.
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  // Video propio para clases (ver ClaseForm). MP4 es lo más compatible.
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB (imágenes / PDF)
const MAX_BYTES_VIDEO = 200 * 1024 * 1024 // 200 MB (video propio)

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
    // 1) Verificar que haya sesión válida (estudiante o docente logueado).
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return json({ error: 'No autenticado.' }, 401)

    // 2) Validar lo que se quiere subir.
    const { contentType, size, carpeta, grupoId } = await req.json().catch(() => ({}))
    const ext = EXT[contentType]
    if (!ext)
      return json(
        { error: 'Tipo de archivo no permitido. Usá JPG, PNG, WEBP, PDF o video (MP4/WEBM/MOV).' },
        400,
      )
    const esVideo = (contentType as string).startsWith('video/')
    const limite = esVideo ? MAX_BYTES_VIDEO : MAX_BYTES
    if (!size || size > limite)
      return json(
        { error: esVideo ? 'El video supera los 200 MB.' : 'El archivo supera los 10 MB.' },
        400,
      )

    // 3) Clave única, ORDENADA por grupo y por usuario:
    //    `{carpeta}/{grupo}/{usuario}/{uuid}.ext`.
    //    - entregas/    = entregas de estudiantes (usuario = estudiante)
    //    - clases/      = material y video de clases (usuario = docente)
    //    - asignaciones/= material de las tareas (usuario = docente)
    //    Si no llega grupo (o es inválido), cae al esquema viejo sin grupo, que
    //    sigue siendo del propio usuario.
    const carpetas = new Set(['entregas', 'clases', 'asignaciones'])
    const folder = carpetas.has(carpeta) ? carpeta : 'entregas'
    const grupo =
      typeof grupoId === 'string' && /^[0-9a-fA-F-]{16,40}$/.test(grupoId)
        ? grupoId
        : null
    const uuid = crypto.randomUUID()
    const key = grupo
      ? `${folder}/${grupo}/${user.id}/${uuid}.${ext}`
      : `${folder}/${user.id}/${uuid}.${ext}`

    // 4) Firmar una URL PUT temporal (5 min) contra el endpoint S3 de R2.
    const r2 = new AwsClient({
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
      service: 's3',
      region: 'auto',
    })
    const endpoint = new URL(
      `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}/${key}`,
    )
    endpoint.searchParams.set('X-Amz-Expires', '300')
    const firmado = await r2.sign(endpoint.toString(), {
      method: 'PUT',
      aws: { signQuery: true },
    })

    return json({
      uploadUrl: firmado.url,
      publicUrl: `${PUBLIC_BASE}/${key}`,
    })
  } catch (e) {
    return json({ error: (e as Error)?.message ?? 'Error firmando la subida.' }, 500)
  }
})
