import imageCompression from 'browser-image-compression'
import { supabase } from '../lib/supabase'

// Capa de almacenamiento de archivos. Hoy: Cloudflare R2 vía URL firmada
// (Edge Function `firmar-subida`). Si algún día se cambia de proveedor, solo
// se toca este archivo. Ver ADR-002 en el README.

const TIPOS_DOC = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const TIPOS_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB (imágenes / PDF)
const MAX_BYTES_VIDEO = 200 * 1024 * 1024 // 200 MB (video propio de clases)

/** Tipos aceptados, listos para el atributo `accept` de un <input file>.
 * Solo MIME types (sin mezclar con extensiones), que es lo más compatible
 * con el diálogo de archivos de Windows; la validación real está en subirArchivo. */
export const ACCEPT = 'image/*,application/pdf'
export const ACCEPT_VIDEO = 'video/mp4,video/webm,video/quicktime'

/**
 * Sube un archivo y devuelve { url, nombre, tipo } listo para entrega_archivos
 * o clase_archivos. Comprime imágenes (máx 1600px); PDF y video van tal cual.
 * `opciones.video=true` habilita video y sube el límite a 200 MB.
 * `opciones.onProgress(pct)` reporta el avance de subida (0-100), útil para video.
 * `opciones.carpeta` ('entregas' | 'clases' | 'asignaciones') y `opciones.grupoId`
 * organizan el objeto en R2 como `{carpeta}/{grupo}/{usuario}/…` (orden por grupo
 * y por usuario, para poder auditar y limpiar sin tocar lo de otros).
 * Lanza Error con mensaje en español si algo falla.
 */
export async function subirArchivo(
  file,
  { video = false, onProgress, carpeta = 'entregas', grupoId } = {},
) {
  if (!file) throw new Error('No hay archivo para subir.')

  const permitidos = video ? TIPOS_VIDEO : TIPOS_DOC
  if (!permitidos.includes(file.type)) {
    throw new Error(
      video
        ? 'Formato de video no soportado. Usá MP4 (recomendado), WEBM o MOV.'
        : 'Tipo no permitido. Usá una foto (JPG, PNG, WEBP) o un PDF.',
    )
  }

  // Comprimir solo imágenes; PDF y video quedan igual.
  let archivo = file
  if (!video && file.type.startsWith('image/')) {
    try {
      archivo = await imageCompression(file, {
        maxWidthOrHeight: 1600,
        maxSizeMB: 2,
        useWebWorker: true,
        initialQuality: 0.8,
      })
    } catch {
      archivo = file // si la compresión falla, seguimos con el original
    }
  }

  const tipo = archivo.type || file.type
  const limite = video ? MAX_BYTES_VIDEO : MAX_BYTES
  if (archivo.size > limite)
    throw new Error(
      video
        ? 'El video supera los 200 MB. Para videos largos, mejor usá YouTube.'
        : 'El archivo supera los 10 MB, incluso después de comprimir.',
    )

  // 1) Pedir URL firmada a la Edge Function (manda la sesión automáticamente).
  const { data, error } = await supabase.functions.invoke('firmar-subida', {
    body: { contentType: tipo, size: archivo.size, carpeta, grupoId },
  })
  if (error) {
    // En respuestas 4xx/5xx, supabase-js deja el detalle en error.context;
    // intentamos leer el mensaje real de la función para poder depurar.
    let detalle = ''
    try {
      const cuerpo = await error.context?.json?.()
      detalle = cuerpo?.error || ''
    } catch {
      /* sin cuerpo legible */
    }
    throw new Error(detalle || 'No se pudo preparar la subida. Probá de nuevo.')
  }
  if (data?.error) throw new Error(data.error)

  // 2) Subir directo a R2 con la URL firmada (XHR para poder reportar progreso).
  await subirPut(data.uploadUrl, archivo, tipo, onProgress)

  return { url: data.publicUrl, nombre: file.name, tipo }
}

/** PUT a R2 con XMLHttpRequest para emitir progreso de subida (0-100). */
function subirPut(url, archivo, tipo, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', tipo)
    if (onProgress) {
      onProgress(0)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    const fallar = () =>
      reject(new Error('No se pudo subir el archivo. Revisá tu conexión.'))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else fallar()
    }
    xhr.onerror = fallar
    xhr.onabort = fallar
    xhr.send(archivo)
  })
}

/** Sube varios archivos en paralelo. Devuelve el arreglo de resultados.
 * `carpeta` ('entregas' | 'clases' | 'asignaciones') y `grupoId` definen la ruta
 * en R2 (`{carpeta}/{grupo}/{usuario}/…`). */
export async function subirArchivos(files, carpeta = 'entregas', grupoId) {
  return Promise.all(
    Array.from(files).map((f) => subirArchivo(f, { carpeta, grupoId })),
  )
}

/** Sube un video propio (para clases). `onProgress(pct)` reporta el avance. */
export async function subirVideo(file, onProgress, grupoId) {
  return subirArchivo(file, { video: true, onProgress, carpeta: 'clases', grupoId })
}

/**
 * Borra objetos de R2 dadas sus URLs públicas (limpieza al eliminar
 * clases/archivos/entregas). La Edge Function solo borra archivos del propio
 * usuario. Es *best-effort*: si falla, no interrumpe la acción (la base ya es la
 * fuente de verdad); el objeto quedaría huérfano pero nada se rompe.
 */
export async function borrarArchivos(urls) {
  const lista = (urls || []).filter((u) => typeof u === 'string' && u)
  if (lista.length === 0) return
  try {
    await supabase.functions.invoke('borrar-archivo', { body: { urls: lista } })
  } catch {
    /* limpieza best-effort: se ignora el error */
  }
}
