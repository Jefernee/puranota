import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Layout from '../../components/Layout'
import Volver from '../../components/Volver'
import Alerta from '../../components/Alerta'
import Cargando from '../../components/Cargando'
import GaleriaArchivos from '../../components/GaleriaArchivos'
import { etiquetaPeriodo } from '../../lib/periodos'
import { formatearFecha, textoVencimiento } from '../../lib/formato'
import { calcularEstado, puedeEntregar, TONO_BADGE } from '../../lib/entregas'
import { obtenerAsignacion } from '../../services/asignaciones.service'
import {
  obtenerEntrega,
  crearEntrega,
  agregarArchivos,
  eliminarArchivo,
} from '../../services/entregas.service'
import { subirArchivos, ACCEPT } from '../../services/storage.service'

export default function AsignacionEstudiante() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const [asignacion, setAsignacion] = useState(null)
  const [entrega, setEntrega] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [seleccion, setSeleccion] = useState([]) // File[] aún sin subir
  const [subiendo, setSubiendo] = useState(false)
  const [errorAccion, setErrorAccion] = useState('')
  const [quitandoId, setQuitandoId] = useState(null)

  async function recargarEntrega() {
    setEntrega(await obtenerEntrega(id, usuario.id))
  }

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      setError('')
      try {
        const [a, e] = await Promise.all([
          obtenerAsignacion(id),
          obtenerEntrega(id, usuario.id),
        ])
        if (!vivo) return
        setAsignacion(a)
        setEntrega(e)
      } catch (err) {
        if (vivo) setError(err?.message || 'No se pudo cargar la asignación.')
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [id, usuario.id])

  function agregarSeleccion(fileList) {
    setErrorAccion('')
    // Capturamos los File ya mismo: el onChange limpia el input justo después
    // y, si dejáramos el Array.from dentro del updater, leería la lista vacía.
    const nuevos = Array.from(fileList)
    if (!nuevos.length) return
    setSeleccion((prev) => [...prev, ...nuevos])
  }
  function quitarSeleccion(i) {
    setSeleccion((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleEntregar() {
    if (seleccion.length === 0) {
      setErrorAccion('Elegí al menos una foto o PDF para entregar.')
      return
    }
    setErrorAccion('')
    setSubiendo(true)
    try {
      const subidos = await subirArchivos(seleccion, 'entregas', asignacion.grupo_id)
      let e = entrega
      if (!e) e = await crearEntrega(asignacion.id, usuario.id)
      await agregarArchivos(e.id, subidos)
      await recargarEntrega()
      setSeleccion([])
    } catch (err) {
      setErrorAccion(err?.message || 'No se pudo completar la entrega.')
    } finally {
      setSubiendo(false)
    }
  }

  async function handleQuitarArchivo(archivoId) {
    setQuitandoId(archivoId)
    setErrorAccion('')
    try {
      await eliminarArchivo(archivoId)
      setEntrega((prev) => ({
        ...prev,
        archivos: (prev.archivos || []).filter((a) => a.id !== archivoId),
      }))
    } catch (err) {
      setErrorAccion(err?.message || 'No se pudo quitar el archivo.')
    } finally {
      setQuitandoId(null)
    }
  }

  if (cargando) return <Cargando texto="Abriendo la asignación…" />

  if (error || !asignacion)
    return (
      <Layout ancho="estrecho">
        <Alerta tipo="error">{error || 'Asignación no encontrada.'}</Alerta>
        <Volver to="/estudiante" className="mt-4">
          Volver
        </Volver>
      </Layout>
    )

  const est = calcularEstado(asignacion, entrega)
  const editable = puedeEntregar(asignacion, entrega)
  const calificada = entrega?.estado === 'calificada'
  const archivos = entrega?.archivos || []

  const esPrueba = asignacion.requiere_entrega === false
  const sinInfo =
    !asignacion.instrucciones &&
    !asignacion.archivos?.length &&
    !asignacion.rubrica?.length

  return (
    <Layout ancho="normal">
      <div className="mb-5 border-b border-tinta/10 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <Volver to={`/estudiante/grupos/${asignacion.grupo_id}`}>
              Volver al grupo
            </Volver>
            <h1 className="min-w-0 truncate text-xl font-bold leading-tight sm:text-2xl">
              {asignacion.titulo}
            </h1>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${TONO_BADGE[est.tono]}`}
          >
            {est.etiqueta}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip color="guaria" icon="🗓️">
            {etiquetaPeriodo(asignacion.periodo)}
          </Chip>
          <Chip color="pizarra" icon="🏷️">
            {asignacion.rubro}
            {asignacion.porcentaje != null ? ` · ${asignacion.porcentaje}%` : ''}
          </Chip>
          <Chip icon="🎯">sobre {asignacion.puntos} pts</Chip>
          {asignacion.fecha_limite && (
            <Chip
              color={est.clave.startsWith('pendiente') ? 'alerta' : 'neutral'}
              icon="📅"
            >
              {formatearFecha(asignacion.fecha_limite, false)} ·{' '}
              {textoVencimiento(asignacion.fecha_limite)}
            </Chip>
          )}
          {asignacion.permite_tardias && asignacion.penalizacion_tardia > 0 && (
            <Chip
              color="alerta"
              icon="⏰"
              title={`Si entregás después de la fecha límite, tu nota de esta entrega baja ${asignacion.penalizacion_tardia}%.`}
            >
              −{asignacion.penalizacion_tardia}% si entregás tarde
            </Chip>
          )}
          {!asignacion.permite_tardias && <Chip color="alerta">Sin tardías</Chip>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* Columna izquierda: información de la actividad */}
        <div className="space-y-4 lg:col-span-2">
          {asignacion.instrucciones && (
            <div className="tarjeta-cuaderno px-5 py-4 pl-7">
              <p className="mb-2 flex items-center gap-2 font-display text-base font-semibold text-tinta">
                <span aria-hidden="true">📋</span> Instrucciones
              </p>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-tinta/85">
                {asignacion.instrucciones}
              </p>
            </div>
          )}

          {asignacion.archivos?.length > 0 && (
            <div className="tarjeta-cuaderno px-5 py-4 pl-7">
              <p className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-tinta">
                <span aria-hidden="true">📎</span> Material de la actividad
              </p>
              <GaleriaArchivos archivos={asignacion.archivos} />
            </div>
          )}

          {asignacion.rubrica?.length > 0 && (
            <div className="tarjeta-cuaderno px-5 py-4 pl-7">
              <p className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-tinta">
                <span aria-hidden="true">✅</span> Con qué te van a calificar
              </p>
              <ul className="space-y-1.5 text-[15px]">
                {asignacion.rubrica.map((c, i) => (
                  <li
                    key={i}
                    className="flex justify-between gap-3 border-b border-tinta/5 pb-1.5 last:border-0"
                  >
                    <span className="text-tinta/80">{c.criterio}</span>
                    <span className="shrink-0 font-medium text-tinta/60">
                      {c.puntos} pts
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sinInfo && (
            <div className="tarjeta-cuaderno px-5 py-4 pl-7">
              <p className="text-sm text-tinta/65">Sin instrucciones adicionales.</p>
            </div>
          )}
        </div>

        {/* Columna derecha: tu entrega / nota */}
        <div className="space-y-4">
          {/* Nota cuando ya está calificada */}
          {calificada && (
            <div className="rounded-cuaderno border border-guaria/30 bg-guaria/10 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-tinta/60">
                Tu nota
              </p>
              <p className="font-display text-4xl font-bold text-guaria">
                {entrega.nota ?? '—'}
                <span className="text-xl text-tinta/60"> / {asignacion.puntos}</span>
              </p>
              {entrega.observaciones && (
                <div className="mt-3 border-t border-guaria/20 pt-3">
                  <p className="mb-1 font-display text-sm font-semibold text-tinta">
                    Observaciones
                  </p>
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-tinta/85">
                    {entrega.observaciones}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Prueba escrita / nota directa */}
          {esPrueba && (
            <div className="tarjeta-cuaderno px-5 py-4 pl-7">
              <p className="text-sm text-tinta/70">
                Esta actividad se califica en clase — no tenés que entregar nada.
                Tu profe te pone la nota.
              </p>
            </div>
          )}

          {/* Mi entrega: archivos ya subidos */}
          {!esPrueba && (
            <div className="tarjeta-cuaderno px-5 py-4 pl-7">
              <p className="mb-2 flex items-center gap-2 font-display text-base font-semibold text-tinta">
                <span aria-hidden="true">📤</span> Mi entrega
              </p>

              {archivos.length === 0 && seleccion.length === 0 && (
                <p className="text-sm text-tinta/65">
                  {editable
                    ? 'Todavía no subiste nada. Agregá tus fotos o PDF abajo.'
                    : entrega
                      ? 'No hay archivos para mostrar en tu entrega.'
                      : 'No entregaste nada en esta asignación.'}
                </p>
              )}

              {archivos.length > 0 && (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {archivos.map((a) => (
                    <li key={a.id} className="relative">
                      <VisorArchivo url={a.url} nombre={a.nombre} tipo={a.tipo} />
                      {editable && !calificada && (
                        <button
                          type="button"
                          onClick={() => handleQuitarArchivo(a.id)}
                          disabled={quitandoId === a.id}
                          className="absolute right-1 top-1 rounded-full bg-papel/90 px-2 py-0.5 text-sm text-margen shadow hover:bg-papel disabled:opacity-50"
                          title="Quitar"
                          aria-label="Quitar archivo"
                        >
                          {quitandoId === a.id ? '…' : '✕'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Zona de subida / reemplazo */}
          {editable && !calificada && (
            <div className="tarjeta-cuaderno px-5 py-4 pl-7">
              <p className="mb-1 flex items-center gap-2 font-display text-base font-semibold text-tinta">
                <span aria-hidden="true">⬆️</span>{' '}
                {archivos.length > 0 ? 'Agregar más archivos' : 'Subir mi entrega'}
              </p>
              <p className="mb-3 text-xs text-tinta/60">
                Fotos (JPG, PNG, WEBP) o PDF, hasta 10 MB cada uno. Las fotos se
                comprimen solas. Podés reemplazar mientras no se pase la fecha.
              </p>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-cuaderno border border-dashed border-tinta/30 px-4 py-3 text-sm text-tinta/70 hover:border-pizarra hover:text-pizarra">
                <span>+ Elegir archivos</span>
                <input
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    agregarSeleccion(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>

              {seleccion.length > 0 && (
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {seleccion.map((f, i) => (
                    <li key={i} className="relative">
                      <PreviewLocal file={f} />
                      <button
                        type="button"
                        onClick={() => quitarSeleccion(i)}
                        className="absolute right-1 top-1 rounded-full bg-papel/90 px-2 py-0.5 text-sm text-margen shadow hover:bg-papel"
                        aria-label="Quitar de la selección"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {errorAccion && (
                <div className="mt-3">
                  <Alerta tipo="error">{errorAccion}</Alerta>
                </div>
              )}

              <div className="mt-3 flex justify-end">
                <button
                  className="btn-primario"
                  onClick={handleEntregar}
                  disabled={subiendo || seleccion.length === 0}
                >
                  {subiendo
                    ? 'Subiendo…'
                    : archivos.length > 0
                      ? 'Guardar archivos'
                      : 'Entregar'}
                </button>
              </div>
            </div>
          )}

          {/* Mensaje cuando no se puede entregar (solo si requiere entrega) */}
          {!esPrueba && !editable && !calificada && (
            <Alerta tipo="info">
              {est.clave === 'cerrada'
                ? 'Esta asignación ya cerró y no admite entregas tardías.'
                : 'Ya no podés modificar esta entrega.'}
            </Alerta>
          )}

          {errorAccion && (editable === false || calificada) && (
            <Alerta tipo="error">{errorAccion}</Alerta>
          )}
        </div>
      </div>
    </Layout>
  )
}

// Pastilla de metadato (con color e ícono) para el encabezado de la asignación.
function Chip({ children, icon, color = 'neutral', title }) {
  // Sobrio y uniforme: todas las pastillas con superficie propia (resaltan del
  // fondo) y borde, sin colores. El texto y el badge de estado comunican la
  // urgencia; los chips solo dan el dato.
  const base = 'bg-superficie text-tinta/80 border-tinta/15 shadow-sm'
  const estilos = {
    neutral: base,
    pizarra: base,
    guaria: base,
    alerta: base,
  }
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${estilos[color]}`}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  )
}

// Vista de un archivo ya subido: miniatura si es imagen, chip si es PDF.
function VisorArchivo({ url, nombre, tipo }) {
  const esImagen = tipo?.startsWith('image/')
  const ext = nombre?.includes('.')
    ? nombre.split('.').pop().toUpperCase().slice(0, 4)
    : 'DOC'
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group block overflow-hidden rounded-cuaderno border border-tinta/10 bg-superficie shadow-sm transition-all hover:border-pizarra/40 hover:shadow-md"
      title={`Abrir ${nombre}`}
    >
      {esImagen ? (
        <img
          src={url}
          alt={nombre}
          className="h-28 w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="flex h-28 flex-col items-center justify-center gap-2 bg-gradient-to-b from-pizarra/[0.07] to-pizarra/[0.02] px-2">
          <div className="flex h-14 w-11 flex-col overflow-hidden rounded-md border border-pizarra/25 bg-superficie shadow-sm transition-transform duration-200 group-hover:scale-105">
            <div className="h-2 w-full bg-pizarra" />
            <div className="flex flex-1 items-center justify-center px-1">
              <span className="text-[10px] font-extrabold text-pizarra">{ext}</span>
            </div>
          </div>
          <span className="line-clamp-2 px-1 text-center text-xs leading-tight text-tinta/70">{nombre}</span>
        </div>
      )}
    </a>
  )
}

// Preview local de un archivo elegido pero aún no subido.
function PreviewLocal({ file }) {
  const [url, setUrl] = useState('')
  const esImagen = file.type?.startsWith('image/')
  useEffect(() => {
    if (!esImagen) return
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file, esImagen])

  const ext = file.name?.includes('.')
    ? file.name.split('.').pop().toUpperCase().slice(0, 4)
    : 'DOC'
  return (
    <div className="overflow-hidden rounded-cuaderno border border-tinta/10 bg-superficie shadow-sm">
      {esImagen && url ? (
        <img src={url} alt={file.name} className="h-28 w-full object-cover" />
      ) : (
        <div className="flex h-28 flex-col items-center justify-center gap-2 bg-gradient-to-b from-pizarra/[0.07] to-pizarra/[0.02] px-2">
          <div className="flex h-14 w-11 flex-col overflow-hidden rounded-md border border-pizarra/25 bg-superficie shadow-sm">
            <div className="h-2 w-full bg-pizarra" />
            <div className="flex flex-1 items-center justify-center px-1">
              <span className="text-[10px] font-extrabold text-pizarra">{ext}</span>
            </div>
          </div>
          <span className="line-clamp-2 px-1 text-center text-xs leading-tight text-tinta/70">{file.name}</span>
        </div>
      )}
    </div>
  )
}
