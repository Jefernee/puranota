import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Alerta from '../Alerta'
import { periodosDeGrupo, etiquetaPeriodo } from '../../lib/periodos'
import { rubrosPorPeriodo, rangoPeriodo } from '../../services/grupos.service'
import { listarAsistenciaGrupo } from '../../services/asistencia.service'
import {
  calcularRegistro,
  contarAsistencia,
  diasRegistrados,
  porcentajePresencia,
  pct,
} from '../../lib/notas'
import { tipoDe, estadoRegistro, TONO_BADGE } from '../../lib/entregas'
import { umbralDeModalidad, MIN_ASISTENCIA_AMPLIACION } from '../../lib/mep'

// REGISTRO DE EVALUACIÓN del estudiante (ver docs/PLAN.md §3.3 y §3.4).
// Reemplaza a las pestañas "Asignaciones" y "Notas": desde acá se ve el estado,
// se entra a entregar y se ve la calificación. Una sola verdad.
// Props: grupo, items ([{asignacion, entrega}] de todas las actividades visibles).

const FECHA_CORTA = { day: '2-digit', month: '2-digit', year: 'numeric' }

function fechaHora(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString('es-CR', FECHA_CORTA)} ${d.toLocaleTimeString('es-CR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`
}

export default function EvaluacionEstudiante({ grupo, items, clases = [] }) {
  const { usuario } = useAuth()
  // Título de la clase a la que pertenece cada actividad, para el subtítulo de
  // la fila (las asignaciones traen `clase_id`, no el título).
  const tituloClase = useMemo(
    () => new Map(clases.map((c) => [c.id, c.titulo])),
    [clases],
  )
  const periodos = periodosDeGrupo(grupo)
  const rubrosPP = rubrosPorPeriodo(grupo)
  const umbral = grupo.mep_modalidad ? umbralDeModalidad(grupo.mep_modalidad) : null

  const [periodo, setPeriodo] = useState(periodos[0] || 'I')
  const [asisRows, setAsisRows] = useState([])

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

  const reg = useMemo(() => {
    const delPeriodo = items.filter((i) => i.asignacion.periodo === periodo)
    const entregaPorId = new Map(delPeriodo.map((i) => [i.asignacion.id, i.entrega]))
    const conteos = contarAsistencia(asisRows, rangoPeriodo(grupo, periodo))
    return {
      ...calcularRegistro(
        rubrosPP[periodo] || [],
        delPeriodo.map((i) => i.asignacion),
        (id) => entregaPorId.get(id) || null,
        diasRegistrados(conteos) > 0 ? conteos : null,
      ),
      conteos,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, periodo, grupo, asisRows])

  const { filas, asistencia, notaFinal, evaluado, porRubro, avisos, conteos } = reg
  const hayRubros = (rubrosPP[periodo] || []).length > 0
  const aprueba = umbral != null && notaFinal != null && notaFinal >= umbral
  const presencia = porcentajePresencia(conteos)

  // Orden del registro: por fecha de entrega (las sin fecha, al final).
  const ordenadas = [...filas].sort((a, a2) => {
    const f1 = a.asignacion.fecha_limite
    const f2 = a2.asignacion.fecha_limite
    if (!f1 && !f2) return 0
    if (!f1) return 1
    if (!f2) return -1
    return new Date(f1) - new Date(f2)
  })

  return (
    <div className="space-y-5">
      {/* Encabezado de sección + selector de periodo */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-tinta/10 pb-3">
        <div>
          <h2 className="text-lg font-bold text-tinta">Evaluación</h2>
          <p className="text-sm text-tinta/65">
            Entregas, pruebas y proyectos del {etiquetaPeriodo(periodo)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {periodos.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              className={`rounded-cuaderno border px-3.5 py-2 text-sm font-semibold shadow-sm transition-colors ${
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

      {avisos.rubro.length > 0 && (
        <Alerta tipo="advertencia">
          {avisos.rubro.length === 1 ? 'Hay 1 actividad' : `Hay ${avisos.rubro.length} actividades`}{' '}
          con un rubro que ya no existe, así que <b>todavía no cuentan</b> para la
          nota. Avisale a tu profe.
        </Alerta>
      )}
      {avisos.sinValor.length > 0 && (
        <Alerta tipo="advertencia">
          {avisos.sinValor.length === 1
            ? 'Hay 1 actividad sin porcentaje asignado'
            : `Hay ${avisos.sinValor.length} actividades sin porcentaje asignado`}
          , así que <b>todavía no cuentan</b> para la nota. Avisale a tu profe.
        </Alerta>
      )}

      {!hayRubros ? (
        <Alerta tipo="info">
          Tu profe aún no definió los rubros del {etiquetaPeriodo(periodo)}, así que
          todavía no se puede calcular la nota.
        </Alerta>
      ) : ordenadas.length === 0 && !asistencia ? (
        <p className="text-sm text-tinta/60">
          No hay actividades en el {etiquetaPeriodo(periodo)} todavía.
        </p>
      ) : (
        <>
          {/* ── ESCRITORIO: tabla de registro ─────────────────────────────── */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tinta/25 text-[11px] uppercase tracking-wide text-tinta/60">
                  <th className="w-10 py-2.5 pl-1 text-left font-semibold">Tipo</th>
                  <th className="py-2.5 pl-2 pr-4 text-left font-semibold">Actividad</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-left font-semibold">
                    Fecha/Hora entrega
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">Estado</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                    Valor %
                  </th>
                  <th className="whitespace-nowrap py-2.5 pl-3 pr-1 text-right font-semibold">
                    Calificación
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((f) => (
                  <FilaActividad
                    key={f.asignacion.id}
                    fila={f}
                    claseTitulo={tituloClase.get(f.asignacion.clase_id)}
                  />
                ))}
                {asistencia && (
                  <FilaAsistencia asistencia={asistencia} conteos={conteos} />
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-tinta/25">
                  <td colSpan={4} />
                  <td className="whitespace-nowrap px-3 pt-3 text-right text-sm font-bold uppercase tracking-wide text-tinta">
                    Nota final:
                  </td>
                  <td className="whitespace-nowrap py-3 pl-3 pr-1 text-right">
                    <span
                      className={`text-lg font-bold tabular-nums ${
                        aprueba ? 'text-pizarra' : 'text-tinta'
                      }`}
                    >
                      {notaFinal == null ? '—' : pct(notaFinal)}
                    </span>
                    <span className="text-sm font-semibold text-tinta/55">/100%</span>
                  </td>
                </tr>
                <tr>
                  <td colSpan={6} className="pb-1 pr-1 text-right text-xs text-tinta/60">
                    Evaluado hasta hoy: <b className="text-tinta/75">{pct(evaluado, 0)}</b>
                    {umbral != null && (
                      <> · mínimo para aprobar: <b className="text-tinta/75">{umbral}</b></>
                    )}
                    {aprueba && <span className="font-semibold text-pizarra"> · vas aprobando ✓</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── MÓVIL: mismo registro, compacto (no tarjetas grandes) ─────── */}
          <div className="md:hidden">
            <ul className="divide-y divide-tinta/10 border-y border-tinta/15">
              {ordenadas.map((f) => (
                <FilaMovil
                  key={f.asignacion.id}
                  fila={f}
                  claseTitulo={tituloClase.get(f.asignacion.clase_id)}
                />
              ))}
              {asistencia && (
                <FilaMovilAsistencia asistencia={asistencia} conteos={conteos} />
              )}
            </ul>
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t-2 border-tinta/25 pt-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-tinta">
                  Nota final
                </p>
                <p className="text-xs text-tinta/60">
                  Evaluado hasta hoy: <b className="text-tinta/75">{pct(evaluado, 0)}</b>
                  {umbral != null && <> · mínimo {umbral}</>}
                </p>
              </div>
              <p
                className={`shrink-0 text-2xl font-bold leading-none tabular-nums ${
                  aprueba ? 'text-pizarra' : 'text-tinta'
                }`}
              >
                {notaFinal == null ? '—' : pct(notaFinal)}
                <span className="text-sm font-semibold text-tinta/55">/100%</span>
              </p>
            </div>
          </div>

          {/* ── Resumen por rubro (lo que pide el registro del MEP) ───────── */}
          {porRubro.length > 0 && (
            <section className="rounded-cuaderno border border-tinta/12 bg-tinta/[0.02] px-4 py-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta/60">
                Resumen por rubro
              </h3>
              <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {porRubro.map((r) => (
                  <li
                    key={r.nombre}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 truncate text-tinta/80">
                      {r.nombre}
                      <span className="text-tinta/50"> · vale {r.valor}%</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-tinta">
                      {pct(r.obtenido)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {umbral != null && presencia != null && (
            <p className="text-sm text-tinta/60">
              Asistencia para pruebas de ampliación (mínimo{' '}
              {Math.round(MIN_ASISTENCIA_AMPLIACION * 100)}%):{' '}
              <b className="text-tinta">{pct(presencia, 0)}</b>.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Celda de calificación: el número, o el motivo por el que no hay número ───

function CeldaCalificacion({ fila }) {
  if (fila.noCuenta === 'rubro' || fila.noCuenta === 'sin_valor') {
    return (
      <span
        className="rounded-full bg-tinta/10 px-2 py-1 text-xs font-medium text-tinta/60 ring-1 ring-inset ring-tinta/20"
        title={
          fila.noCuenta === 'rubro'
            ? 'Su rubro ya no existe: no cuenta para la nota'
            : 'Sin porcentaje asignado: no cuenta para la nota'
        }
      >
        No cuenta
      </span>
    )
  }
  if (fila.calificacion != null) {
    return (
      <span className="font-bold tabular-nums text-tinta">{pct(fila.calificacion)}</span>
    )
  }
  if (fila.entrega) {
    return (
      <span className="rounded-full bg-tinta/10 px-2 py-1 text-xs font-medium text-tinta/65 ring-1 ring-inset ring-tinta/20">
        No revisado
      </span>
    )
  }
  return <span className="text-tinta/35">—</span>
}

function Subtitulo({ asignacion, tipo, claseTitulo }) {
  const partes = [tipo.label, asignacion.rubro, claseTitulo].filter(Boolean)
  return <span className="italic text-tinta/55">{partes.join(' · ')}</span>
}

// ─── Fila de actividad (escritorio) ───────────────────────────────────────────

function FilaActividad({ fila, claseTitulo }) {
  const a = fila.asignacion
  const tipo = tipoDe(a)
  const est = estadoRegistro(a, fila.entrega)
  return (
    <tr className="border-b border-tinta/10 transition-colors hover:bg-tinta/[0.03]">
      <td className="py-2.5 pl-1 align-top">
        <span
          className={`grid h-6 w-6 place-items-center rounded-full text-xs ${tipo.clase}`}
          title={tipo.label}
          aria-hidden="true"
        >
          {tipo.icono}
        </span>
      </td>
      <td className="py-2.5 pl-2 pr-4 align-top">
        <Link
          to={`/estudiante/asignaciones/${a.id}`}
          className="font-medium text-pizarra hover:underline"
        >
          {a.titulo}
        </Link>
        <span className="block text-xs">
          <Subtitulo asignacion={a} tipo={tipo} claseTitulo={claseTitulo} />
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-tinta/70">
        {fechaHora(a.fecha_limite)}
      </td>
      <td className="px-3 py-2.5 align-top">
        <span
          className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${TONO_BADGE[est.tono]}`}
        >
          {est.etiqueta}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-tinta/70">
        {fila.valor == null ? '—' : `${fila.valor}%`}
      </td>
      <td className="whitespace-nowrap py-2.5 pl-3 pr-1 text-right align-top">
        <CeldaCalificacion fila={fila} />
      </td>
    </tr>
  )
}

function FilaAsistencia({ asistencia, conteos }) {
  return (
    <tr className="border-b border-tinta/10 bg-tinta/[0.015]">
      <td className="py-2.5 pl-1 align-top">
        <span
          className="grid h-6 w-6 place-items-center rounded-full bg-pizarra/12 text-xs text-pizarra"
          aria-hidden="true"
        >
          ✓
        </span>
      </td>
      <td className="py-2.5 pl-2 pr-4 align-top">
        <span className="font-medium text-tinta">Asistencia</span>
        <span className="block text-xs italic text-tinta/55">
          Se calcula sola · {conteos.presente} presentes, {conteos.ausente} ausencias
          {conteos.tardia > 0 && `, ${conteos.tardia} tardías`}
        </span>
      </td>
      <td className="px-3 py-2.5 align-top text-tinta/40">—</td>
      <td className="px-3 py-2.5 align-top">
        <span
          className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${TONO_BADGE.tinta}`}
        >
          Automática
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-tinta/70">
        {asistencia.valor == null ? '—' : `${asistencia.valor}%`}
      </td>
      <td className="whitespace-nowrap py-2.5 pl-3 pr-1 text-right align-top">
        {asistencia.calificacion == null ? (
          <span className="text-tinta/35">—</span>
        ) : (
          <span className="font-bold tabular-nums text-tinta">
            {pct(asistencia.calificacion)}
          </span>
        )}
      </td>
    </tr>
  )
}

// ─── Fila compacta (móvil) ────────────────────────────────────────────────────

function FilaMovil({ fila, claseTitulo }) {
  const a = fila.asignacion
  const tipo = tipoDe(a)
  const est = estadoRegistro(a, fila.entrega)
  return (
    <li>
      <Link to={`/estudiante/asignaciones/${a.id}`} className="flex gap-3 py-3">
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${tipo.clase}`}
          aria-hidden="true"
        >
          {tipo.icono}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate font-medium text-tinta">{a.titulo}</span>
            <span className="shrink-0 text-xs tabular-nums text-tinta/60">
              {fila.valor == null ? '—' : `${fila.valor}%`}
            </span>
          </span>
          <span className="mt-0.5 flex items-baseline justify-between gap-2 text-xs">
            <span className="min-w-0 truncate">
              <Subtitulo asignacion={a} tipo={tipo} claseTitulo={claseTitulo} />
            </span>
            <span className="shrink-0">
              <CeldaCalificacion fila={fila} />
            </span>
          </span>
          <span className="mt-1 block text-xs tabular-nums text-tinta/55">
            {fechaHora(a.fecha_limite)} · {est.etiqueta}
          </span>
        </span>
      </Link>
    </li>
  )
}

function FilaMovilAsistencia({ asistencia, conteos }) {
  return (
    <li className="flex gap-3 py-3">
      <span
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-pizarra/12 text-xs text-pizarra"
        aria-hidden="true"
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-medium text-tinta">Asistencia</span>
          <span className="shrink-0 text-xs tabular-nums text-tinta/60">
            {asistencia.valor == null ? '—' : `${asistencia.valor}%`}
          </span>
        </span>
        <span className="mt-0.5 flex items-baseline justify-between gap-2 text-xs">
          <span className="italic text-tinta/55">Se calcula sola</span>
          <span className="shrink-0 font-bold tabular-nums text-tinta">
            {asistencia.calificacion == null ? '—' : pct(asistencia.calificacion)}
          </span>
        </span>
        <span className="mt-1 block text-xs text-tinta/55">
          {conteos.presente} presentes, {conteos.ausente} ausencias
          {conteos.tardia > 0 && `, ${conteos.tardia} tardías`}
        </span>
      </span>
    </li>
  )
}
