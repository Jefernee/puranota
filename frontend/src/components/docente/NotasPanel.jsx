import { useEffect, useMemo, useState } from 'react'
import Alerta from '../Alerta'
import { periodosDeGrupo, etiquetaPeriodo } from '../../lib/periodos'
import {
  rubrosPorPeriodo,
  rangoPeriodo,
  listarEstudiantes,
} from '../../services/grupos.service'
import { listarAsignaciones } from '../../services/asignaciones.service'
import { listarEntregasDeAsignaciones } from '../../services/entregas.service'
import { listarAsistenciaGrupo } from '../../services/asistencia.service'
import {
  calcularRegistro,
  contarAsistencia,
  diasRegistrados,
  pct,
} from '../../lib/notas'
import { umbralDeModalidad } from '../../lib/mep'

// REGISTRO DE CALIFICACIONES del grupo (ver docs/PLAN.md §3.6).
// Estudiantes en filas, actividades en columnas. Cada celda es la CALIFICACIÓN
// de esa actividad expresada en porcentaje del periodo; la columna NOTA es la
// suma de la fila. Props: grupo.

export default function NotasPanel({ grupo }) {
  const periodos = periodosDeGrupo(grupo)
  const rubrosPP = rubrosPorPeriodo(grupo)
  const umbral = grupo.mep_modalidad ? umbralDeModalidad(grupo.mep_modalidad) : null

  const [periodo, setPeriodo] = useState(periodos[0] || 'I')
  const [estudiantes, setEstudiantes] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [entregaMap, setEntregaMap] = useState(new Map())
  const [asisRows, setAsisRows] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

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
    [estudiantes, rubros, columnas, entregaMap, asisRows, periodo],
  )

  const hayAsistencia = filas.some((f) => f.asistencia)
  const avisos = filas[0]?.avisos || { rubro: [], sinValor: [] }

  // Promedio del grupo por columna y total.
  const promedio = (valores) => {
    const v = valores.filter((x) => x != null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }
  const promCol = columnas.map((a, i) =>
    promedio(filas.map((f) => f.filas[i]?.calificacion)),
  )
  const promAsis = promedio(filas.map((f) => f.asistencia?.calificacion))
  const promTotal = promedio(filas.map((f) => f.notaFinal))
  const evaluado = filas.length ? Math.max(...filas.map((f) => f.evaluado)) : 0

  const colorNota = (v) =>
    umbral == null || v == null ? 'text-tinta' : v >= umbral ? 'text-pizarra' : 'text-margen'

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
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
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
      ) : columnas.length === 0 && !hayAsistencia ? (
        <p className="text-sm text-tinta/60">
          No hay actividades en el {etiquetaPeriodo(periodo)} todavía.
        </p>
      ) : (
        <>
          {/* ── ESCRITORIO: registro completo, con la columna Estudiante fija ── */}
          <div className="hidden overflow-x-auto rounded-cuaderno border border-tinta/15 bg-superficie shadow-sm md:block">
            <table className="w-full text-[15px]">
              <thead>
                <tr className="border-b border-tinta/25 text-[13px] uppercase tracking-wide text-tinta/65">
                  <th className="sticky left-0 z-10 bg-superficie px-4 py-2.5 text-left font-semibold">
                    Estudiante
                  </th>
                  {columnas.map((a) => (
                    <th key={a.id} className="px-3 py-2.5 text-center font-semibold">
                      <span className="block max-w-[9rem] truncate" title={a.titulo}>
                        {a.titulo}
                      </span>
                      <span className="block text-[13px] font-normal normal-case text-tinta/60">
                        {a.porcentaje == null ? 'sin %' : `${a.porcentaje}%`}
                      </span>
                    </th>
                  ))}
                  {hayAsistencia && (
                    <th className="px-3 py-2.5 text-center font-semibold">
                      ✓ Asistencia
                      <span className="block text-[13px] font-normal normal-case text-tinta/60">
                        {filas[0]?.asistencia?.valor ?? 0}%
                      </span>
                    </th>
                  )}
                  <th className="px-4 py-2.5 text-center font-semibold">
                    Nota
                    <span className="block text-[13px] font-normal normal-case text-tinta/60">
                      /100%
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr
                    key={f.estudiante.id}
                    className="border-t border-tinta/10 even:bg-tinta/[0.02]"
                  >
                    <td className="sticky left-0 z-10 max-w-[14rem] truncate bg-superficie px-4 py-2 text-tinta even:bg-tinta/[0.02]">
                      {f.estudiante.nombre || f.estudiante.correo}
                    </td>
                    {f.filas.map((celda, i) => (
                      <td
                        key={columnas[i].id}
                        className="whitespace-nowrap px-3 py-2 text-center tabular-nums text-tinta/80"
                      >
                        <Celda fila={celda} />
                      </td>
                    ))}
                    {hayAsistencia && (
                      <td className="whitespace-nowrap px-3 py-2 text-center tabular-nums text-tinta/80">
                        {f.asistencia?.calificacion == null ? (
                          <span className="text-tinta/35">—</span>
                        ) : (
                          pct(f.asistencia.calificacion)
                        )}
                      </td>
                    )}
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
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-tinta/20 bg-tinta/[0.04] font-semibold">
                  <td className="sticky left-0 z-10 bg-tinta/[0.04] px-4 py-2 text-tinta">
                    Promedio del grupo
                  </td>
                  {promCol.map((p, i) => (
                    <td
                      key={columnas[i].id}
                      className="whitespace-nowrap px-3 py-2 text-center tabular-nums text-tinta/70"
                    >
                      {p == null ? '—' : pct(p)}
                    </td>
                  ))}
                  {hayAsistencia && (
                    <td className="whitespace-nowrap px-3 py-2 text-center tabular-nums text-tinta/70">
                      {promAsis == null ? '—' : pct(promAsis)}
                    </td>
                  )}
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
                  <ul className="mb-3 ml-6 space-y-1.5 border-l border-tinta/12 pl-3">
                    {f.filas.map((celda, i) => (
                      <li
                        key={columnas[i].id}
                        className="flex items-baseline justify-between gap-3 text-[15px]"
                      >
                        <span className="min-w-0 break-words text-tinta/75">
                          {columnas[i].titulo}
                          <span className="text-tinta/50">
                            {' '}
                            · {columnas[i].porcentaje ?? '—'}%
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums">
                          <Celda fila={celda} />
                        </span>
                      </li>
                    ))}
                    {f.asistencia && (
                      <li className="flex items-baseline justify-between gap-3 text-[15px]">
                        <span className="text-tinta/75">
                          Asistencia
                          <span className="text-tinta/50"> · {f.asistencia.valor}%</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-tinta/80">
                          {f.asistencia.calificacion == null
                            ? '—'
                            : pct(f.asistencia.calificacion)}
                        </span>
                      </li>
                    )}
                  </ul>
                </details>
              </li>
            ))}
          </ul>

        </>
      )}
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
