import GaleriaArchivos from './GaleriaArchivos'
import { renderMarkdownSimple } from '../lib/markdown'
import { youtubeEmbed } from '../lib/youtube'

// Muestra el contenido de una clase: video de YouTube (responsivo),
// texto en markdown simple y archivos adjuntos. Props: clase.
// `compacto`: para el docente, pone los videos arriba lado a lado (2 columnas)
// y el texto/material abajo a lo ancho, para que se vea ordenado.
export default function ClaseContenido({ clase, compacto = false }) {
  // Enlaces de YouTube: el array nuevo, o el legado youtube_url si no hay array.
  const ytList =
    Array.isArray(clase.youtube_urls) && clase.youtube_urls.length
      ? clase.youtube_urls
      : clase.youtube_url
        ? [clase.youtube_url]
        : []
  const embeds = ytList.map((u) => youtubeEmbed(u)).filter(Boolean)
  const html = renderMarkdownSimple(clase.contenido)

  // Los videos propios viven como clase_archivos con tipo video/*; el resto
  // (fotos/PDF) se muestra en la galería.
  const archivos = clase.archivos || []
  const videos = archivos.filter((a) => a.tipo?.startsWith('video/'))
  const materiales = archivos.filter((a) => !a.tipo?.startsWith('video/'))

  const hayTexto = !!html || materiales.length > 0

  // Cada video/embed como un ítem, para poder ponerlos en fila (docente) o
  // apilados (estudiante).
  const mediaItems = []
  embeds.forEach((src, i) => {
    mediaItems.push(
      <div
        key={`youtube-${i}`}
        className="relative w-full overflow-hidden rounded-cuaderno"
        style={{ aspectRatio: '16 / 9' }}
      >
        <iframe
          src={src}
          title={`${clase.titulo} — video ${i + 1}`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>,
    )
  })
  for (const v of videos) {
    mediaItems.push(
      <div key={v.id ?? v.url} className="overflow-hidden rounded-cuaderno bg-black">
        <video
          src={v.url}
          controls
          playsInline
          preload="metadata"
          className="max-h-[70vh] w-full"
        >
          Tu navegador no puede reproducir este video.{' '}
          <a href={v.url} className="underline">
            Descargalo acá
          </a>
          .
        </video>
      </div>,
    )
  }

  if (mediaItems.length === 0 && !hayTexto) {
    return (
      <p className="text-sm text-tinta/60">Esta clase todavía no tiene contenido.</p>
    )
  }

  const texto = (
    <div className="space-y-4">
      {html && (
        <div className="rounded-cuaderno border border-tinta/10 bg-superficie px-5 py-4 shadow-sm">
          <div
            className="space-y-2 text-[15px] leading-relaxed text-tinta/85"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
      {materiales.length > 0 && (
        <div className="rounded-cuaderno border border-tinta/10 bg-tinta/[0.02] p-4">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-tinta/65">
            Material de la clase
          </p>
          <GaleriaArchivos archivos={materiales} />
        </div>
      )}
    </div>
  )

  // Docente (compacto): videos arriba lado a lado, actividad abajo a lo ancho.
  if (compacto) {
    return (
      <div className="space-y-5">
        {mediaItems.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
            {mediaItems}
          </div>
        )}
        {hayTexto && texto}
      </div>
    )
  }

  // Estudiante: video(s) apilados y luego el texto/material.
  return (
    <div className="space-y-4">
      <div className="space-y-4">{mediaItems}</div>
      {texto}
    </div>
  )
}
