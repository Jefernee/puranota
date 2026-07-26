import { useEffect, useState } from 'react'
import Modal from '../Modal'
import Alerta from '../Alerta'
import EstadoVacio from '../EstadoVacio'
import SkeletonLista from '../SkeletonLista'
import AsignacionForm from './AsignacionForm'
import RevisionAsignacion from './RevisionAsignacion'
import MenuAcciones from '../MenuAcciones'
import { periodosDeGrupo, etiquetaPeriodo } from '../../lib/periodos'
import { rubrosPorPeriodo } from '../../services/grupos.service'
import {
  listarAsignaciones,
  crearAsignacion,
  actualizarAsignacion,
  cambiarVisibilidad,
  eliminarAsignacion,
} from '../../services/asignaciones.service'
import { listarClases } from '../../services/clases.service'
import { subirArchivos, borrarArchivos } from '../../services/storage.service'

// Panel de asignaciones dentro del detalle de un grupo.
// El grupo abarca todo el año; un selector de periodo filtra la lista (ADR-001).
// Props: grupo (objeto completo del grupo).
export default function AsignacionesPanel({ grupo }) {
  const periodos = periodosDeGrupo(grupo)
  const rubrosPP = rubrosPorPeriodo(grupo)

  const [periodoActivo, setPeriodoActivo] = useState(periodos[0] || 'I')
  const [asignaciones, setAsignaciones] = useState([])
  const [clases, setClases] = useState([]) // para vincular una asignación a una clase
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState(null) // asignación o null (crear)
  const [aBorrar, setABorrar] = useState(null)
  const [borrando, setBorrando] = useState(false)
  const [verAsig, setVerAsig] = useState(null) // id de asignación en revisión (inline)

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      setAsignaciones(await listarAsignaciones(grupo.id, periodoActivo))
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar las asignaciones.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupo.id, periodoActivo])

  // Clases del grupo (para el selector "Clase" del formulario).
  useEffect(() => {
    listarClases(grupo.id)
      .then(setClases)
      .catch(() => setClases([]))
  }, [grupo.id])

  function abrirCrear() {
    setEditando(null)
    setFormAbierto(true)
  }
  function abrirEditar(a) {
    setEditando(a)
    setFormAbierto(true)
  }

  // Mantiene la lista coherente con el periodo activo: una asignación que
  // cambió a otro periodo deja de aparecer en este filtro.
  function aplicarCambio(asig) {
    setAsignaciones((prev) => {
      const fuera = prev.filter((a) => a.id !== asig.id)
      return asig.periodo === periodoActivo ? [asig, ...fuera] : fuera
    })
  }

  async function handleGuardar(datos, archivosNuevos) {
    // Subir material nuevo (fotos/PDF) y combinarlo con los que se conservan.
    const subidos = archivosNuevos?.length
      ? await subirArchivos(archivosNuevos, 'asignaciones', grupo.id)
      : []
    const archivos = [...(datos.archivos || []), ...subidos]
    const datosFinal = { ...datos, archivos }

    if (editando) {
      const previos = editando.archivos || []
      const quitados = previos.filter((p) => !archivos.some((a) => a.url === p.url))
      const actualizado = await actualizarAsignacion(editando.id, datosFinal)
      if (quitados.length) borrarArchivos(quitados.map((a) => a.url)) // limpia R2
      aplicarCambio(actualizado)
    } else {
      const nueva = await crearAsignacion(grupo.id, datosFinal)
      if (nueva.periodo === periodoActivo) {
        setAsignaciones((prev) => [nueva, ...prev])
      }
    }
    setFormAbierto(false)
    setEditando(null)
  }

  async function toggleVisibilidad(a) {
    try {
      const act = await cambiarVisibilidad(a.id, !a.visible)
      setAsignaciones((prev) => prev.map((x) => (x.id === act.id ? act : x)))
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar la visibilidad.')
    }
  }

  async function confirmarBorrar() {
    setBorrando(true)
    setError('')
    try {
      await eliminarAsignacion(aBorrar.id)
      setAsignaciones((prev) => prev.filter((a) => a.id !== aBorrar.id))
      setABorrar(null)
    } catch (e) {
      setError(e?.message || 'No se pudo eliminar la asignación.')
    } finally {
      setBorrando(false)
    }
  }

  if (verAsig) {
    return (
      <RevisionAsignacion
        asignacionId={verAsig}
        onVolver={() => {
          setVerAsig(null)
          cargar() // refrescar por si se calificó algo
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Periodos (izquierda) + nueva asignación (derecha), en paralelo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {periodos.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodoActivo(p)}
              className={`rounded-cuaderno border px-4 py-2 text-sm font-semibold shadow-sm transition-colors ${
                periodoActivo === p
                  ? 'border-pizarra bg-pizarra text-papel'
                  : 'border-tinta/15 bg-superficie text-tinta/70 hover:border-pizarra/40 hover:text-pizarra'
              }`}
            >
              {etiquetaPeriodo(p)}
            </button>
          ))}
        </div>
        <button className="btn-primario" onClick={abrirCrear}>
          + Nueva asignación
        </button>
      </div>

      <Alerta tipo="error">{error}</Alerta>

      {cargando ? (
        <SkeletonLista />
      ) : asignaciones.length === 0 ? (
        <EstadoVacio icono="📝" titulo={`Sin asignaciones en el ${etiquetaPeriodo(periodoActivo)}`}>
          Creá la primera para que tus estudiantes puedan entregar.
        </EstadoVacio>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {asignaciones.map((a) => (
            <li
              key={a.id}
              onClick={() => setVerAsig(a.id)}
              className="tarjeta-cuaderno cursor-pointer px-5 py-4 pl-7 transition-shadow hover:shadow-md"
              title="Abrir la revisión"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-tinta">{a.titulo}</h3>
                    {!a.visible && (
                      <span className="rounded-full bg-tinta/10 px-2 py-0.5 text-xs text-tinta/60">
                        Oculta
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-pizarra/10 px-2.5 py-0.5 font-semibold text-pizarra">
                      {a.rubro}
                      {a.porcentaje != null ? ` · ${a.porcentaje}%` : ''}
                    </span>
                    {a.clase_id && (
                      <span className="rounded-full bg-guaria/10 px-2.5 py-0.5 font-medium text-guaria">
                        🎬 {clases.find((c) => c.id === a.clase_id)?.titulo || 'Clase'}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-tinta/65">
                    sobre {a.puntos} pts ·{' '}
                    {a.fecha_limite
                      ? `Entrega ${formatearFecha(a.fecha_limite)}`
                      : 'Sin fecha límite'}
                  </p>
                  {a.fecha_limite && !a.permite_tardias && (
                    <p className="mt-0.5 text-xs text-margen">
                      No admite entregas tardías
                    </p>
                  )}
                </div>

                <MenuAcciones
                  items={[
                    {
                      label: a.visible ? 'Ocultar' : 'Mostrar',
                      onClick: () => toggleVisibilidad(a),
                      icon: a.visible ? 'ocultar' : 'mostrar',
                    },
                    { label: 'Editar', onClick: () => abrirEditar(a), icon: 'editar' },
                    {
                      label: 'Eliminar',
                      onClick: () => setABorrar(a),
                      tono: 'margen',
                      icon: 'eliminar',
                    },
                  ]}
                />
              </div>

              {a.instrucciones ? (
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-tinta/70">
                  {a.instrucciones}
                </p>
              ) : (
                <p className="mt-3 text-sm italic text-tinta/35">
                  Sin instrucciones todavía.
                </p>
              )}

              {Array.isArray(a.rubrica) && a.rubrica.length > 0 && (
                <p className="mt-2 text-xs text-tinta/60">
                  <span className="font-semibold uppercase tracking-wide text-tinta/55">
                    Evalúa:{' '}
                  </span>
                  {a.rubrica
                    .map((c) => c.criterio)
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        abierto={formAbierto}
        onCerrar={() => setFormAbierto(false)}
        titulo={editando ? 'Editar asignación' : 'Nueva asignación'}
        size="ancho"
      >
        <AsignacionForm
          inicial={editando || {}}
          periodos={periodos}
          rubrosPorPeriodo={rubrosPP}
          asignacionesExistentes={asignaciones}
          clases={clases}
          periodoInicial={periodoActivo}
          onGuardar={handleGuardar}
          onCancelar={() => setFormAbierto(false)}
          textoBoton={editando ? 'Guardar cambios' : 'Crear asignación'}
        />
      </Modal>

      <Modal
        abierto={!!aBorrar}
        onCerrar={() => setABorrar(null)}
        titulo="Eliminar asignación"
      >
        <p className="text-sm text-tinta/80">
          ¿Seguro que querés eliminar{' '}
          <strong>{aBorrar?.titulo}</strong>? Se borrarán también todas las
          entregas asociadas. Esta acción no se puede deshacer.
        </p>
        <Alerta tipo="error">{error}</Alerta>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="btn-secundario"
            onClick={() => setABorrar(null)}
            disabled={borrando}
          >
            Cancelar
          </button>
          <button
            className="btn-primario !bg-margen hover:!bg-margen/90"
            onClick={confirmarBorrar}
            disabled={borrando}
          >
            {borrando ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// Formatea un timestamp ISO a fecha+hora legible en es-CR.
function formatearFecha(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
