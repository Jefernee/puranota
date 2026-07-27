import { Fragment, useEffect, useMemo, useState } from 'react'
import Alerta from '../Alerta'
import { periodosDeGrupo, etiquetaPeriodo, periodoDeFecha } from '../../lib/periodos'
import {
  rubrosPorPeriodo,
  rangoPeriodo,
  listarEstudiantes,
  notasPublicadas,
  definirNotasPublicadas,
} from '../../services/grupos.service'
import { listarAsignaciones } from '../../services/asignaciones.service'
import { listarEntregasDeAsignaciones } from '../../services/entregas.service'
import { listarAsistenciaGrupo } from '../../services/asistencia.service'
import {
  calcularRegistro,
  contarAsistencia,
  diasRegistrados,
  estadoAprobacion,
  pesoDeLeccion,
  pct,
} from '../../lib/notas'
import { umbralDeModalidad } from '../../lib/mep'

// REGISTRO DE CALIFICACIONES del grupo (ver docs/PLAN.md §3.6).
//
// Estudiantes en filas y **rubros** en columnas: "Trabajo cotidiano 21,78%", no
// una columna por cada actividad. Con siete actividades la tabla ya no cabía y
// los títulos había que recortarlos; con veinte sería ilegible. Además, para
// leer el registro uno quiere el subtotal del rubro —que es lo que pide el
// MEP—, no cada tarea suelta.
//
// El detalle no se pierde: al tocar una fila se despliegan las actividades de
// ese estudiante, una por una, con su Valor % y su calificación.
//
// La columna NOTA sigue siendo la suma de la fila, que es la regla que hace
// verificable el registro. Props: grupo.

export default function NotasPanel({ grupo: grupoInicial }) {
  const [grupo, setGrupo] = useState(grupoInicial)
  const periodos = periodosDeGrupo(grupo)
  const rubrosPP = rubrosPorPeriodo(grupo)
  const umbral = grupo.mep_modalidad ? umbralDeModalidad(grupo.mep_modalidad) : null

  // Abre en el periodo que corresponde a HOY, no siempre en el primero: si el
  // docente pasa lista un 25 de julio y el registro abre en el I Periodo, no ve
  // reflejada esa asistencia y parece que el sistema no guardó nada.
  const [periodo, setPeriodo] = useState(() => periodoDeFecha(grupo))
  const [abierto, setAbierto] = useState(null) // id del estudiante desplegado
  const [estudiantes, setEstudiantes] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [entregaMap, setEntregaMap] = useState(new Map())
  const [asisRows, setAsisRows] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [cambiandoVisibilidad, setCambiandoVisibilidad] = useState(false)

  const publicadas = notasPublicadas(grupo, periodo)

  async function alternarPublicacion() {
    setCambiandoVisibilidad(true)
    setError('')
    try {
      setGrupo(await definirNotasPublicadas(grupo, periodo, !publicadas))
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar la visibilidad.')
    } finally {
      setCambiandoVisibilidad(false)
    }
  }

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      setError('')
      try {
        const [ests, asigs, asis] = await Promise.all([
          listarEstudiantes(grupo.id),
          listarAsignaciones(grupo.id, periodo),
          listarAsistenciaGrupo(grupo.id),
        ])
        const entregas = await listarEntregasDeAsignaciones(asigs.map((a) => a.id))
        if (!vivo) return
        setEstudiantes(ests.filter((m) => m.estado === 'activo' && m.estudiante))
        setAsignaciones(asigs)
        setEntregaMap(
          new Map(entregas.map((e) => [`${e.estudiante_id}|${e.asignacion_id}`, e])),
        )
        setAsisRows(asis)
      } catch (e) {
        if (vivo) setError(e?.message || 'No se pudieron cargar las notas.')
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [grupo.id, periodo])

  const rubros = rubrosPP[periodo] || []
  const rango = rangoPeriodo(grupo, periodo)
  // Cuánto vale cada día en lecciones (Art. 37): sin esto, faltar a un bloque
  // de 4 lecciones pesaría lo mismo que faltar a uno de 2.
  const peso = useMemo(() => pesoDeLeccion(grupo.lecciones_por_dia), [grupo])

  // Orden estable de las columnas: por fecha de entrega, igual que lo ve el
  // estudiante en su registro.
  const columnas = useMemo(
    () =>
      [...asignaciones].sort((a, b) => {
        if (!a.fecha_limite && !b.fecha_limite) return 0
        if (!a.fecha_limite) return 1
        if (!b.fecha_limite) return -1
        return new Date(a.fecha_limite) - new Date(b.fecha_limite)
      }),
    [asignaciones],
  )

  const filas = useMemo(
    () =>
      estudiantes.map((m) => {
        const sid = m.estudiante.id
        const conteos = contarAsistencia(
          asisRows.filter((r) => r.estudiante_id === sid),
          rango,
          peso,
        )
        const reg = calcularRegistro(
          rubros,
          columnas,
          (aid) => entregaMap.get(`${sid}|${aid}`) || null,
          diasRegistrados(conteos) > 0 ? conteos : null,
        )
        return { estudiante: m.estudiante, ...reg }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [estudiantes, rubros, columnas, entregaMap, asisRows, periodo, peso],
  )

  const avisos = filas[0]?.avisos || { rubro: [], sinValor: [] }

  // Los rubros del periodo son las columnas. Se leen del primer estudiante:
  // `calcularRegistro` los devuelve en el mismo orden para todos.
  const columnasRubro = filas[0]?.porRubro || []

  // Promedio del grupo por columna y total.
  const promedio = (valores) => {
    const v = valores.filter((x) => x != null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }
  const promRubro = columnasRubro.map((_, i) =>
    promedio(filas.map((f) => (f.porRubro[i]?.calificadas ? f.porRubro[i].obtenido : null))),
  )
  const promTotal = promedio(filas.map((f) => f.notaFinal))
  const evaluado = filas.length ? Math.max(...filas.map((f) => f.evaluado)) : 0

  // El color informa o no está (§5.5.3): verde solo cuando ya aprobó, rojo solo
  // cuando ya no le alcanza. A mitad de periodo, tinta.
  const colorNota = (v) =>
    ({ aprobado: 'text-pizarra', perdido: 'text-margen' })[
      estadoAprobacion(v, evaluado, umbral)
    ] || 'text-tinta'

  return (
    <div className="space-y-4">
      {/* Encabezado + selector de periodo */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-tinta/10 pb-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-tinta sm:text-xl">
            Registro de calificaciones
          </h2>
          {/* Encabezado de documento: los datos del registro en una línea, en vez
              de una explicación al pie de la tabla. */}
          <p className="mt-0.5 text-sm text-tinta/65">
            {estudiantes.length}{' '}
            {estudiantes.length === 1 ? 'estudiante' : 'estudiantes'} ·{' '}
            {columnas.length}{' '}
            {columnas.length === 1 ? 'actividad' : 'actividades'} · Evaluado{' '}
            <b className="text-tinta/80">{pct(evaluado, 0)}</b> de 100%
            {umbral != null && (
              <>
                {' '}
                · Mínimo para aprobar <b className="text-tinta/80">{umbral}</b>
              </>
            )}
            {!publicadas && (
              <>
                {' '}
                · <b className="text-ambar">notas ocultas</b>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Publicar o no las notas del periodo: el docente suele querer
              terminar de calificar a todo el grupo antes de que nadie vea la
              suya. Va acá, junto al selector, porque se decide por periodo. */}
          <button
            type="button"
            onClick={alternarPublicacion}
            disabled={cambiandoVisibilidad}
            title={
              publicadas
                ? 'Los estudiantes ven su calificación de este periodo'
                : 'Los estudiantes ven sus entregas, pero no su calificación'
            }
            className={`mr-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-cuaderno border px-3 text-[15px] font-semibold shadow-sm transition-colors disabled:opacity-50 ${
              publicadas
                ? 'border-tinta/15 bg-superficie text-tinta/70 hover:border-pizarra/40 hover:text-pizarra'
                : 'border-ambar/40 bg-ambar/10 text-ambar hover:bg-ambar/15'
            }`}
          >
            <Ojo abierto={publicadas} />
            {cambiandoVisibilidad
              ? 'Guardando…'
              : publicadas
                ? 'Ocultar notas'
                : 'Mostrar notas'}
          </button>

          {periodos.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              className={`min-h-[44px] rounded-cuaderno border px-4 text-[15px] font-semibold shadow-sm transition-colors ${
                periodo === p
                  ? 'border-pizarra bg-pizarra text-papel'
                  : 'border-tinta/15 bg-superficie text-tinta/70 hover:border-pizarra/40 hover:text-pizarra'
              }`}
              aria-current={periodo === p ? 'true' : undefined}
            >
              {etiquetaPeriodo(p)}
            </button>
          ))}
        </div>
      </div>

      <Alerta tipo="error">{error}</Alerta>

      {!cargando && avisos.rubro.length > 0 && (
        <Alerta tipo="advertencia">
          Hay {avisos.rubro.length}{' '}
          {avisos.rubro.length === 1 ? 'actividad' : 'actividades'} cuyo rubro ya no
          existe ({[...new Set(avisos.rubro.map((a) => `"${a.rubro}"`))].join(', ')}).
          Sus notas <b>no se están contando</b>. Editalas y asignales un rubro
          actual, o volvé a crear el rubro con ese nombre.
        </Alerta>
      )}
      {!cargando && avisos.sinValor.length > 0 && (
        <Alerta tipo="advertencia">
          Hay {avisos.sinValor.length}{' '}
          {avisos.sinValor.length === 1 ? 'actividad' : 'actividades'} sin{' '}
          <b>Valor %</b> ({avisos.sinValor.map((a) => `"${a.titulo}"`).join(', ')}).
          Mientras no tengan porcentaje, <b>no cuentan</b> para la nota.
        </Alerta>
      )}

      {cargando ? (
        <p className="text-[15px] text-tinta/70">Calculando notas…</p>
      ) : rubros.length === 0 ? (
        <Alerta tipo="info">
          Definí los rubros del {etiquetaPeriodo(periodo)} (pestaña Rubros) para
          poder calcular notas.
        </Alerta>
      ) : estudiantes.length === 0 ? (
        <p className="text-sm text-tinta/60">No hay estudiantes activos.</p>
      ) : columnasRubro.length === 0 ? (
        <p className="text-sm text-tinta/60">
          No hay actividades en el {etiquetaPeriodo(periodo)} todavía.
        </p>
      ) : (
        <>
          {/* ── ESCRITORIO: una columna por RUBRO. Tocá una fila para ver el
                detalle de las actividades de ese estudiante. ─────────────── */}
          <div className="hidden overflow-x-auto rounded-cuaderno border border-tinta/15 bg-superficie shadow-sm md:block">
            <table className="w-full text-[15px]">
              <thead>
                <tr className="border-b border-tinta/25 text-[13px] uppercase tracking-wide text-tinta/65">
                  <th className="px-4 py-2.5 text-left font-semibold">Estudiante</th>
                  {columnasRubro.map((r) => (
                    <th key={r.nombre} className="px-3 py-2.5 text-center font-semibold">
                      {/* Sin recortar: el nombre del rubro se ve completo, en
                          varias líneas si hace falta. */}
                      <span className="block">{r.nombre}</span>
                      <span className="block text-[13px] font-normal normal-case text-tinta/60">
                        {r.valor}%
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-center font-semibold">
                    Nota
                    <span className="block text-[13px] font-normal normal-case text-tinta/60">
                      /100%
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const desplegado = abierto === f.estudiante.id
                  return (
                    <Fragment key={f.estudiante.id}>
                      <tr
                        onClick={() => setAbierto(desplegado ? null : f.estudiante.id)}
                        className="cursor-pointer border-t border-tinta/10 even:bg-tinta/[0.02] hover:bg-pizarra/[0.06]"
                      >
                        <td className="px-4 py-2 text-tinta">
                          <span className="flex items-start gap-2">
                            <span
                              className={`mt-0.5 shrink-0 text-tinta/40 transition-transform ${desplegado ? 'rotate-90' : ''}`}
                              aria-hidden="true"
                            >
                              ›
                            </span>
                            <span className="break-words">
                              {f.estudiante.nombre || f.estudiante.correo}
                            </span>
                          </span>
                        </td>
                        {f.porRubro.map((r) => (
                          <td
                            key={r.nombre}
                            className="whitespace-nowrap px-3 py-2 text-center tabular-nums text-tinta/80"
                          >
                            {r.calificadas === 0 ? (
                              <span className="text-tinta/35">—</span>
                            ) : (
                              pct(r.obtenido)
                            )}
                          </td>
                        ))}
                        <td
                          className={`whitespace-nowrap px-4 py-2 text-center font-bold tabular-nums ${colorNota(f.notaFinal)}`}
                        >
                          {f.notaFinal == null ? (
                            <span className="text-tinta/35">—</span>
                          ) : (
                            pct(f.notaFinal)
                          )}
                        </td>
                      </tr>

                      {desplegado && (
                        <tr className="border-t border-tinta/10 bg-pizarra/[0.04]">
                          <td colSpan={columnasRubro.length + 2} className="px-4 py-3">
                            <Detalle registro={f} columnas={columnas} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-tinta/20 bg-tinta/[0.04] font-semibold">
                  <td className="px-4 py-2 text-tinta">Promedio del grupo</td>
                  {promRubro.map((p, i) => (
                    <td
                      key={columnasRubro[i].nombre}
                      className="whitespace-nowrap px-3 py-2 text-center tabular-nums text-tinta/70"
                    >
                      {p == null ? '—' : pct(p)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-2 text-center tabular-nums text-tinta">
                    {promTotal == null ? '—' : pct(promTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── MÓVIL: una fila por estudiante, desplegable ─────────────────── */}
          <ul className="divide-y divide-tinta/10 border-y border-tinta/15 md:hidden">
            {filas.map((f) => (
              <li key={f.estudiante.id}>
                <details className="group">
                  <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="text-tinta/40 transition-transform group-open:rotate-90"
                        aria-hidden="true"
                      >
                        ›
                      </span>
                      <span className="min-w-0 break-words font-medium text-tinta">
                        {f.estudiante.nombre || f.estudiante.correo}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-bold tabular-nums ${colorNota(f.notaFinal)}`}
                    >
                      {f.notaFinal == null ? '—' : pct(f.notaFinal)}
                    </span>
                  </summary>
                  <div className="mb-3 ml-6 border-l border-tinta/12 pl-3">
                    <Detalle registro={f} columnas={columnas} />
                  </div>
                </details>
              </li>
            ))}
          </ul>

        </>
      )}
    </div>
  )
}

// Ojo abierto o tachado, según si las notas se están mostrando. Es el único
// ícono del panel: acompaña al texto del botón, no lo reemplaza.
function Ojo({ abierto }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {abierto ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.2 6.2A17.7 17.7 0 0 0 2 12s3.5 7 10 7c2 0 3.7-.6 5.2-1.5" />
          <path d="M3 3l18 18" />
        </>
      )}
    </svg>
  )
}

/**
 * Detalle de un estudiante: sus actividades agrupadas por rubro, con el
 * subtotal de cada uno. Es lo que antes ocupaba una columna por actividad en la
 * tabla principal; acá cabe entero y sin recortar ningún título.
 */
function Detalle({ registro, columnas }) {
  const porNombre = new Map()
  for (const a of columnas) {
    const k = (a.rubro || '').trim()
    if (!porNombre.has(k)) porNombre.set(k, [])
    porNombre.get(k).push(a)
  }

  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {registro.porRubro.map((r) => {
        const suyas = r.esAsistencia ? [] : porNombre.get((r.nombre || '').trim()) || []
        return (
          <div key={r.nombre} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 border-b border-tinta/15 pb-1">
              <span className="min-w-0 break-words text-[13px] font-semibold uppercase tracking-wide text-tinta/70">
                {r.nombre}
                <span className="font-normal normal-case text-tinta/50"> · vale {r.valor}%</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-tinta">
                {r.calificadas === 0 ? '—' : pct(r.obtenido)}
              </span>
            </div>

            {r.esAsistencia ? (
              <p className="pt-1.5 text-[15px] text-tinta/70">
                {registro.asistencia?.conteos
                  ? `Se calcula sola · ${registro.asistencia.conteos.presente} presentes, ${registro.asistencia.conteos.ausente} ausencias, ${registro.asistencia.conteos.tardia} tardías`
                  : 'Todavía no hay lista pasada en este periodo.'}
              </p>
            ) : suyas.length === 0 ? (
              <p className="pt-1.5 text-[15px] text-tinta/55">Sin actividades.</p>
            ) : (
              <ul className="space-y-1 pt-1.5">
                {suyas.map((a) => {
                  const celda = registro.filas.find((x) => x.asignacion.id === a.id)
                  return (
                    <li
                      key={a.id}
                      className="flex items-baseline justify-between gap-3 text-[15px]"
                    >
                      {/* Título completo, en varias líneas si hace falta. */}
                      <span className="min-w-0 break-words text-tinta/75">
                        {a.titulo}
                        <span className="text-tinta/50"> · {a.porcentaje ?? '—'}%</span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        <Celda fila={celda} />
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Celda del registro: el número, o el motivo por el que no hay número. Nunca un
// número que no esté sumado en la Nota (esa es la regla que hace verificable el
// registro).
function Celda({ fila }) {
  if (!fila) return <span className="text-tinta/35">—</span>
  if (fila.noCuenta) {
    return (
      <span
        className="rounded-full bg-tinta/10 px-2 py-0.5 text-[13px] font-medium text-tinta/65 ring-1 ring-inset ring-tinta/20"
        title={
          fila.noCuenta === 'rubro'
            ? 'Su rubro ya no existe: no cuenta'
            : 'Sin Valor %: no cuenta'
        }
      >
        No cuenta
      </span>
    )
  }
  if (fila.calificacion != null) return <>{pct(fila.calificacion)}</>
  if (fila.entrega)
    return (
      <span className="rounded-full bg-tinta/10 px-2 py-0.5 text-[13px] font-medium text-tinta/65 ring-1 ring-inset ring-tinta/20">
        Sin revisar
      </span>
    )
  return <span className="text-tinta/35">—</span>
}
