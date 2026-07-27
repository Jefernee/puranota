import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Alerta from '../Alerta'
import { periodosDeGrupo, etiquetaPeriodo, periodoDeFecha } from '../../lib/periodos'
import {
  rubrosPorPeriodo,
  rangoPeriodo,
  notasPublicadas,
} from '../../services/grupos.service'
import { listarAsistenciaGrupo } from '../../services/asistencia.service'
import {
  calcularRegistro,
  contarAsistencia,
  diasRegistrados,
  porcentajePresencia,
  pesoDeLeccion,
  pct,
} from '../../lib/notas'
import { tipoDe, estadoRegistro, TONO_BADGE } from '../../lib/entregas'
import IconoTipo from '../IconoTipo'
import { umbralDeModalidad, MIN_ASISTENCIA_AMPLIACION } from '../../lib/mep'

// REGISTRO DE EVALUACIÓN del estudiante (ver docs/PLAN.md §3.3 y §3.4).
// Reemplaza a las pestañas "Asignaciones" y "Notas": desde acá se ve el estado,
// se entra a entregar y se ve la calificación. Una sola verdad.
//
// DOS REGLAS DE INTERFAZ QUE NO SE AFLOJAN:
// 1. Lo que se puede tocar TIENE que parecerlo: la fila entera es tocable, el
//    título va subrayado y hay una flecha a la derecha.
// 2. Nada de letra diminuta. El cuerpo del registro va en 15-16px y lo
//    secundario en 14px; por debajo de eso no se lee en un celular.
//
// Props: grupo, items ([{asignacion, entrega}]), clases (para el subtítulo).

const FECHA_CORTA = { day: '2-digit', month: '2-digit', year: 'numeric' }

function fechaHora(iso, conAnio = true) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const f = d.toLocaleDateString('es-CR', conAnio ? FECHA_CORTA : { day: '2-digit', month: '2-digit' })
  const h = d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${f} ${h}`
}

export default function EvaluacionEstudiante({ grupo, items, clases = [] }) {
  const { usuario } = useAuth()
  const tituloClase = useMemo(
    () => new Map(clases.map((c) => [c.id, c.titulo])),
    [clases],
  )
  const periodos = periodosDeGrupo(grupo)
  const rubrosPP = rubrosPorPeriodo(grupo)
  const umbral = grupo.mep_modalidad ? umbralDeModalidad(grupo.mep_modalidad) : null

  // Abre en el periodo de hoy, igual que el registro del docente: si abriera
  // siempre en el I, en agosto el estudiante vería un periodo que ya cerró.
  const [periodo, setPeriodo] = useState(() => periodoDeFecha(grupo))
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
    const conteos = contarAsistencia(
      asisRows,
      rangoPeriodo(grupo, periodo),
      pesoDeLeccion(grupo.lecciones_por_dia),
    )
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
  // El docente puede no haber publicado todavía las notas de este periodo. Se
  // sigue viendo qué se entregó y cuándo; lo que se guarda es la calificación.
  const verNotas = notasPublicadas(grupo, periodo)
  const hayRubros = (rubrosPP[periodo] || []).length > 0
  // Si las notas no están publicadas, tampoco se adelanta el "vas aprobando":
  // sería decir la nota sin decirla.
  const aprueba =
    verNotas && umbral != null && notaFinal != null && notaFinal >= umbral
  const presencia = porcentajePresencia(conteos)

  const ordenadas = [...filas].sort((a, b) => {
    const f1 = a.asignacion.fecha_limite
    const f2 = b.asignacion.fecha_limite
    if (!f1 && !f2) return 0
    if (!f1) return 1
    if (!f2) return -1
    return new Date(f1) - new Date(f2)
  })

  return (
    <div className="space-y-5 text-[15px]">
      {/* Encabezado + selector de periodo */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-tinta/10 pb-3">
        <div>
          <h2 className="text-lg font-bold text-tinta sm:text-xl">Evaluación</h2>
          <p className="text-[15px] text-tinta/70">
            Entregas, pruebas y proyectos del {etiquetaPeriodo(periodo)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {periodos.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              className={`min-h-[44px] rounded-cuaderno border px-4 text-[15px] font-semibold shadow-sm transition-colors ${
                periodo === p
                  ? 'border-pizarra bg-pizarra text-papel'
                  : 'border-tinta/20 bg-superficie text-tinta/75 hover:border-pizarra/50 hover:text-pizarra'
              }`}
              aria-current={periodo === p ? 'true' : undefined}
            >
              {etiquetaPeriodo(p)}
            </button>
          ))}
        </div>
      </div>

      {!verNotas && (
        <Alerta tipo="info">
          Tu profe todavía no publicó las notas del {etiquetaPeriodo(periodo)}. Podés
          ver qué entregaste y cuándo; la calificación aparece cuando él la muestre.
        </Alerta>
      )}

      {avisos.rubro.length > 0 && (
        <Alerta tipo="advertencia">
          {avisos.rubro.length === 1
            ? 'Hay 1 actividad'
            : `Hay ${avisos.rubro.length} actividades`}{' '}
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
        <p className="text-tinta/65">
          No hay actividades en el {etiquetaPeriodo(periodo)} todavía.
        </p>
      ) : (
        <>
          {/* ── ESCRITORIO ─────────────────────────────────────────────────── */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-tinta/25 text-[13px] font-semibold uppercase tracking-wide text-tinta/65">
                  <th className="w-10 py-3 pl-1 text-left">Tipo</th>
                  <th className="py-3 pl-2 pr-4 text-left">Actividad</th>
                  <th className="whitespace-nowrap px-3 py-3 text-left">
                    Fecha/Hora entrega
                  </th>
                  <th className="px-3 py-3 text-left">Estado</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right">Valor %</th>
                  <th className="whitespace-nowrap py-3 pl-3 text-right">Calificación</th>
                  <th className="w-8" aria-label="Abrir" />
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((f) => (
                  <FilaActividad
                    key={f.asignacion.id}
                    fila={f}
                    verNotas={verNotas}
                    claseTitulo={tituloClase.get(f.asignacion.clase_id)}
                  />
                ))}
                {asistencia && (
                  <FilaAsistencia
                    asistencia={asistencia}
                    conteos={conteos}
                    verNotas={verNotas}
                  />
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-tinta/25">
                  <td colSpan={4} aria-hidden="true" />
                  <td className="whitespace-nowrap px-3 pt-4 text-right text-[15px] font-bold uppercase tracking-wide text-tinta">
                    Nota final:
                  </td>
                  <td className="whitespace-nowrap py-4 pl-3 text-right">
                    {verNotas ? (
                      <>
                        <span
                          className={`text-2xl font-bold tabular-nums ${
                            aprueba ? 'text-pizarra' : 'text-tinta'
                          }`}
                        >
                          {notaFinal == null ? '—' : pct(notaFinal)}
                        </span>
                        <span className="font-semibold text-tinta/60">/100%</span>
                      </>
                    ) : (
                      <span className="text-base font-semibold text-ambar">
                        Sin publicar
                      </span>
                    )}
                  </td>
                  <td aria-hidden="true" />
                </tr>
                <tr>
                  <td colSpan={7} className="pb-1 pr-1 text-right text-sm text-tinta/65">
                    Evaluado hasta hoy: <b className="text-tinta/80">{pct(evaluado, 0)}</b>
                    {umbral != null && (
                      <>
                        {' '}
                        · mínimo para aprobar: <b className="text-tinta/80">{umbral}</b>
                      </>
                    )}
                    {aprueba && (
                      <span className="font-semibold text-pizarra"> · vas aprobando ✓</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── CELULAR ────────────────────────────────────────────────────── */}
          <div className="md:hidden">
            <ul className="divide-y divide-tinta/10 border-y border-tinta/15">
              {ordenadas.map((f) => (
                <FilaMovil
                  key={f.asignacion.id}
                  fila={f}
                  verNotas={verNotas}
                  claseTitulo={tituloClase.get(f.asignacion.clase_id)}
                />
              ))}
              {asistencia && (
                <FilaMovilAsistencia
                  asistencia={asistencia}
                  conteos={conteos}
                  verNotas={verNotas}
                />
              )}
            </ul>
            {/* Resumen del periodo. La nota arriba con su etiqueta al lado, y
                los datos de apoyo cada uno en su renglón con el valor alineado
                a la derecha: apretados en una sola línea no se leían. */}
            <div className="mt-4 overflow-hidden rounded-cuaderno border border-tinta/20 bg-superficie shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-tinta/12 px-4 py-3">
                <span className="text-[13px] font-semibold uppercase tracking-wide text-tinta/65">
                  Nota final
                </span>
                {verNotas ? (
                  <span
                    className={`shrink-0 text-2xl font-bold leading-none tabular-nums ${
                      aprueba ? 'text-pizarra' : 'text-tinta'
                    }`}
                  >
                    {notaFinal == null ? '—' : pct(notaFinal)}
                    <span className="text-sm font-semibold text-tinta/55"> / 100%</span>
                  </span>
                ) : (
                  <span className="shrink-0 font-semibold text-ambar">Sin publicar</span>
                )}
              </div>

              <dl className="divide-y divide-tinta/10 text-sm">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <dt className="text-tinta/70">Evaluado hasta hoy</dt>
                  <dd className="font-semibold tabular-nums text-tinta">
                    {pct(evaluado, 0)}
                  </dd>
                </div>
                {umbral != null && (
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <dt className="text-tinta/70">Mínimo para aprobar</dt>
                    <dd className="font-semibold tabular-nums text-tinta">{umbral}</dd>
                  </div>
                )}
                {aprueba && (
                  <div className="px-4 py-2.5 font-semibold text-pizarra">
                    Vas aprobando ✓
                  </div>
                )}
              </dl>
            </div>
          </div>

          {/* ── Resumen por rubro ──────────────────────────────────────────── */}
          {verNotas && porRubro.length > 0 && (
            <section className="rounded-cuaderno border border-tinta/12 bg-tinta/[0.02] px-4 py-3.5">
              <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-tinta/65">
                Resumen por rubro
              </h3>
              <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {porRubro.map((r) => (
                  <li
                    key={r.nombre}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="min-w-0 break-words text-tinta/85">
                      {r.nombre}
                      <span className="text-tinta/55"> · vale {r.valor}%</span>
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
            <p className="text-sm text-tinta/65">
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

// ─── Celda de calificación ────────────────────────────────────────────────────
// El número, o el motivo por el que no hay número. Nunca un número que no esté
// sumado en la NOTA FINAL: esa es la regla que hace verificable el registro.

function CeldaCalificacion({ fila, grande = false, verNotas = true }) {
  // Sin publicar: se dice por qué no hay número, no se deja la celda muda.
  if (!verNotas) {
    return (
      <span className="whitespace-nowrap rounded-full bg-ambar/15 px-2 py-1 text-[13px] font-medium text-ambar ring-1 ring-inset ring-ambar/30">
        Sin publicar
      </span>
    )
  }
  if (fila.noCuenta) {
    return (
      <span
        className="whitespace-nowrap rounded-full bg-tinta/10 px-2 py-1 text-[13px] font-medium text-tinta/65 ring-1 ring-inset ring-tinta/20"
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
      <span className={`font-bold tabular-nums text-tinta ${grande ? 'text-base' : ''}`}>
        {pct(fila.calificacion)}
      </span>
    )
  }
  if (fila.entrega) {
    return (
      <span className="whitespace-nowrap rounded-full bg-tinta/10 px-2 py-1 text-[13px] font-medium text-tinta/65 ring-1 ring-inset ring-tinta/20">
        No revisado
      </span>
    )
  }
  return <span className="text-tinta/40">—</span>
}

function Subtitulo({ asignacion, tipo, claseTitulo }) {
  const partes = [tipo.label, asignacion.rubro, claseTitulo].filter(Boolean)
  return <span className="italic text-tinta/60">{partes.join(' · ')}</span>
}

// Flecha de "esto se abre".
function Flecha() {
  return (
    <span
      className="text-lg leading-none text-tinta/35 transition-transform group-hover:translate-x-0.5 group-hover:text-pizarra"
      aria-hidden="true"
    >
      ›
    </span>
  )
}

// ─── Fila de actividad (escritorio) ───────────────────────────────────────────

function FilaActividad({ fila, claseTitulo, verNotas = true }) {
  const a = fila.asignacion
  const tipo = tipoDe(a)
  const est = estadoRegistro(a, fila.entrega)
  const navegar = useNavigate()
  const destino = `/estudiante/asignaciones/${a.id}`
  return (
    // La fila entera se puede tocar, no solo el título: es lo que la gente
    // intenta hacer. El enlace de adentro se conserva para teclado y para
    // "abrir en otra pestaña".
    <tr
      onClick={() => navegar(destino)}
      className="group cursor-pointer border-b border-tinta/10 transition-colors hover:bg-pizarra/[0.07]"
    >
      <td className="py-3 pl-1 align-top">
        <IconoTipo clave={tipo.clave} label={tipo.label} />
      </td>
      <td className="py-3 pl-2 pr-4 align-top">
        <Link
          to={destino}
          onClick={(e) => e.stopPropagation()}
          className="text-base font-semibold text-tinta transition-colors group-hover:text-pizarra"
        >
          {a.titulo}
        </Link>
        <span className="mt-0.5 block text-sm">
          <Subtitulo asignacion={a} tipo={tipo} claseTitulo={claseTitulo} />
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top tabular-nums text-tinta/75">
        {fechaHora(a.fecha_limite)}
      </td>
      <td className="px-3 py-3 align-top">
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-medium ${TONO_BADGE[est.tono]}`}
        >
          {est.etiqueta}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right align-top tabular-nums text-tinta/75">
        {fila.valor == null ? '—' : `${fila.valor}%`}
      </td>
      <td className="whitespace-nowrap py-3 pl-3 text-right align-top">
        <CeldaCalificacion fila={fila} grande verNotas={verNotas} />
      </td>
      <td className="py-3 pr-1 text-right align-top">
        <Flecha />
      </td>
    </tr>
  )
}

function FilaAsistencia({ asistencia, conteos, verNotas = true }) {
  return (
    <tr className="border-b border-tinta/10 bg-tinta/[0.02]">
      <td className="py-3 pl-1 align-top">
        <IconoTipo clave="asistencia" label="Asistencia" />
      </td>
      <td className="py-3 pl-2 pr-4 align-top">
        <span className="text-base font-semibold text-tinta">Asistencia</span>
        <span className="mt-0.5 block text-sm italic text-tinta/60">
          Se calcula sola · {conteos.presente} presentes, {conteos.ausente} ausencias
          {conteos.tardia > 0 && `, ${conteos.tardia} tardías`}
        </span>
      </td>
      <td className="px-3 py-3 align-top text-tinta/40">—</td>
      <td className="px-3 py-3 align-top">
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-medium ${TONO_BADGE.tinta}`}
        >
          Automática
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right align-top tabular-nums text-tinta/75">
        {asistencia.valor == null ? '—' : `${asistencia.valor}%`}
      </td>
      <td className="whitespace-nowrap py-3 pl-3 text-right align-top">
        {!verNotas ? (
          <span className="whitespace-nowrap rounded-full bg-ambar/15 px-2 py-1 text-[13px] font-medium text-ambar ring-1 ring-inset ring-ambar/30">
            Sin publicar
          </span>
        ) : asistencia.calificacion == null ? (
          <span className="text-tinta/40">—</span>
        ) : (
          <span className="text-base font-bold tabular-nums text-tinta">
            {pct(asistencia.calificacion)}
          </span>
        )}
      </td>
      <td aria-hidden="true" />
    </tr>
  )
}

// ─── Fila compacta (celular) ──────────────────────────────────────────────────

function FilaMovil({ fila, claseTitulo, verNotas = true }) {
  const a = fila.asignacion
  const tipo = tipoDe(a)
  const est = estadoRegistro(a, fila.entrega)
  return (
    <li>
      <Link
        to={`/estudiante/asignaciones/${a.id}`}
        className="group flex min-h-[64px] items-start gap-3 py-3.5 transition-colors active:bg-pizarra/[0.07]"
      >
        <span className="mt-0.5">
          <IconoTipo clave={tipo.clave} label={tipo.label} />
        </span>

        {/* Texto a la izquierda, números en su propia columna a la derecha.
            Antes cada número iba al final de su línea, así que el largo del
            texto decidía dónde caía: nunca quedaban alineados entre sí. */}
        <span className="min-w-0 flex-1">
          <span className="block break-words text-base font-semibold text-tinta">
            {a.titulo}
          </span>
          <span className="mt-0.5 block text-sm">
            <Subtitulo asignacion={a} tipo={tipo} claseTitulo={claseTitulo} />
          </span>
          <span className="mt-1 block text-sm tabular-nums text-tinta/65">
            {fechaHora(a.fecha_limite, false)} · {est.etiqueta}
          </span>
        </span>

        <span className="flex w-[104px] shrink-0 flex-col items-end gap-1.5 text-right">
          <span className="text-sm tabular-nums text-tinta/60">
            Vale {fila.valor == null ? '—' : `${fila.valor}%`}
          </span>
          <CeldaCalificacion fila={fila} grande verNotas={verNotas} />
        </span>

        <span className="mt-0.5 shrink-0">
          <Flecha />
        </span>
      </Link>
    </li>
  )
}

function FilaMovilAsistencia({ asistencia, conteos, verNotas = true }) {
  return (
    <li className="flex items-start gap-3 py-3.5">
      <span className="mt-0.5">
        <IconoTipo clave="asistencia" label="Asistencia" />
      </span>
      {/* Misma estructura que las actividades, para que los números caigan en
          la misma columna en todas las filas del registro. */}
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-tinta">Asistencia</span>
        <span className="mt-0.5 block text-sm italic text-tinta/60">
          Se calcula sola
        </span>
        <span className="mt-1 block text-sm text-tinta/65">
          {conteos.presente} presentes, {conteos.ausente} ausencias
          {conteos.tardia > 0 && `, ${conteos.tardia} tardías`}
        </span>
      </span>

      <span className="flex w-[104px] shrink-0 flex-col items-end gap-1.5 text-right">
        <span className="text-sm tabular-nums text-tinta/60">
          Vale {asistencia.valor == null ? '—' : `${asistencia.valor}%`}
        </span>
        {!verNotas ? (
          <span className="whitespace-nowrap rounded-full bg-ambar/15 px-2 py-1 text-[13px] font-medium text-ambar ring-1 ring-inset ring-ambar/30">
            Sin publicar
          </span>
        ) : (
          <span className="text-base font-bold tabular-nums text-tinta">
            {asistencia.calificacion == null ? '—' : pct(asistencia.calificacion)}
          </span>
        )}
      </span>

      {/* Sin flecha: la asistencia no se abre, se calcula sola. */}
      <span className="mt-0.5 w-[18px] shrink-0" aria-hidden="true" />
    </li>
  )
}
