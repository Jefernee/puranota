import { useEffect, useState } from 'react'
import Alerta from '../Alerta'
import { ACCEPT, ACCEPT_VIDEO } from '../../services/storage.service'
import { youtubeEmbed } from '../../lib/youtube'

// Formulario para crear/editar una clase. Maneja campos + selección de
// archivos nuevos. Los archivos ya existentes se quitan vía onQuitarArchivo.
// Props: inicial, onGuardar(datos, archivosNuevos)->Promise, onCancelar,
//        onQuitarArchivo(archivoId)->Promise, textoBoton.
// Orden de los campos: Título → Videos → Contenido → Material.
export default function ClaseForm({
  inicial = {},
  onGuardar,
  onCancelar,
  onQuitarArchivo,
  textoBoton = 'Guardar',
}) {
  const [titulo, setTitulo] = useState(inicial.titulo || '')
  const [contenido, setContenido] = useState(inicial.contenido || '')
  // Varios enlaces de YouTube. Arranca con lo guardado (array nuevo o el legado
  // youtube_url), o un campo vacío para empezar.
  const [youtubeUrls, setYoutubeUrls] = useState(() => {
    if (Array.isArray(inicial.youtube_urls) && inicial.youtube_urls.length)
      return [...inicial.youtube_urls]
    return inicial.youtube_url ? [inicial.youtube_url] : ['']
  })
  const [visible, setVisible] = useState(inicial.visible ?? true)
  const [seleccion, setSeleccion] = useState([]) // File[] (fotos/PDF)
  const [videos, setVideos] = useState([]) // File[] de videos propios nuevos
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false) // "guardado ✓" al editar
  const [progresoVideo, setProgresoVideo] = useState(null) // 0-100 mientras sube
  const [quitandoId, setQuitandoId] = useState(null)

  // Mantiene la lista de archivos existentes en sync con la clase editada.
  const [existentes, setExistentes] = useState(inicial.archivos || [])
  useEffect(() => {
    setExistentes(inicial.archivos || [])
  }, [inicial.archivos])

  // Los videos existentes se gestionan aparte de las fotos/PDF (puede haber varios).
  const videosExistentes = existentes.filter((a) => a.tipo?.startsWith('video/'))
  const docsExistentes = existentes.filter((a) => !a.tipo?.startsWith('video/'))

  // Enlaces de YouTube no vacíos que NO son válidos (para avisar).
  const ytInvalidos = youtubeUrls.filter((u) => u.trim() && !youtubeEmbed(u))
  const setYt = (i, val) =>
    setYoutubeUrls((prev) => prev.map((u, idx) => (idx === i ? val : u)))
  const addYt = () => setYoutubeUrls((prev) => [...prev, ''])
  const removeYt = (i) =>
    setYoutubeUrls((prev) => {
      const next = prev.filter((_, idx) => idx !== i)
      return next.length ? next : ['']
    })

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setExito(false)
    if (!titulo.trim()) {
      setError('La clase necesita un título.')
      return
    }
    if (ytInvalidos.length) {
      setError('Revisá los enlaces de YouTube: alguno no es válido.')
      return
    }
    const ytLimpios = youtubeUrls.map((u) => u.trim()).filter(Boolean)
    setGuardando(true)
    try {
      await onGuardar(
        {
          titulo,
          contenido,
          youtube_url: ytLimpios[0] || null, // compatibilidad con lo viejo
          youtube_urls: ytLimpios,
          visible,
        },
        seleccion,
        videos,
        setProgresoVideo, // reporta el avance de subida del video (0-100)
      )
      // Al editar, el form queda abierto: mostramos la confirmación acá adentro
      // y limpiamos lo que ya se subió. (Al crear, el padre cierra el modal.)
      setSeleccion([])
      setVideos([])
      setProgresoVideo(null)
      setGuardando(false)
      setExito(true)
    } catch (err) {
      setError(err?.message || 'No se pudo guardar la clase.')
      setProgresoVideo(null)
      setGuardando(false)
    }
  }

  async function quitarExistente(archivoId) {
    setQuitandoId(archivoId)
    setError('')
    try {
      await onQuitarArchivo(archivoId)
      setExistentes((prev) => prev.filter((a) => a.id !== archivoId))
    } catch (err) {
      setError(err?.message || 'No se pudo quitar el archivo.')
    } finally {
      setQuitandoId(null)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* 1) Título. */}
      <div>
        <label htmlFor="c-titulo" className="etiqueta">
          Título
        </label>
        <input
          id="c-titulo"
          className="campo"
          placeholder="Ej. Clase 1 — Introducción"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          required
        />
      </div>

      {/* 2) Los videos (contenido principal): YouTube o video propio. */}
      <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
        <div>
          <label className="etiqueta">Videos de YouTube (opcional)</label>
          <div className="space-y-1.5">
            {youtubeUrls.map((u, i) => {
              const ok = u.trim() && youtubeEmbed(u)
              const mal = u.trim() && !youtubeEmbed(u)
              return (
                <div key={i}>
                  <div className="flex items-center gap-1.5">
                    <input
                      className="campo"
                      placeholder="https://www.youtube.com/watch?v=…"
                      value={u}
                      onChange={(e) => setYt(i, e.target.value)}
                    />
                    {youtubeUrls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeYt(i)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-cuaderno text-tinta/60 hover:bg-margen/10 hover:text-margen"
                        aria-label="Quitar enlace"
                        title="Quitar"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {ok && <p className="mt-0.5 text-sm text-pizarra">✓ Video reconocido.</p>}
                  {mal && (
                    <p className="mt-0.5 text-sm text-margen">No reconozco ese enlace.</p>
                  )}
                </div>
              )
            })}
          </div>
          <button
            type="button"
            onClick={addYt}
            className="mt-1.5 text-sm font-semibold text-pizarra hover:underline"
          >
            + Agregar otro de YouTube
          </button>
        </div>

        <div>
          <label className="etiqueta">Subí tus videos (opcional)</label>
          <div className="space-y-1">
            {/* Videos ya guardados (modo edición) */}
            {videosExistentes.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-2 rounded-cuaderno bg-tinta/5 px-3 py-1.5 text-sm"
              >
                <span className="break-words text-tinta/80">🎬 {v.nombre}</span>
                <button
                  type="button"
                  onClick={() => quitarExistente(v.id)}
                  disabled={quitandoId === v.id}
                  className="shrink-0 text-margen hover:underline disabled:opacity-50"
                >
                  {quitandoId === v.id ? '…' : 'Quitar'}
                </button>
              </div>
            ))}
            {/* Videos nuevos elegidos (aún sin subir) */}
            {videos.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-cuaderno bg-pizarra/5 px-3 py-1.5 text-sm"
              >
                <span className="break-words text-tinta/80">🎬 {f.name}</span>
                <button
                  type="button"
                  onClick={() => setVideos((prev) => prev.filter((_, idx) => idx !== i))}
                  className="shrink-0 text-margen hover:underline"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          <label className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-cuaderno border border-dashed border-tinta/30 px-4 py-2.5 text-sm text-tinta/70 hover:border-pizarra hover:text-pizarra">
            <span>+ Agregar video</span>
            <input
              type="file"
              accept={ACCEPT_VIDEO}
              multiple
              className="hidden"
              onChange={(e) => {
                const nuevos = Array.from(e.target.files)
                e.target.value = ''
                if (nuevos.length) setVideos((prev) => [...prev, ...nuevos])
              }}
            />
          </label>
          <p className="mt-1 text-sm text-tinta/60">
            MP4, máx 200 MB c/u. Podés agregar varios.
          </p>
        </div>
      </div>

      {/* 3) Contenido de texto. */}
      <div>
        <label htmlFor="c-contenido" className="etiqueta">
          Contenido
        </label>
        <textarea
          id="c-contenido"
          className="campo min-h-[110px] resize-y"
          placeholder="Escribí acá lo que querés contarles de la clase…"
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
        />
      </div>

      {/* 4) Material (fotos/PDF). */}
      {docsExistentes.length > 0 && (
        <div>
          <p className="etiqueta">Material adjunto</p>
          <ul className="space-y-1">
            {docsExistentes.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-cuaderno bg-tinta/5 px-3 py-1.5 text-sm"
              >
                <span className="break-words text-tinta/80">{a.nombre}</span>
                <button
                  type="button"
                  onClick={() => quitarExistente(a.id)}
                  disabled={quitandoId === a.id}
                  className="shrink-0 text-margen hover:underline disabled:opacity-50"
                >
                  {quitandoId === a.id ? '…' : 'Quitar'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="etiqueta">Agregar material (fotos o PDF)</p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-cuaderno border border-dashed border-tinta/30 px-4 py-2.5 text-sm text-tinta/70 hover:border-pizarra hover:text-pizarra">
          <span>+ Elegir archivos</span>
          <input
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const nuevos = Array.from(e.target.files)
              e.target.value = ''
              if (nuevos.length) setSeleccion((prev) => [...prev, ...nuevos])
            }}
          />
        </label>
        {seleccion.length > 0 && (
          <ul className="mt-2 space-y-1">
            {seleccion.map((f, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-cuaderno bg-pizarra/5 px-3 py-1.5 text-sm"
              >
                <span className="break-words text-tinta/80">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setSeleccion((prev) => prev.filter((_, idx) => idx !== i))}
                  className="shrink-0 text-margen hover:underline"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="flex items-start gap-2.5 text-sm text-tinta/80">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-pizarra"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
        />
        <span>
          Visible para los estudiantes
          <span className="block text-sm text-tinta/60">
            Desactivala para prepararla y publicarla después.
          </span>
        </span>
      </label>

      <Alerta tipo="error">{error}</Alerta>
      {exito && <Alerta tipo="exito">Cambios guardados ✓</Alerta>}

      {progresoVideo != null && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-tinta/10">
            <div
              className="h-full rounded-full bg-pizarra transition-[width] duration-150"
              style={{ width: `${progresoVideo}%` }}
            />
          </div>
          <p className="text-sm text-tinta/65">
            Subiendo video… {progresoVideo}%
            {progresoVideo === 100 && ' — guardando, no cierres esta ventana.'}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancelar}
          className="btn-secundario"
          disabled={guardando}
        >
          {exito ? 'Cerrar' : 'Cancelar'}
        </button>
        <button type="submit" className="btn-primario" disabled={guardando}>
          {guardando
            ? progresoVideo != null && progresoVideo < 100
              ? `Subiendo… ${progresoVideo}%`
              : 'Guardando…'
            : textoBoton}
        </button>
      </div>
    </form>
  )
}
