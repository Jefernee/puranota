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
import {
  calcularEstado,
  puedeEntregar,
  tipoDe,
  TONO_BADGE,
} from '../../lib/entregas'
import { calificacionDe, pct } from '../../lib/notas'
import { obtenerAsignacion } from '../../services/asignaciones.service'
import { notasPublicadas } from '../../services/grupos.service'
import {
  obtenerEntrega,
  crearEntrega,
  agregarArchivos,
  eliminarArchivo,
} from '../../services/entregas.service'
import { subirArchivos, ACCEPT } from '../../services/storage.service'

// Detalle de una actividad para el estudiante.
//
// Estructura de registro académico formal (referencia: Aula Virtual de la
// UISIL, capturas en imagenes/): primero el veredicto —la Revisión con la nota
// en porcentaje—, después la entrega, y al final los datos de la actividad en
// una tabla de etiqueta y valor.
//
// Sin pastillas de colores con emoji: ocupaban media pantalla en celular y no
// son lenguaje de registro.

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
  const tipo = tipoDe(asignacion)
  const editable = puedeEntregar(asignacion, entrega)
  const calificada = entrega?.estado === 'calificada'
  // Si el docente todavía no publicó las notas del periodo, acá tampoco se
  // muestran: si no, bastaba con abrir la actividad para saltarse el registro.
  const notasVisibles = notasPublicadas(asignacion.grupo, asignacion.periodo)

  // El curso, armado igual que en la pantalla del grupo: materia como título y
  // el resto como complementos.
  const g = asignacion.grupo || {}
  const materia = g.materia || g.nombre || 'Grupo'
  const tituloCurso = [
    materia,
    ...[g.nombre !== materia ? g.nombre : null, g.especialidad, g.nivel].filter(Boolean),
  ].join(' · ')
  const archivos = entrega?.archivos || []
  const esPrueba = asignacion.requiere_entrega === false
  const sinInfo =
    !asignacion.instrucciones &&
    !asignacion.archivos?.length &&
    !asignacion.rubrica?.length

  return (
    <Layout
      ancho="normal"
      // Arriba SIEMPRE va el curso, en todos los módulos: es el contexto que no
      // cambia mientras uno navega. El nombre de la actividad va abajo, que es
      // donde uno lee lo que está haciendo.
      titulo={tituloCurso}
      volver={
        <Volver to={`/estudiante/grupos/${asignacion.grupo_id}`}>Volver al grupo</Volver>
      }
    >
      <div className="mb-5 border-b border-tinta/10 pb-4">
        <div className="lg:hidden">
          <Volver to={`/estudiante/grupos/${asignacion.grupo_id}`}>
            Volver al grupo
          </Volver>
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 lg:mt-0">
          <h1 className="min-w-0 break-words text-lg font-bold leading-snug text-tinta sm:text-2xl">
            {asignacion.titulo}
          </h1>
          <span
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${TONO_BADGE[est.tono]}`}
          >
            {est.etiqueta}
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        {/* ── Columna izquierda: la actividad ──────────────────────────────
            En celular va DESPUÉS de la nota y la entrega: lo primero que un
            estudiante busca es su nota, no las instrucciones que ya leyó. */}
        <div className="order-2 space-y-5 lg:order-1 lg:col-span-2">
          <Panel titulo="Datos generales">
            <dl className="divide-y divide-tinta/10 text-[15px]">
              <Dato etiqueta="Tipo de actividad" valor={tipo.label} />
              <Dato etiqueta="Periodo" valor={etiquetaPeriodo(asignacion.periodo)} />
              <Dato etiqueta="Rubro" valor={asignacion.rubro} />
              <Dato
                etiqueta="Valor porcentual"
                valor={
                  asignacion.porcentaje != null ? `${asignacion.porcentaje}%` : '—'
                }
              />
              <Dato etiqueta="Puntaje" valor={`${asignacion.puntos} pts`} />
              {asignacion.clase?.titulo && (
                <Dato
                  etiqueta="Clase a la que pertenece"
                  valor={asignacion.clase.titulo}
                />
              )}
              <Dato
                etiqueta="Fecha de entrega"
                valor={
                  asignacion.fecha_limite
                    ? `${formatearFecha(asignacion.fecha_limite, false)} · ${textoVencimiento(
                        asignacion.fecha_limite,
                      )}`
                    : 'Sin fecha límite'
                }
              />
              {!esPrueba && (
                <Dato
                  etiqueta="Entregas tardías"
                  valor={
                    !asignacion.permite_tardias
                      ? 'No se admiten'
                      : asignacion.penalizacion_tardia > 0
                        ? `Se admiten, con ${asignacion.penalizacion_tardia}% de rebaja`
                        : 'Se admiten, sin rebaja'
                  }
                />
              )}
            </dl>
          </Panel>

          {asignacion.instrucciones && (
            <Panel titulo="Instrucciones">
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-tinta/85">
                {asignacion.instrucciones}
              </p>
            </Panel>
          )}

          {asignacion.archivos?.length > 0 && (
            <Panel titulo="Material de la actividad">
              <GaleriaArchivos archivos={asignacion.archivos} />
            </Panel>
          )}

          {asignacion.rubrica?.length > 0 && (
            <Panel titulo="Rúbrica de evaluación">
              <dl className="divide-y divide-tinta/10 text-[15px]">
                {asignacion.rubrica.map((c, i) => (
                  <Dato key={i} etiqueta={c.criterio} valor={`${c.puntos} pts`} />
                ))}
              </dl>
            </Panel>
          )}

          {sinInfo && (
            <Panel titulo="Instrucciones">
              <p className="text-[15px] text-tinta/70">
                Sin instrucciones adicionales.
              </p>
            </Panel>
          )}
        </div>

        {/* ── Columna derecha: revisión y entrega. Primera en celular. ────── */}
        <div className="order-1 space-y-5 lg:order-2">
          {calificada &&
            (notasVisibles ? (
              <Revision asignacion={asignacion} entrega={entrega} />
            ) : (
              <Panel titulo="Revisión">
                <p className="text-[15px] text-tinta/75">
                  Tu profe ya revisó esta actividad, pero todavía no publicó las
                  notas del periodo. Cuando las muestre, vas a ver acá tu
                  calificación y su retroalimentación.
                </p>
              </Panel>
            ))}

          {esPrueba && (
            <Panel titulo="Esta actividad no se entrega">
              <p className="text-[15px] text-tinta/75">
                Se califica en clase. Tu profe te pone la nota directamente.
              </p>
            </Panel>
          )}

          {!esPrueba && (
            <Panel titulo="Mi entrega">
              {entrega?.entregado_en && (
                <p className="mb-3 text-sm text-tinta/65">
                  Se registró tu entrega el{' '}
                  <b className="text-tinta/80">
                    {formatearFecha(entrega.entregado_en)}
                  </b>
                </p>
              )}

              {archivos.length === 0 && seleccion.length === 0 && (
                <p className="text-[15px] text-tinta/70">
                  {editable
                    ? 'Todavía no subiste nada.'
                    : entrega
                      ? 'No hay archivos para mostrar en tu entrega.'
                      : 'No entregaste nada en esta actividad.'}
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
                          className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-papel/95 text-base font-semibold text-margen shadow-md hover:bg-papel disabled:opacity-50"
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
            </Panel>
          )}

          {editable && !calificada && (
            <Panel
              titulo={
                archivos.length > 0 ? 'Agregar más archivos' : 'Subir mi entrega'
              }
            >
              <p className="mb-3 text-sm text-tinta/65">
                Fotos (JPG, PNG, WEBP) o PDF, hasta 10 MB cada uno. Las fotos se
                comprimen solas. Podés reemplazar mientras no se pase la fecha.
              </p>

              <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-cuaderno border border-dashed border-tinta/30 px-4 py-4 text-[15px] font-medium text-tinta/75 transition-colors hover:border-pizarra hover:text-pizarra active:bg-pizarra/[0.06] sm:py-3">
                <span>Elegir archivos</span>
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
                        className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-papel/95 text-base font-semibold text-margen shadow-md hover:bg-papel"
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
                  className="btn-primario w-full justify-center sm:w-auto"
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
            </Panel>
          )}

          {!esPrueba && !editable && !calificada && (
            <Alerta tipo="info">
              {est.clave === 'cerrada'
                ? 'Esta actividad ya cerró y no admite entregas tardías.'
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

// ─── Piezas ───────────────────────────────────────────────────────────────────

// Panel con encabezado sobrio. Sin íconos: el título dice qué es.
function Panel({ titulo, children }) {
  return (
    <section className="tarjeta-cuaderno px-4 py-4 sm:px-5">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-tinta/65">
        {titulo}
      </h2>
      {children}
    </section>
  )
}

// Fila de etiqueta y valor, como el bloque "Datos generales" de un registro.
// Ocupa muchísimo menos que una pastilla por dato, y se lee mejor.
function Dato({ etiqueta, valor }) {
  if (valor == null || valor === '') return null
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-tinta/65">{etiqueta}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-tinta">
        {valor}
      </dd>
    </div>
  )
}

// Bloque de Revisión: el veredicto. La nota se expresa en PORCENTAJE —que es la
// unidad del registro— y debajo, los puntos obtenidos.
function Revision({ asignacion, entrega }) {
  const obtenido = calificacionDe(asignacion, entrega)
  const vale = asignacion.porcentaje

  return (
    <section className="overflow-hidden rounded-cuaderno border border-pizarra/30 shadow-sm">
      <header className="bg-pizarra px-4 py-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-papel">
          Revisión
        </h2>
      </header>

      <div className="bg-superficie px-5 py-4">
        <p className="text-sm text-tinta/65">Obtuviste</p>
        <p className="mt-0.5 text-2xl font-bold leading-none tabular-nums text-tinta sm:text-3xl">
          {obtenido == null ? '—' : pct(obtenido)}
          {vale != null && (
            <span className="text-xl font-semibold text-tinta/55"> / {vale}%</span>
          )}
        </p>
        <p className="mt-2 text-[15px] text-tinta/70">
          <b className="font-semibold text-tinta">{entrega.nota ?? '—'}</b> de{' '}
          {asignacion.puntos} puntos
        </p>
        {entrega.calificado_en && (
          <p className="mt-1 text-sm text-tinta/60">
            Fecha de revisión: {formatearFecha(entrega.calificado_en)}
          </p>
        )}

        {entrega.observaciones ? (
          <div className="mt-4 border-t border-tinta/10 pt-3">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-tinta/65">
              Retroalimentación del docente
            </h3>
            <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-tinta/85">
              {entrega.observaciones}
            </p>
          </div>
        ) : (
          <p className="mt-4 border-t border-tinta/10 pt-3 text-sm italic text-tinta/55">
            No se registró retroalimentación.
          </p>
        )}
      </div>
    </section>
  )
}

// Vista de un archivo ya subido: miniatura si es imagen, ficha si es documento.
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
      className="group block overflow-hidden rounded-cuaderno border border-tinta/12 bg-superficie shadow-sm transition-all hover:border-pizarra/40 hover:shadow-md"
      title={`Abrir ${nombre}`}
    >
      {esImagen ? (
        <img
          src={url}
          alt={nombre}
          className="h-28 w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="flex h-28 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden bg-pizarra/[0.05] px-2">
          <span className="grid h-11 w-10 shrink-0 place-items-center rounded-md border border-pizarra/25 bg-superficie text-[13px] font-extrabold text-pizarra shadow-sm transition-transform group-hover:scale-105">
            {ext}
          </span>
          <span className="line-clamp-2 w-full break-all px-1 text-center text-sm leading-tight text-tinta/75">
            {nombre}
          </span>
        </div>
      )}
    </a>
  )
}

// Vista previa de un archivo elegido pero aún no subido.
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
    <div className="overflow-hidden rounded-cuaderno border border-tinta/12 bg-superficie shadow-sm">
      {esImagen && url ? (
        <img src={url} alt={file.name} className="h-28 w-full object-cover" />
      ) : (
        <div className="flex h-28 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden bg-pizarra/[0.05] px-2">
          <span className="grid h-11 w-10 shrink-0 place-items-center rounded-md border border-pizarra/25 bg-superficie text-[13px] font-extrabold text-pizarra shadow-sm">
            {ext}
          </span>
          <span className="line-clamp-2 w-full break-all px-1 text-center text-sm leading-tight text-tinta/75">
            {file.name}
          </span>
        </div>
      )}
    </div>
  )
}
