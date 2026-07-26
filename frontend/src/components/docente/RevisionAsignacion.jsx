import { useEffect, useMemo, useState } from 'react'
import Volver from '../Volver'
import Modal from '../Modal'
import Alerta from '../Alerta'
import Cargando from '../Cargando'
import GaleriaArchivos from '../GaleriaArchivos'
import { etiquetaPeriodo } from '../../lib/periodos'
import { formatearFecha } from '../../lib/formato'
import { TONO_BADGE } from '../../lib/entregas'
import { obtenerAsignacion } from '../../services/asignaciones.service'
import { listarEstudiantes } from '../../services/grupos.service'
import {
  listarEntregasDeAsignacion,
  calificarEntrega,
  calificarPorEstudiante,
} from '../../services/entregas.service'

// Revisión de una asignación (lista de estudiantes, filtros y calificar).
// Se usa inline dentro de AsignacionesPanel (con `onVolver`) y también en la
// ruta /docente/asignaciones/:id (sin `onVolver` → muestra "Volver al grupo").
// Props: asignacionId, onVolver? (si viene, el volver es un botón inline).

// Estado de la entrega visto por el docente.
function estadoDocente(entrega, requiereEntrega = true) {
  if (!requiereEntrega) {
    if (entrega?.estado === 'calificada')
      return { clave: 'calificada', etiqueta: 'Calificada', tono: 'guaria' }
    return { clave: 'sin_entregar', etiqueta: 'Sin calificar', tono: 'tinta' }
  }
  if (!entrega) return { clave: 'sin_entregar', etiqueta: 'Sin entregar', tono: 'tinta' }
  if (entrega.estado === 'calificada')
    return { clave: 'calificada', etiqueta: 'Calificada', tono: 'guaria' }
  if (entrega.tardia)
    return { clave: 'tardia', etiqueta: 'Entregada tarde', tono: 'margen' }
  return { clave: 'entregada', etiqueta: 'Entregada', tono: 'pizarra' }
}

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'sin_entregar', label: 'Sin entregar' },
  { id: 'entregada', label: 'Entregadas' },
  { id: 'tardia', label: 'Tardías' },
  { id: 'calificada', label: 'Calificadas' },
]

export default function RevisionAsignacion({ asignacionId, onVolver }) {
  const [asignacion, setAsignacion] = useState(null)
  const [filas, setFilas] = useState([]) // [{estudiante, entrega}]
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [seleccion, setSeleccion] = useState(null) // fila abierta para calificar

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const a = await obtenerAsignacion(asignacionId)
      const [estudiantes, entregas] = await Promise.all([
        listarEstudiantes(a.grupo_id),
        listarEntregasDeAsignacion(asignacionId),
      ])
      const porEstudiante = new Map(entregas.map((e) => [e.estudiante_id, e]))
      const activos = estudiantes.filter((m) => m.estado === 'activo' && m.estudiante)
      setAsignacion(a)
      setFilas(
        activos.map((m) => ({
          estudiante: m.estudiante,
          entrega: porEstudiante.get(m.estudiante.id) || null,
        })),
      )
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la revisión.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asignacionId])

  const requiereEntrega = asignacion?.requiere_entrega !== false

  const conteos = useMemo(() => {
    const c = { todos: filas.length, sin_entregar: 0, entregada: 0, tardia: 0, calificada: 0 }
    for (const f of filas) c[estadoDocente(f.entrega, requiereEntrega).clave]++
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, requiereEntrega])

  const visibles = filas.filter(
    (f) =>
      filtro === 'todos' ||
      estadoDocente(f.entrega, requiereEntrega).clave === filtro,
  )

  function onCalificada(entregaActualizada) {
    setFilas((prev) =>
      prev.map((f) =>
        f.estudiante.id === entregaActualizada.estudiante_id
          ? { ...f, entrega: entregaActualizada }
          : f,
      ),
    )
    setSeleccion(null)
  }

  if (cargando) return <Cargando texto="Cargando entregas…" />

  if (error || !asignacion)
    return (
      <div>
        <Alerta tipo="error">{error || 'Asignación no encontrada.'}</Alerta>
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            className="mt-3 text-sm font-semibold text-pizarra hover:underline"
          >
            ← Asignaciones
          </button>
        )}
      </div>
    )

  return (
    <div>
      <div className="mb-5 border-b border-tinta/10 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          {onVolver ? (
            <Volver onClick={onVolver}>Asignaciones</Volver>
          ) : (
            <Volver to={`/docente/grupos/${asignacion.grupo_id}`}>
              Volver al grupo
            </Volver>
          )}
          <h1 className="min-w-0 truncate text-xl font-bold leading-tight sm:text-2xl">
            {asignacion.titulo}
          </h1>
        </div>
        <p className="mt-2 text-sm text-tinta/60">
          {etiquetaPeriodo(asignacion.periodo)}
          {' · '}
          <span className="font-semibold text-tinta/80">{asignacion.rubro}</span>
          {asignacion.porcentaje != null && ` · Vale ${asignacion.porcentaje}%`}
          {` · ${asignacion.puntos} pts`}
          {asignacion.fecha_limite &&
            ` · Límite ${formatearFecha(asignacion.fecha_limite, false)}`}
          {asignacion.clase && ` · Clase: ${asignacion.clase.titulo}`}
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-cuaderno border px-3.5 py-1.5 text-sm font-semibold shadow-sm transition-colors ${
              filtro === f.id
                ? 'border-pizarra bg-pizarra text-papel'
                : 'border-tinta/15 bg-superficie text-tinta/70 hover:border-pizarra/40 hover:text-pizarra'
            }`}
          >
            {f.label}{' '}
            <span className={filtro === f.id ? 'text-papel/70' : 'text-tinta/55'}>
              {conteos[f.id]}
            </span>
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-tinta/60">No hay estudiantes en este filtro.</p>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {visibles.map((f) => {
            const est = estadoDocente(f.entrega, requiereEntrega)
            // Solo se puede calificar si hay entrega, o si es prueba/nota directa
            // (requiere_entrega=false). Sin entrega en una actividad normal, no.
            const puedeCalificar = !requiereEntrega || !!f.entrega
            return (
              <li
                key={f.estudiante.id}
                className="tarjeta-cuaderno flex items-center justify-between gap-3 px-4 py-3 pl-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pizarra/10 text-sm font-bold text-pizarra">
                    {(f.estudiante.nombre?.trim()?.[0] || '?').toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-tinta">
                      {f.estudiante.nombre || f.estudiante.correo}
                    </p>
                    <p className="truncate text-sm text-tinta/65">
                      {f.entrega?.estado === 'calificada' && f.entrega.nota != null
                        ? `Nota: ${f.entrega.nota} / ${asignacion.puntos}`
                        : f.entrega
                          ? `Entregó: ${formatearFecha(f.entrega.entregado_en)}`
                          : 'Sin entregar todavía'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${TONO_BADGE[est.tono]}`}
                  >
                    {est.etiqueta}
                  </span>
                  {puedeCalificar && (
                    <button
                      className={`px-3 py-1.5 text-sm ${
                        f.entrega?.estado === 'calificada'
                          ? 'btn-secundario'
                          : 'btn-primario'
                      }`}
                      onClick={() => setSeleccion(f)}
                    >
                      {f.entrega?.estado === 'calificada' ? 'Revisar' : 'Calificar'}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        abierto={!!seleccion}
        onCerrar={() => setSeleccion(null)}
        titulo={seleccion?.estudiante?.nombre || 'Entrega'}
        size="ancho"
      >
        {seleccion && (
          <PanelCalificar
            asignacion={asignacion}
            fila={seleccion}
            onCalificada={onCalificada}
          />
        )}
      </Modal>
    </div>
  )
}

function PanelCalificar({ asignacion, fila, onCalificada }) {
  const entrega = fila.entrega
  const requiereEntrega = asignacion.requiere_entrega !== false
  const [nota, setNota] = useState(entrega?.nota ?? '')
  const [observaciones, setObservaciones] = useState(entrega?.observaciones || '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function handleGuardar() {
    setError('')
    const n = Number(nota)
    if (nota === '' || Number.isNaN(n)) {
      setError('Escribí una nota.')
      return
    }
    if (n < 0 || n > asignacion.puntos) {
      setError(`La nota debe estar entre 0 y ${asignacion.puntos}.`)
      return
    }
    setGuardando(true)
    try {
      const act = entrega?.id
        ? await calificarEntrega(entrega.id, { nota: n, observaciones })
        : await calificarPorEstudiante(asignacion.id, fila.estudiante.id, {
            nota: n,
            observaciones,
          })
      onCalificada(act)
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la nota.')
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-4">
      {requiereEntrega ? (
        <div>
          <p className="mb-2 text-sm font-medium text-tinta/80">Archivos entregados</p>
          {entrega?.archivos?.length ? (
            <GaleriaArchivos archivos={entrega.archivos} />
          ) : (
            <p className="text-sm text-tinta/65">
              El estudiante no entregó archivos. Podés ponerle la nota igual.
            </p>
          )}
          {entrega?.tardia && (
            <p className="mt-2 text-xs text-margen">Esta entrega fue tardía.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-tinta/65">
          Prueba escrita / nota directa: el estudiante no entrega archivos.
        </p>
      )}

      <div>
        <label htmlFor="nota" className="etiqueta">
          Nota (de 0 a {asignacion.puntos})
        </label>
        <input
          id="nota"
          type="number"
          min="0"
          max={asignacion.puntos}
          step="0.5"
          className="campo sm:max-w-[10rem]"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="obs" className="etiqueta">
          Observaciones
        </label>
        <textarea
          id="obs"
          className="campo min-h-[90px] resize-y"
          placeholder="Retroalimentación para el estudiante…"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </div>

      <Alerta tipo="error">{error}</Alerta>

      <div className="flex justify-end">
        <button className="btn-primario" onClick={handleGuardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar nota'}
        </button>
      </div>
    </div>
  )
}
