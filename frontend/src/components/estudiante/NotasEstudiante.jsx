import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { periodosDeGrupo, etiquetaPeriodo } from '../../lib/periodos'
import { rubrosPorPeriodo } from '../../services/grupos.service'
import {
  calcularNotasPeriodo,
  redondear,
  porcentajeAsistencia,
  contarAsistencia,
  asignacionesHuerfanas,
} from '../../lib/notas'
import { rangoPeriodo } from '../../services/grupos.service'
import { listarAsistenciaGrupo } from '../../services/asistencia.service'
import { umbralDeModalidad, MIN_ASISTENCIA_AMPLIACION } from '../../lib/mep'

// Notas del estudiante en un grupo, por periodo.
// Props: grupo, items ([{asignacion, entrega}] de las asignaciones visibles).
export default function NotasEstudiante({ grupo, items }) {
  const { usuario } = useAuth()
  const periodos = periodosDeGrupo(grupo)
  const rubrosPP = rubrosPorPeriodo(grupo)
  const [periodoActivo, setPeriodoActivo] = useState(periodos[0] || 'I')
  const [asisRows, setAsisRows] = useState([]) // registros propios {fecha, estado}
  const umbral = grupo.mep_modalidad ? umbralDeModalidad(grupo.mep_modalidad) : null

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const rows = await listarAsistenciaGrupo(grupo.id) // RLS: solo las propias
        if (vivo) setAsisRows(rows.filter((r) => r.estudiante_id === usuario.id))
      } catch {
        if (vivo) setAsisRows([])
      }
    })()
    return () => {
      vivo = false
    }
  }, [grupo.id, usuario.id])

  const { porRubro, promedio, asis, presencia, huerfanas } = useMemo(() => {
    const rubros = rubrosPP[periodoActivo] || []
    const asigs = items
      .map((i) => i.asignacion)
      .filter((a) => a.periodo === periodoActivo)
    const entregaPorAsig = new Map(
      items.map((i) => [i.asignacion.id, i.entrega]),
    )
    const conteos = contarAsistencia(asisRows, rangoPeriodo(grupo, periodoActivo))
    const r = calcularNotasPeriodo(
      rubros,
      asigs,
      (aid) => entregaPorAsig.get(aid) || null,
      conteos,
    )
    // Actividades cuyo rubro ya no existe: no cuentan para la nota todavía.
    const huerfanas = asignacionesHuerfanas(rubros, asigs)
    // Presencia para la regla del 80% de ampliación (Art. 54): días que asistió
    // (presente o tardía) sobre el total de lecciones registradas.
    const totalDias =
      (conteos.presente || 0) +
      (conteos.ausente || 0) +
      (conteos.tardia || 0) +
      (conteos.justificada || 0)
    const presencia = totalDias
      ? ((conteos.presente + conteos.tardia) / totalDias) * 100
      : null
    return { ...r, asis: porcentajeAsistencia(conteos), presencia, huerfanas }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, periodoActivo, grupo, asisRows])

  // Se le muestra al estudiante el PROMEDIO sobre lo calificado (fácil de
  // entender: "¿qué nota llevo?"), no el acumulado (que arranca bajo y confunde).
  const aprobado = umbral != null && promedio != null && promedio >= umbral

  return (
    <div className="space-y-5">
      {/* Selector de periodo */}
      <div className="flex flex-wrap gap-1.5">
        {periodos.map((p) => (
          <button
            key={p}
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

      {porRubro.length === 0 ? (
        <p className="text-sm text-tinta/60">
          Tu profe aún no definió rubros para el {etiquetaPeriodo(periodoActivo)}.
        </p>
      ) : (
        <>
          {/* Rubros en 2 columnas (escritorio): llena el ancho y baja el scroll */}
          <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
            {porRubro.map((r) => {
              const asigsR = r.esAsistencia
                ? []
                : items.filter(
                    (i) =>
                      i.asignacion.periodo === periodoActivo &&
                      (i.asignacion.rubro || '') === r.nombre,
                  )
              return (
                <div
                  key={r.nombre}
                  className="rounded-cuaderno border border-tinta/15 bg-superficie px-5 py-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-tinta">{r.nombre}</h3>
                      <p className="mt-0.5 text-sm text-tinta/70">
                        Vale {r.porcentaje}% del periodo ·{' '}
                        {r.esAsistencia
                          ? `según tu asistencia${
                              asis != null ? ` (${redondear(asis, 0)}%)` : ''
                            }`
                          : `${r.calificadas} de ${r.total} calificada(s)`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-bold leading-none tabular-nums text-tinta">
                        {r.promedio == null ? (
                          <span className="text-tinta/55">—</span>
                        ) : (
                          redondear(r.promedio, 0)
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-tinta/65">
                        {r.promedio == null ? 'sin calificar' : 'de 100'}
                      </p>
                    </div>
                  </div>

                  {asigsR.length > 0 && (
                    <details className="group mt-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-cuaderno border border-tinta/12 bg-tinta/[0.03] px-3 py-2 text-sm font-medium text-tinta/70 transition-colors hover:border-pizarra/40 hover:text-pizarra">
                        <span>Ver actividades ({asigsR.length})</span>
                        <span
                          className="text-base leading-none transition-transform group-open:rotate-90"
                          aria-hidden="true"
                        >
                          ›
                        </span>
                      </summary>
                      <ul className="mt-2.5 space-y-2">
                      {asigsR.map(({ asignacion: a, entrega }) => {
                        const cal =
                          entrega?.estado === 'calificada' && entrega?.nota != null
                        return (
                          <li key={a.id} className="flex items-center gap-2.5 text-sm">
                            {cal ? (
                              <span
                                aria-hidden="true"
                                className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-pizarra text-[10px] font-bold text-papel"
                              >
                                ✓
                              </span>
                            ) : (
                              <span
                                aria-hidden="true"
                                className="grid h-4 w-4 shrink-0 place-items-center"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-tinta/40" />
                              </span>
                            )}
                            <span className="min-w-0 flex-1 truncate text-tinta/80">
                              {a.titulo}
                              {a.porcentaje != null && (
                                <span className="text-tinta/65"> · vale {a.porcentaje}%</span>
                              )}
                              {entrega?.tardia && a.penalizacion_tardia > 0 && (
                                <span className="text-tinta/70">
                                  {' '}· tarde −{a.penalizacion_tardia}%
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {cal ? (
                                <span className="font-semibold text-tinta">
                                  {entrega.nota}
                                  <span className="font-normal text-tinta/65">
                                    /{a.puntos}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-tinta/65">sin nota</span>
                              )}
                            </span>
                          </li>
                        )
                      })}
                      </ul>
                    </details>
                  )}
                  {!r.esAsistencia && asigsR.length === 0 && (
                    <p className="mt-2 text-sm text-tinta/65">
                      Aún no hay actividades en este rubro.
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Nota del periodo = promedio de lo calificado (0-100) */}
          <div className="flex items-center justify-between gap-3 rounded-cuaderno border-2 border-tinta/25 bg-superficie px-5 py-4 shadow-sm">
            <div>
              <p className="text-base font-bold text-tinta">
                Nota del {etiquetaPeriodo(periodoActivo)}
              </p>
              <p className="text-sm text-tinta/70">
                Promedio de lo que ya te calificaron
                {umbral != null && ` · mínimo para aprobar: ${umbral}`}
                {aprobado && (
                  <span className="font-semibold text-pizarra"> · Vas aprobando ✓</span>
                )}
              </p>
            </div>
            <p
              className={`shrink-0 text-3xl font-bold leading-none tabular-nums ${
                aprobado ? 'text-pizarra' : 'text-tinta'
              }`}
            >
              {promedio == null ? '—' : redondear(promedio, 0)}
              <span className="text-base font-semibold text-tinta/60"> / 100</span>
            </p>
          </div>

          {umbral != null && presencia != null && (
            <p className="text-sm text-tinta/60">
              Asistencia para pruebas de ampliación (mínimo 80%):{' '}
              <b className="text-tinta">{redondear(presencia, 0)}%</b>.
            </p>
          )}

          {huerfanas?.length > 0 && (
            <p className="text-sm text-tinta/70">
              Hay {huerfanas.length}{' '}
              {huerfanas.length === 1 ? 'actividad' : 'actividades'} que tu profe
              todavía no ubicó en un rubro, así que aún no cuentan para esta nota.
            </p>
          )}
        </>
      )}
    </div>
  )
}
