import { useEffect, useMemo, useState } from 'react'
import Alerta from '../Alerta'
import Modal from '../Modal'
import {
  listarAsistenciaFecha,
  listarAsistenciaGrupo,
  marcarAsistencia,
  borrarAsistencia,
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

// Color de cada estado en el conteo del día, el mismo del botón que lo marca.
const COLOR_CONTEO = {
  presente: 'text-pizarra',
  ausente: 'text-margen',
  tardia: 'text-ambar',
  fuga: 'text-guaria',
  justificada: 'text-tinta/70',
}

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
  const [modalLecciones, setModalLecciones] = useState(false)

  // ¿Ya dijo cuántas lecciones da por día? Si no, se le invita una vez. El
  // "Ahora no" se recuerda por grupo para no volver a insistir.
  const sinConfigurar =
    Object.keys(grupo.lecciones_por_dia || {}).length === 0
  const claveAviso = `pn-lecciones-aviso-${grupoId}`
  const [avisoOculto, setAvisoOculto] = useState(
    () => localStorage.getItem(claveAviso) === '1',
  )
  function cerrarAviso() {
    localStorage.setItem(claveAviso, '1')
    setAvisoOculto(true)
  }

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

  /**
   * Marca un estado, o lo QUITA si ya estaba puesto (tocar dos veces desmarca).
   *
   * Poder desmarcar importa: si el docente toca "Ausente" por error, sin esto
   * la única salida sería dejar puesto algo que no pasó. Y un día sin registro
   * no es lo mismo que un día presente: no cuenta como lección impartida, así
   * que no infla ni desinfla el porcentaje de asistencia.
   */
  async function marcar(estudianteId, estado, perdidas = null) {
    setError('')
    setGuardandoId(estudianteId)
    const previo = registros[estudianteId]
    // Mismo botón otra vez = quitar la marca. Cambiar el número de lecciones de
    // una fuga no desmarca: ahí viene `perdidas`.
    const quitar = previo?.estado === estado && perdidas == null

    setRegistros((prev) => {
      const copia = { ...prev }
      if (quitar) delete copia[estudianteId]
      else
        copia[estudianteId] = {
          estado,
          perdidas: estado === 'fuga' ? perdidas || previo?.perdidas || 1 : null,
        }
      return copia
    })

    try {
      if (quitar) await borrarAsistencia(grupoId, estudianteId, fecha)
      else
        await marcarAsistencia(
          grupoId,
          estudianteId,
          fecha,
          estado,
          estado === 'fuga' ? perdidas || previo?.perdidas || 1 : null,
        )
    } catch (e) {
      // Revertir al estado anterior exacto (incluido "sin marcar").
      setRegistros((prev) => {
        const copia = { ...prev }
        if (previo) copia[estudianteId] = previo
        else delete copia[estudianteId]
        return copia
      })
      setError(e?.message || 'No se pudo guardar.')
    } finally {
      setGuardandoId(null)
    }
  }

  // Cuántas lecciones vale el día que se está pasando. Un día sin configurar
  // —un sábado de reposición, por ejemplo— vale 1: se registra igual y cuenta
  // para el periodo, sin ningún trámite extra.
  const leccionesHoy = Math.max(1, Number(peso(fecha)) || 1)

  // El nombre del día, para que se vea de inmediato sobre qué se está pasando
  // lista sin tener que descifrar la fecha.
  const nombreDia = useMemo(() => {
    const [y, m, d] = fecha.split('-').map(Number)
    return ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][
      new Date(y, m - 1, d).getDay()
    ]
  }, [fecha])

  // Resumen corto para el botón: "9 por semana" o "sin configurar".
  const resumenLecciones = useMemo(() => {
    const total = DIAS.reduce(
      (s, d) => s + (Number(grupo.lecciones_por_dia?.[String(d.n)]) || 0),
      0,
    )
    return total > 0 ? `· ${total} por semana` : '· sin configurar'
  }, [grupo])

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

        {/* La fecha y su contexto van acá, a la par de las pestañas: eran
            cuatro renglones apilados antes de llegar a la lista, que es lo que
            uno viene a usar. En el resumen no aplica —ahí manda el selector de
            periodo—, por eso solo aparecen en 'lista'. */}
        {vista === 'lista' && (
          <>
            <label htmlFor="fecha" className="sr-only">
              Fecha del pase de lista
            </label>
            <input
              id="fecha"
              type="date"
              className="campo ml-1 w-auto min-w-[164px] shrink-0 py-2"
              value={fecha}
              max={hoyLocal()}
              onChange={(e) => setFecha(e.target.value || hoyLocal())}
            />
            <p className="text-sm text-tinta/65">
              <b className="capitalize text-tinta/85">{nombreDia}</b> ·{' '}
              {etiquetaPeriodo(periodoDeFecha(grupo, fecha))} ·{' '}
              <b className="text-tinta/85">
                {leccionesHoy} {leccionesHoy === 1 ? 'lección' : 'lecciones'}
              </b>
            </p>
            {!cargando && estudiantes.length > 0 && (
              // Separado del contexto del día por una línea tenue: pegados,
              // "1 lección" y "1 presente" se leían como una sola frase.
              <p className="border-l border-tinta/15 pl-3 text-sm text-tinta/60">
                {/* Solo lo que hay: cinco ceros no dicen nada y ocupan la
                    línea entera. Cada estado con su color, el mismo del botón. */}
                {ESTADOS.filter((e) => conteoDia[e.id] > 0).map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && ' · '}
                    <b className={COLOR_CONTEO[e.id]}>{conteoDia[e.id]}</b>{' '}
                    {e.label.toLowerCase()}
                  </span>
                ))}
                {conteoDia.sin > 0 && (
                  <>
                    {ESTADOS.some((e) => conteoDia[e.id] > 0) && ' · '}
                    {conteoDia.sin} sin marcar
                  </>
                )}
              </p>
            )}
          </>
        )}

        {/* Configuración del año, no del día: va como acción al lado de las
            pestañas y se abre en modal, para no ocupar espacio permanente
            encima del pase de lista. */}
        <button
          type="button"
          onClick={() => setModalLecciones(true)}
          className="ml-auto inline-flex min-h-[40px] items-center gap-2 rounded-cuaderno border border-tinta/15 bg-superficie px-3 text-sm font-semibold text-tinta/70 shadow-sm transition-colors hover:border-pizarra/40 hover:text-pizarra"
          title="Cuántas lecciones da el grupo cada día de la semana"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M3 9h18M8 2v4M16 2v4" />
          </svg>
          Lecciones por día
          <span className="font-normal text-tinta/55">
            {resumenLecciones}
          </span>
        </button>
      </div>

      <ModalLecciones
        grupo={grupo}
        abierto={modalLecciones}
        onCerrar={() => setModalLecciones(false)}
        onGuardado={setGrupo}
      />

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
          {/* Invitación de la primera vez. No bloquea: si el docente la ignora,
              todo sigue funcionando con un día = una lección. Se puede cerrar y
              no vuelve a aparecer en ese grupo. */}
          {sinConfigurar && !avisoOculto && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-cuaderno border border-pizarra/25 bg-pizarra/[0.06] px-4 py-3">
              <p className="min-w-0 text-[15px] text-tinta/80">
                <b className="text-tinta">¿Cuántas lecciones das cada día?</b> El MEP
                cuenta la asistencia por lección (Art. 37). Mientras no lo digas,
                cada día que pasés lista cuenta como <b>una</b>.
              </p>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={cerrarAviso}
                  className="btn-secundario"
                >
                  Ahora no
                </button>
                <button
                  type="button"
                  onClick={() => setModalLecciones(true)}
                  className="btn-primario"
                >
                  Configurar
                </button>
              </div>
            </div>
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
 * Va en un modal, no en una caja fija: es una decisión que se toma al empezar
 * el año y después no se vuelve a tocar, así que no tiene por qué ocupar
 * espacio todos los días encima del pase de lista.
 *
 * Los días se ajustan con − y + en vez de escribir un número: en el celular es
 * más rápido, no abre el teclado y el control se ve como control (un campo
 * numérico vacío se confundía con el fondo).
 */
function ModalLecciones({ grupo, abierto, onCerrar, onGuardado }) {
  const guardadas = grupo.lecciones_por_dia || {}
  const [valores, setValores] = useState(() =>
    Object.fromEntries(DIAS.map((d) => [d.n, Number(guardadas[String(d.n)]) || 0])),
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Al reabrir el modal se vuelve a leer lo guardado, para no arrastrar una
  // edición que se canceló.
  useEffect(() => {
    if (abierto) {
      setValores(
        Object.fromEntries(DIAS.map((d) => [d.n, Number(guardadas[String(d.n)]) || 0])),
      )
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, grupo.lecciones_por_dia])

  const total = DIAS.reduce((s, d) => s + (valores[d.n] || 0), 0)
  const ajustar = (dia, delta) =>
    setValores((v) => ({ ...v, [dia]: Math.max(0, Math.min(12, (v[dia] || 0) + delta)) }))

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      onGuardado(await guardarLeccionesPorDia(grupo.id, valores))
      onCerrar()
    } catch (e) {
      setError(e?.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Lecciones por día">
      <p className="text-[15px] leading-relaxed text-tinta/75">
        El MEP cuenta la asistencia <b className="text-tinta">por lección</b>, no por
        día (Art. 37). Si un día das más lecciones que otro, faltar ese día pesa más.
        Dejá en <b className="text-tinta">0</b> los días que no ves al grupo.
      </p>

      <ul className="mt-4 divide-y divide-tinta/10 border-y border-tinta/12">
        {DIAS.map((d) => {
          const n = valores[d.n] || 0
          return (
            <li key={d.n} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-[15px] font-medium text-tinta">{d.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                <BotonPaso
                  signo="−"
                  onClick={() => ajustar(d.n, -1)}
                  disabled={n === 0}
                  etiqueta={`Quitar una lección del ${d.label}`}
                />
                <span
                  className={`w-14 text-center text-base font-bold tabular-nums ${
                    n === 0 ? 'text-tinta/35' : 'text-tinta'
                  }`}
                >
                  {n === 0 ? '—' : n}
                </span>
                <BotonPaso
                  signo="+"
                  onClick={() => ajustar(d.n, 1)}
                  disabled={n >= 12}
                  etiqueta={`Agregar una lección al ${d.label}`}
                />
              </span>
            </li>
          )
        })}
      </ul>

      <p className="mt-3 text-sm text-tinta/65">
        {total === 0 ? (
          <>Sin configurar: cada día que pasés lista va a contar como una lección.</>
        ) : (
          <>
            Total: <b className="text-tinta">{total}</b>{' '}
            {total === 1 ? 'lección' : 'lecciones'} por semana.
          </>
        )}
      </p>

      <Alerta tipo="error">{error}</Alerta>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCerrar} className="btn-secundario">
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="btn-primario disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Modal>
  )
}

// Botón redondo de − / +. Objetivo táctil de 40px y borde visible, para que no
// se confunda con el fondo.
function BotonPaso({ signo, onClick, disabled, etiqueta }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-tinta/20 bg-superficie text-lg font-semibold text-tinta/75 shadow-sm transition-colors hover:border-pizarra hover:text-pizarra disabled:opacity-30 disabled:hover:border-tinta/20 disabled:hover:text-tinta/75"
    >
      {signo}
    </button>
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
