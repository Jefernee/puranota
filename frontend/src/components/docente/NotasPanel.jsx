import { useEffect, useMemo, useState } from 'react'
import Alerta from '../Alerta'
import { periodosDeGrupo, etiquetaPeriodo } from '../../lib/periodos'
import { rubrosPorPeriodo } from '../../services/grupos.service'
import {
  calcularNotasPeriodo,
  redondear,
  contarAsistencia,
  asignacionesHuerfanas,
} from '../../lib/notas'
import { umbralDeModalidad } from '../../lib/mep'
import { listarEstudiantes, rangoPeriodo } from '../../services/grupos.service'
import { listarAsignaciones } from '../../services/asignaciones.service'
import { listarEntregasDeAsignaciones } from '../../services/entregas.service'
import { listarAsistenciaGrupo } from '../../services/asistencia.service'

// Cuadro de notas del grupo por periodo. Props: grupo.
export default function NotasPanel({ grupo }) {
  const periodos = periodosDeGrupo(grupo)
  const rubrosPP = rubrosPorPeriodo(grupo)
  const umbral = grupo.mep_modalidad ? umbralDeModalidad(grupo.mep_modalidad) : null
  // Verde (aprueba) si llega al mínimo del MEP; rojo si va por debajo.
  const colorNota = (v) =>
    umbral == null || v == null
      ? 'text-tinta'
      : v >= umbral
        ? 'text-pizarra'
        : 'text-margen'

  const [periodoActivo, setPeriodoActivo] = useState(periodos[0] || 'I')
  const [estudiantes, setEstudiantes] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [entregaMap, setEntregaMap] = useState(new Map())
  const [asisRows, setAsisRows] = useState([]) // registros crudos {estudiante_id, fecha, estado}
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      setCargando(true)
      setError('')
      try {
        const [ests, asigs, asisRows] = await Promise.all([
          listarEstudiantes(grupo.id),
          listarAsignaciones(grupo.id, periodoActivo),
          listarAsistenciaGrupo(grupo.id),
        ])
        const entregas = await listarEntregasDeAsignaciones(asigs.map((a) => a.id))
        if (!vivo) return

        const mapa = new Map(
          entregas.map((e) => [`${e.estudiante_id}|${e.asignacion_id}`, e]),
        )

        setEstudiantes(ests.filter((m) => m.estado === 'activo' && m.estudiante))
        setAsignaciones(asigs)
        setEntregaMap(mapa)
        setAsisRows(asisRows)
      } catch (e) {
        if (vivo) setError(e?.message || 'No se pudieron cargar las notas.')
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => {
      vivo = false
    }
  }, [grupo.id, periodoActivo])

  const rubros = rubrosPP[periodoActivo] || []
  const rango = rangoPeriodo(grupo, periodoActivo)

  // Asignaciones cuyo rubro ya no existe (renombrado/borrado): sus notas NO
  // cuentan en el total. Se avisa para que el docente las reubique.
  const huerfanas = asignacionesHuerfanas(rubros, asignaciones)
  const rubrosHuerfanos = [...new Set(huerfanas.map((a) => (a.rubro || '').trim()))]

  const filas = useMemo(() => {
    return estudiantes.map((m) => {
      const sid = m.estudiante.id
      const conteos = contarAsistencia(
        asisRows.filter((r) => r.estudiante_id === sid),
        rango,
      )
      const { porRubro, promedio } = calcularNotasPeriodo(
        rubros,
        asignaciones,
        (aid) => entregaMap.get(`${sid}|${aid}`) || null,
        conteos,
      )
      return { estudiante: m.estudiante, porRubro, promedio }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estudiantes, rubros, asignaciones, entregaMap, asisRows, periodoActivo])

  // Promedio del grupo por rubro y total (para la fila de resumen).
  const promsRubro = rubros.map((_, i) => {
    const vals = filas.map((f) => f.porRubro[i]?.promedio).filter((v) => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  })
  const promTotal = (() => {
    const vals = filas.map((f) => f.promedio).filter((v) => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  })()

  return (
    <div className="space-y-4">
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

      <Alerta tipo="error">{error}</Alerta>

      {!cargando && rubrosHuerfanos.length > 0 && (
        <Alerta tipo="advertencia">
          Hay {huerfanas.length}{' '}
          {huerfanas.length === 1 ? 'asignación' : 'asignaciones'} con un rubro que
          ya no existe ({rubrosHuerfanos.map((r) => `"${r}"`).join(', ')}). Sus
          notas <b>no se están contando</b> en el total. Editá esas asignaciones y
          asignales un rubro actual, o volvé a crear el rubro con ese nombre.
        </Alerta>
      )}

      {cargando ? (
        <p className="text-sm text-tinta/65">Calculando notas…</p>
      ) : rubros.length === 0 ? (
        <Alerta tipo="info">
          Definí los rubros del {etiquetaPeriodo(periodoActivo)} (pestaña Rubros)
          para poder calcular notas.
        </Alerta>
      ) : estudiantes.length === 0 ? (
        <p className="text-sm text-tinta/60">No hay estudiantes activos.</p>
      ) : (
        <>
          {/* Móvil: una tarjeta por estudiante */}
          <ul className="space-y-2 md:hidden">
            {filas.map((f) => (
              <li
                key={f.estudiante.id}
                className="rounded-cuaderno border border-tinta/15 bg-superficie px-4 py-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold text-tinta">
                    {f.estudiante.nombre || f.estudiante.correo}
                  </span>
                  <span
                    className={`shrink-0 text-lg font-bold tabular-nums ${colorNota(f.promedio)}`}
                  >
                    {f.promedio == null ? '—' : redondear(f.promedio)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-tinta/60">
                  {f.porRubro.map((r) => (
                    <span key={r.nombre}>
                      {r.nombre}:{' '}
                      <b className="tabular-nums text-tinta/80">
                        {r.promedio == null ? '—' : redondear(r.promedio)}
                      </b>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla */}
          <div className="hidden overflow-x-auto rounded-cuaderno border border-tinta/15 bg-superficie shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tinta/10 text-xs uppercase tracking-wide text-tinta/65">
                  <th className="px-4 py-2.5 text-left font-semibold">Estudiante</th>
                  {rubros.map((r) => (
                    <th key={r.nombre} className="px-3 py-2.5 text-center font-semibold">
                      {r.nombre}
                      <span className="block text-[11px] font-normal normal-case text-tinta/60">
                        {r.porcentaje}%
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-center font-semibold">
                    Nota
                    <span className="block text-[11px] font-normal normal-case text-tinta/60">
                      / 100
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
                    <td className="px-4 py-2 text-tinta">
                      {f.estudiante.nombre || f.estudiante.correo}
                    </td>
                    {f.porRubro.map((r) => (
                      <td
                        key={r.nombre}
                        className="whitespace-nowrap px-3 py-2 text-center tabular-nums text-tinta/80"
                      >
                        {r.promedio == null ? (
                          <span className="text-tinta/35">—</span>
                        ) : (
                          redondear(r.promedio)
                        )}
                      </td>
                    ))}
                    <td
                      className={`px-4 py-2 text-center font-bold tabular-nums ${colorNota(f.promedio)}`}
                    >
                      {f.promedio == null ? (
                        <span className="text-tinta/35">—</span>
                      ) : (
                        redondear(f.promedio)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-tinta/20 bg-tinta/[0.03] font-semibold">
                  <td className="px-4 py-2 text-tinta">Promedio del grupo</td>
                  {promsRubro.map((p, i) => (
                    <td
                      key={rubros[i].nombre}
                      className="px-3 py-2 text-center tabular-nums text-tinta/70"
                    >
                      {p == null ? '—' : redondear(p)}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-center tabular-nums text-tinta">
                    {promTotal == null ? '—' : redondear(promTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      <p className="text-sm text-tinta/65">
        Cada celda es el <b>porcentaje que aporta</b> ese rubro; la <b>Nota</b> es
        la suma de todos.
        {umbral != null && (
          <>
            {' '}
            Mínimo de aprobación: {umbral} —{' '}
            <span className="text-pizarra">verde</span> aprueba,{' '}
            <span className="text-margen">rojo</span> va por debajo.
          </>
        )}
      </p>
    </div>
  )
}
