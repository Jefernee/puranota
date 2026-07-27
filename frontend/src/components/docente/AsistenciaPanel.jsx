import { useEffect, useMemo, useState } from 'react'
import Alerta from '../Alerta'
import {
  listarAsistenciaFecha,
  listarAsistenciaGrupo,
  marcarAsistencia,
} from '../../services/asistencia.service'
import {
  listarEstudiantes,
  rubrosPorPeriodo,
  rangoPeriodo,
  guardarLeccionesPorDia,
} from '../../services/grupos.service'
import {
  etiquetaPeriodo,
  periodoDeFecha,
  periodosDeGrupo,
} from '../../lib/periodos'
import {
  contarAsistencia,
  diasRegistrados,
  esRubroAsistencia,
  notaAsistencia,
  pesoDeLeccion,
  pct,
} from '../../lib/notas'

// Estados posibles con su etiqueta corta y estilos de botón.
//
// La FUGA (Art. 154 inciso d) es cuando el estudiante estuvo y se fue antes de
// que terminara el bloque. No es ausencia del día entero: perdió *algunas*
// lecciones, y esas cuentan como ausencias injustificadas para la nota
// (Art. 37). Aparte es falta leve de conducta, pero eso no lo lleva PuraNota.
const ESTADOS = [
  { id: 'presente', label: 'Presente', corto: 'P', activo: 'bg-pizarra text-papel', idle: 'text-pizarra hover:bg-pizarra/10' },
  { id: 'ausente', label: 'Ausente', corto: 'A', activo: 'bg-margen text-papel', idle: 'text-margen hover:bg-margen/10' },
  { id: 'tardia', label: 'Tardía', corto: 'T', activo: 'bg-ambar text-papel', idle: 'text-ambar hover:bg-ambar/10' },
  { id: 'fuga', label: 'Fuga', corto: 'F', activo: 'bg-guaria text-papel', idle: 'text-guaria hover:bg-guaria/10' },
  { id: 'justificada', label: 'Justif.', corto: 'J', activo: 'bg-tinta text-papel', idle: 'text-tinta/70 hover:bg-tinta/10' },
]

const DIAS = [
  { n: 1, label: 'Lunes' },
  { n: 2, label: 'Martes' },
  { n: 3, label: 'Miércoles' },
  { n: 4, label: 'Jueves' },
  { n: 5, label: 'Viernes' },
]

function hoyLocal() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Panel de pase de lista por grupo y fecha. Props: grupo.
const VISTAS = [
  { id: 'lista', label: 'Pase de lista' },
  { id: 'resumen', label: 'Resumen' },
]

export default function AsistenciaPanel({ grupo: grupoInicial }) {
  const [grupo, setGrupo] = useState(grupoInicial)
  const grupoId = grupo.id
  // Cuántas lecciones vale cada día (Art. 37). Sin configurar, cada día pesa 1.
  const peso = useMemo(() => pesoDeLeccion(grupo.lecciones_por_dia), [grupo])
  const [vista, setVista] = useState('lista') // 'lista' | 'resumen' | 'fechas'
  const [fecha, setFecha] = useState(hoyLocal())
  const [estudiantes, setEstudiantes] = useState([])
  const [registros, setRegistros] = useState({}) // estudianteId -> estado
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardandoId, setGuardandoId] = useState(null)

  // Filas crudas de todo el año. Se guardan sin agregar para poder recortarlas
  // por periodo: la NOTA de asistencia se calcula por periodo (Art. 37), así
  // que un resumen del año entero mostraría números que no son los que cuentan.
  const [filasAsis, setFilasAsis] = useState(null)
  const [periodoResumen, setPeriodoResumen] = useState(() => periodoDeFecha(grupo))
  const [cargandoResumen, setCargandoResumen] = useState(false)

  async function cargar() {
    setCargando(true)
    setError('')
    try {
      const [ests, asis] = await Promise.all([
        listarEstudiantes(grupoId),
        listarAsistenciaFecha(grupoId, fecha),
      ])
      setEstudiantes(ests.filter((m) => m.estado === 'activo' && m.estudiante))
      setRegistros(
        Object.fromEntries(
          asis.map((a) => [
            a.estudiante_id,
            { estado: a.estado, perdidas: a.lecciones_perdidas },
          ]),
        ),
      )
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la asistencia.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId, fecha])

  async function marcar(estudianteId, estado, perdidas = null) {
    setError('')
    setGuardandoId(estudianteId)
    const previo = registros[estudianteId]
    const nuevo = {
      estado,
      // Al marcar fuga sin decir cuántas, se asume la última lección del bloque.
      perdidas: estado === 'fuga' ? perdidas || previo?.perdidas || 1 : null,
    }
    setRegistros((prev) => ({ ...prev, [estudianteId]: nuevo })) // optimista
    try {
      await marcarAsistencia(grupoId, estudianteId, fecha, estado, nuevo.perdidas)
    } catch (e) {
      setRegistros((prev) => ({ ...prev, [estudianteId]: previo })) // revertir
      setError(e?.message || 'No se pudo guardar.')
    } finally {
      setGuardandoId(null)
    }
  }

  // Cuántas lecciones tiene el día que se está pasando.
  const leccionesHoy = Math.max(1, Number(peso(fecha)) || 1)

  const conteoDia = useMemo(() => {
    const c = { presente: 0, ausente: 0, tardia: 0, justificada: 0, fuga: 0, sin: 0 }
    for (const m of estudiantes) {
      const e = registros[m.estudiante.id]?.estado
      if (e && c[e] != null) c[e]++
      else if (!e) c.sin++
    }
    return c
  }, [estudiantes, registros])

  async function cambiarVista(v) {
    setError('')
    setVista(v)
    // El resumen se carga la primera vez que se entra a esa vista.
    if (v === 'resumen' && !filasAsis) {
      setCargandoResumen(true)
      try {
        setFilasAsis(await listarAsistenciaGrupo(grupoId))
      } catch (e) {
        setError(e?.message || 'No se pudo cargar el resumen.')
        setVista('lista')
      } finally {
        setCargandoResumen(false)
      }
    }
  }

  // Resumen recortado al periodo elegido, con la nota que ese registro otorga.
  // Así el docente ve exactamente lo que va a contar, no un acumulado del año
  // que no coincide con ninguna nota.
  const reglaAsistencia = useMemo(() => {
    const rubros = rubrosPorPeriodo(grupo)[periodoResumen] || []
    return rubros.find(esRubroAsistencia) || null
  }, [grupo, periodoResumen])

  const resumenPeriodo = useMemo(() => {
    if (!filasAsis) return null
    const rango = rangoPeriodo(grupo, periodoResumen)
    const mapa = {}
    for (const m of estudiantes) {
      const sid = m.estudiante.id
      const c = contarAsistencia(
        filasAsis.filter((r) => r.estudiante_id === sid),
        rango,
        peso,
      )
      const logro = diasRegistrados(c) > 0 && reglaAsistencia
        ? notaAsistencia(c, reglaAsistencia)
        : null
      mapa[sid] = {
        ...c,
        total: diasRegistrados(c),
        logro,
        aporta:
          logro == null || !reglaAsistencia?.porcentaje
            ? null
            : (logro * Number(reglaAsistencia.porcentaje)) / 100,
      }
    }
    return mapa
  }, [filasAsis, estudiantes, grupo, periodoResumen, reglaAsistencia, peso])

  return (
    <div className="space-y-4">
      {/* Selector de vista: una a la vez (pase de lista / resumen / fechas). */}
      <div className="flex flex-wrap gap-1.5">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => cambiarVista(v.id)}
            className={`min-h-[40px] rounded-cuaderno border px-4 py-2 text-sm font-semibold shadow-sm transition-colors ${
              vista === v.id
                ? 'border-pizarra bg-pizarra text-papel'
                : 'border-tinta/15 bg-superficie text-tinta/70 hover:border-pizarra/40 hover:text-pizarra'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {vista === 'resumen' ? (
        <>
          {/* La nota de asistencia se define POR PERIODO (Art. 37), así que el
              resumen también. Un acumulado del año no coincidiría con ninguna
              nota y haría desconfiar del cuadro. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {periodosDeGrupo(grupo).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodoResumen(p)}
                className={`min-h-[40px] rounded-cuaderno border px-4 py-2 text-sm font-semibold shadow-sm transition-colors ${
                  periodoResumen === p
                    ? 'border-pizarra bg-pizarra text-papel'
                    : 'border-tinta/15 bg-superficie text-tinta/70 hover:border-pizarra/40 hover:text-pizarra'
                }`}
              >
                {etiquetaPeriodo(p)}
              </button>
            ))}
          </div>
          <p className="text-sm text-tinta/65">
            {(() => {
              const r = rangoPeriodo(grupo, periodoResumen)
              return r ? `Del ${r.inicio} al ${r.fin}.` : ''
            })()}{' '}
            {reglaAsistencia
              ? `La asistencia vale ${reglaAsistencia.porcentaje}% de la nota${reglaAsistencia.mep ? ', con la escala del MEP' : ''}.`
              : 'La asistencia no cuenta para la nota en este periodo.'}
          </p>

          <Alerta tipo="error">{error}</Alerta>
          {cargando ? (
            <p className="text-[15px] text-tinta/70">Cargando…</p>
          ) : estudiantes.length === 0 ? (
            <p className="text-sm text-tinta/60">
              No hay estudiantes activos en este grupo todavía.
            </p>
          ) : (
            <ResumenTabla
              estudiantes={estudiantes}
              resumen={resumenPeriodo}
              cargando={cargandoResumen}
              hayNota={!!reglaAsistencia}
            />
          )}
        </>
      ) : (
        <>
          {/* Pase de lista: fecha + conteo + lista de estudiantes */}
          <label htmlFor="fecha" className="block">
            <span className="mb-1 block text-sm text-tinta/60">Fecha</span>
            <input
              id="fecha"
              type="date"
              className="campo w-full max-w-[200px]"
              value={fecha}
              max={hoyLocal()}
              onChange={(e) => setFecha(e.target.value || hoyLocal())}
            />
          </label>

          {/* A qué periodo suma esta fecha, y cuántas lecciones vale. Sin esto,
              uno pasa lista un 25 de julio, abre Notas en el I Periodo y cree
              que no se guardó nada. */}
          <p className="text-sm text-tinta/65">
            Esta fecha cuenta para el{' '}
            <b className="text-tinta/85">{etiquetaPeriodo(periodoDeFecha(grupo, fecha))}</b>
            {' · '}
            <b className="text-tinta/85">
              {leccionesHoy} {leccionesHoy === 1 ? 'lección' : 'lecciones'}
            </b>
            .
          </p>

          <LeccionesPorDia grupo={grupo} onGuardado={setGrupo} />

          {!cargando && estudiantes.length > 0 && (
            <p className="text-sm text-tinta/60">
              {conteoDia.presente} presentes · {conteoDia.ausente} ausentes ·{' '}
              {conteoDia.tardia} tardías ·{' '}
              {conteoDia.fuga} {conteoDia.fuga === 1 ? 'fuga' : 'fugas'} ·{' '}
              {conteoDia.justificada} justificadas
              {conteoDia.sin > 0 && ` · ${conteoDia.sin} sin marcar`}
            </p>
          )}

          <Alerta tipo="error">{error}</Alerta>

          {cargando ? (
            <p className="text-[15px] text-tinta/70">Cargando…</p>
          ) : estudiantes.length === 0 ? (
            <p className="text-sm text-tinta/60">
              No hay estudiantes activos en este grupo todavía.
            </p>
          ) : (
            <ul className="space-y-2">
              {estudiantes.map((m) => {
                const actual = registros[m.estudiante.id]
                return (
                  <li
                    key={m.estudiante.id}
                    className="tarjeta-cuaderno flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1 break-words font-medium text-tinta">
                      {m.estudiante.nombre || m.estudiante.correo}
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {ESTADOS.map((e) => {
                        const sel = actual?.estado === e.id
                        return (
                          <button
                            key={e.id}
                            onClick={() => marcar(m.estudiante.id, e.id)}
                            disabled={guardandoId === m.estudiante.id}
                            className={`min-h-[40px] rounded-cuaderno px-3 py-1.5 text-sm font-medium transition-colors ${
                              sel ? e.activo : e.idle
                            }`}
                            title={
                              e.id === 'fuga'
                                ? 'Se fue antes de que terminara el bloque'
                                : e.label
                            }
                          >
                            <span className="sm:hidden">{e.corto}</span>
                            <span className="hidden sm:inline">{e.label}</span>
                          </button>
                        )
                      })}

                      {/* Cuántas lecciones perdió al fugarse. Solo aparece si el
                          día tiene más de una: con una sola, irse equivale a
                          faltar y no hay nada que elegir. */}
                      {actual?.estado === 'fuga' && leccionesHoy > 1 && (
                        <label className="ml-1 flex items-center gap-1.5 text-sm text-tinta/70">
                          <span>Perdió</span>
                          <select
                            className="min-h-[40px] rounded-cuaderno border border-tinta/20 bg-superficie px-2 text-sm text-tinta"
                            value={actual.perdidas || 1}
                            onChange={(ev) =>
                              marcar(m.estudiante.id, 'fuga', Number(ev.target.value))
                            }
                            aria-label="Lecciones perdidas por la fuga"
                          >
                            {Array.from({ length: leccionesHoy }, (_, i) => i + 1).map(
                              (n) => (
                                <option key={n} value={n}>
                                  {n} de {leccionesHoy}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {conteoDia.fuga > 0 && (
            <p className="text-sm text-tinta/65">
              La <b className="text-tinta/85">fuga</b> resta solo las lecciones que
              el estudiante perdió, no el día entero. Además es <b>falta leve</b> de
              conducta (REAC Art. 154, inciso d) y corresponde amonestación: eso se
              lleva fuera de PuraNota.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Cuántas lecciones da el grupo cada día. Se llena una sola vez.
 *
 * Va plegado: la mayoría de los grupos tiene bloques iguales y no necesita
 * tocarlo. Solo importa cuando son desiguales —lunes 2 lecciones y miércoles
 * 4—, porque ahí faltar un miércoles pesa el doble (Art. 37).
 */
function LeccionesPorDia({ grupo, onGuardado }) {
  const guardadas = grupo.lecciones_por_dia || {}
  const [abierto, setAbierto] = useState(false)
  const [valores, setValores] = useState(() =>
    Object.fromEntries(DIAS.map((d) => [d.n, guardadas[String(d.n)] || ''])),
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  const configurados = DIAS.filter((d) => guardadas[String(d.n)] > 0)

  async function guardar() {
    setGuardando(true)
    setError('')
    setOk(false)
    try {
      onGuardado(await guardarLeccionesPorDia(grupo.id, valores))
      setOk(true)
    } catch (e) {
      setError(e?.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="rounded-cuaderno border border-tinta/12 bg-tinta/[0.02] px-4 py-3">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex min-h-[40px] w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0 text-[15px] text-tinta/80">
          <b className="text-tinta">Lecciones por día</b>
          {configurados.length === 0 ? (
            <span className="text-tinta/60">
              {' '}
              · sin configurar, cada día cuenta como 1
            </span>
          ) : (
            <span className="text-tinta/60">
              {' · '}
              {configurados.map((d) => `${d.label} ${guardadas[String(d.n)]}`).join(' · ')}
            </span>
          )}
        </span>
        <span
          className={`shrink-0 text-tinta/40 transition-transform ${abierto ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          ›
        </span>
      </button>

      {abierto && (
        <div className="mt-3 border-t border-tinta/10 pt-3">
          <p className="mb-3 text-sm text-tinta/70">
            El MEP cuenta la asistencia <b>por lección</b>, no por día (Art. 37). Si
            un día das más lecciones que otro, faltar ese día pesa más. Dejá en
            blanco los días que no ves al grupo.
          </p>
          <div className="flex flex-wrap gap-3">
            {DIAS.map((d) => (
              <label key={d.n} className="text-sm">
                <span className="mb-1 block text-tinta/65">{d.label}</span>
                <input
                  type="number"
                  min="0"
                  max="12"
                  inputMode="numeric"
                  className="campo w-[92px]"
                  value={valores[d.n]}
                  onChange={(e) =>
                    setValores((v) => ({ ...v, [d.n]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <Alerta tipo="error">{error}</Alerta>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="btn-primario disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            {ok && <span className="text-sm font-medium text-pizarra">Guardado ✓</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// Resumen del periodo. Además de los conteos muestra lo que ese registro
// APORTA a la nota, que es el número que el docente necesita verificar y el
// mismo que ve el estudiante en su registro.
const VACIO = { presente: 0, ausente: 0, tardia: 0, justificada: 0, total: 0, logro: null, aporta: null }

function ResumenTabla({ estudiantes, resumen, cargando, hayNota }) {
  if (cargando) return <p className="text-[15px] text-tinta/70">Calculando…</p>
  if (!resumen) return null
  const conteo = (m) => resumen[m.estudiante.id] || VACIO
  return (
    <>
    {/* Móvil: tarjetas */}
    <ul className="space-y-2 md:hidden">
      {estudiantes.map((m) => {
        const r = conteo(m)
        return (
          <li key={m.estudiante.id} className="tarjeta-cuaderno px-3.5 py-3 sm:px-4 sm:pl-6">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 break-words font-medium text-tinta">
                {m.estudiante.nombre || m.estudiante.correo}
              </p>
              {hayNota && (
                <span className="shrink-0 font-bold tabular-nums text-tinta">
                  {r.aporta == null ? '—' : pct(r.aporta)}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-sm">
              <span className="text-pizarra">Presente: <b>{r.presente}</b></span>
              <span className="text-margen">Ausente: <b>{r.ausente}</b></span>
              <span className="text-ambar">Tardía: <b>{r.tardia}</b></span>
              <span className="text-tinta/70">Justif.: <b>{r.justificada}</b></span>
            </div>
            {r.total > 0 && (
              <p className="mt-1 text-sm text-tinta/60">
                {r.total} {r.total === 1 ? 'lección registrada' : 'lecciones registradas'}
                {r.logro != null && ` · logro ${pct(r.logro, 0)}`}
              </p>
            )}
          </li>
        )
      })}
    </ul>

    {/* Escritorio: tabla */}
    <div className="hidden tarjeta-cuaderno overflow-x-auto px-2 py-2 pl-4 md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-tinta/65">
            <th className="px-2 py-1 font-medium">Estudiante</th>
            <th className="px-2 py-1 text-center font-medium">P</th>
            <th className="px-2 py-1 text-center font-medium">A</th>
            <th className="px-2 py-1 text-center font-medium">T</th>
            <th className="px-2 py-1 text-center font-medium">J</th>
            <th className="px-2 py-1 text-center font-medium">Registradas</th>
            {hayNota && (
              <th className="px-2 py-1 text-center font-medium">Aporta a la nota</th>
            )}
          </tr>
        </thead>
        <tbody>
          {estudiantes.map((m) => {
            const r = conteo(m)
            return (
              <tr key={m.estudiante.id} className="border-t border-tinta/10">
                <td className="px-2 py-1.5 text-tinta">
                  {m.estudiante.nombre || m.estudiante.correo}
                </td>
                <td className="px-2 py-1.5 text-center text-pizarra">{r.presente}</td>
                <td className="px-2 py-1.5 text-center text-margen">{r.ausente}</td>
                <td className="px-2 py-1.5 text-center text-ambar">{r.tardia}</td>
                <td className="px-2 py-1.5 text-center text-tinta/70">{r.justificada}</td>
                <td className="px-2 py-1.5 text-center tabular-nums text-tinta/70">
                  {r.total}
                </td>
                {hayNota && (
                  <td className="px-2 py-1.5 text-center font-semibold tabular-nums text-tinta">
                    {r.aporta == null ? '—' : pct(r.aporta)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}
