import { useEffect, useMemo, useState } from 'react'
import Alerta from '../Alerta'
import {
  listarAsistenciaFecha,
  listarAsistenciaGrupo,
  marcarAsistencia,
} from '../../services/asistencia.service'
import { listarEstudiantes } from '../../services/grupos.service'

// Estados posibles con su etiqueta corta y estilos de botón.
const ESTADOS = [
  { id: 'presente', label: 'Presente', corto: 'P', activo: 'bg-pizarra text-papel', idle: 'text-pizarra hover:bg-pizarra/10' },
  { id: 'ausente', label: 'Ausente', corto: 'A', activo: 'bg-margen text-papel', idle: 'text-margen hover:bg-margen/10' },
  { id: 'tardia', label: 'Tardía', corto: 'T', activo: 'bg-guaria text-papel', idle: 'text-guaria hover:bg-guaria/10' },
  { id: 'justificada', label: 'Justif.', corto: 'J', activo: 'bg-tinta text-papel', idle: 'text-tinta/70 hover:bg-tinta/10' },
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

export default function AsistenciaPanel({ grupo }) {
  const grupoId = grupo.id
  const [vista, setVista] = useState('lista') // 'lista' | 'resumen' | 'fechas'
  const [fecha, setFecha] = useState(hoyLocal())
  const [estudiantes, setEstudiantes] = useState([])
  const [registros, setRegistros] = useState({}) // estudianteId -> estado
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardandoId, setGuardandoId] = useState(null)

  const [resumen, setResumen] = useState(null) // estudianteId -> {presente,...}
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
      setRegistros(Object.fromEntries(asis.map((a) => [a.estudiante_id, a.estado])))
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

  async function marcar(estudianteId, estado) {
    setError('')
    setGuardandoId(estudianteId)
    const previo = registros[estudianteId]
    setRegistros((prev) => ({ ...prev, [estudianteId]: estado })) // optimista
    try {
      await marcarAsistencia(grupoId, estudianteId, fecha, estado)
    } catch (e) {
      setRegistros((prev) => ({ ...prev, [estudianteId]: previo })) // revertir
      setError(e?.message || 'No se pudo guardar.')
    } finally {
      setGuardandoId(null)
    }
  }

  const conteoDia = useMemo(() => {
    const c = { presente: 0, ausente: 0, tardia: 0, justificada: 0, sin: 0 }
    for (const m of estudiantes) {
      const e = registros[m.estudiante.id]
      if (e) c[e]++
      else c.sin++
    }
    return c
  }, [estudiantes, registros])

  async function cambiarVista(v) {
    setError('')
    setVista(v)
    // El resumen se carga la primera vez que se entra a esa vista.
    if (v === 'resumen' && !resumen) {
      setCargandoResumen(true)
      try {
        const todos = await listarAsistenciaGrupo(grupoId)
        const mapa = {}
        for (const r of todos) {
          mapa[r.estudiante_id] = mapa[r.estudiante_id] || {
            presente: 0,
            ausente: 0,
            tardia: 0,
            justificada: 0,
          }
          mapa[r.estudiante_id][r.estado]++
        }
        setResumen(mapa)
      } catch (e) {
        setError(e?.message || 'No se pudo cargar el resumen.')
        setVista('lista')
      } finally {
        setCargandoResumen(false)
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Selector de vista: una a la vez (pase de lista / resumen / fechas). */}
      <div className="flex flex-wrap gap-1.5">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => cambiarVista(v.id)}
            className={`rounded-cuaderno border px-4 py-2 text-sm font-semibold shadow-sm transition-colors ${
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
          <Alerta tipo="error">{error}</Alerta>
          {cargando ? (
            <p className="text-sm text-tinta/60">Cargando…</p>
          ) : estudiantes.length === 0 ? (
            <p className="text-sm text-tinta/60">
              No hay estudiantes activos en este grupo todavía.
            </p>
          ) : (
            <ResumenTabla
              estudiantes={estudiantes}
              resumen={resumen}
              cargando={cargandoResumen}
            />
          )}
        </>
      ) : (
        <>
          {/* Pase de lista: fecha + conteo + lista de estudiantes */}
          <label htmlFor="fecha" className="block">
            <span className="mb-1 block text-xs text-tinta/60">Fecha</span>
            <input
              id="fecha"
              type="date"
              className="campo w-full max-w-[200px]"
              value={fecha}
              max={hoyLocal()}
              onChange={(e) => setFecha(e.target.value || hoyLocal())}
            />
          </label>

          {!cargando && estudiantes.length > 0 && (
            <p className="text-sm text-tinta/60">
              {conteoDia.presente} presentes · {conteoDia.ausente} ausentes ·{' '}
              {conteoDia.tardia} tardías · {conteoDia.justificada} justificadas
              {conteoDia.sin > 0 && ` · ${conteoDia.sin} sin marcar`}
            </p>
          )}

          <Alerta tipo="error">{error}</Alerta>

          {cargando ? (
            <p className="text-sm text-tinta/60">Cargando…</p>
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
                    <span className="min-w-0 flex-1 truncate font-medium text-tinta">
                      {m.estudiante.nombre || m.estudiante.correo}
                    </span>
                    <div className="flex gap-1">
                      {ESTADOS.map((e) => {
                        const sel = actual === e.id
                        return (
                          <button
                            key={e.id}
                            onClick={() => marcar(m.estudiante.id, e.id)}
                            disabled={guardandoId === m.estudiante.id}
                            className={`rounded-cuaderno px-3 py-1.5 text-sm font-medium transition-colors ${
                              sel ? e.activo : e.idle
                            }`}
                            title={e.label}
                          >
                            <span className="sm:hidden">{e.corto}</span>
                            <span className="hidden sm:inline">{e.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function ResumenTabla({ estudiantes, resumen, cargando }) {
  if (cargando) return <p className="text-sm text-tinta/60">Calculando…</p>
  if (!resumen) return null
  const conteo = (m) =>
    resumen[m.estudiante.id] || { presente: 0, ausente: 0, tardia: 0, justificada: 0 }
  return (
    <>
    {/* Móvil: tarjetas */}
    <ul className="space-y-2 md:hidden">
      {estudiantes.map((m) => {
        const r = conteo(m)
        return (
          <li key={m.estudiante.id} className="tarjeta-cuaderno px-4 py-3 pl-6">
            <p className="truncate font-medium text-tinta">
              {m.estudiante.nombre || m.estudiante.correo}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
              <span className="text-pizarra">Presente: <b>{r.presente}</b></span>
              <span className="text-margen">Ausente: <b>{r.ausente}</b></span>
              <span className="text-guaria">Tardía: <b>{r.tardia}</b></span>
              <span className="text-tinta/70">Justif.: <b>{r.justificada}</b></span>
            </div>
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
          </tr>
        </thead>
        <tbody>
          {estudiantes.map((m) => {
            const r = resumen[m.estudiante.id] || {
              presente: 0,
              ausente: 0,
              tardia: 0,
              justificada: 0,
            }
            return (
              <tr key={m.estudiante.id} className="border-t border-tinta/10">
                <td className="px-2 py-1.5 text-tinta">
                  {m.estudiante.nombre || m.estudiante.correo}
                </td>
                <td className="px-2 py-1.5 text-center text-pizarra">{r.presente}</td>
                <td className="px-2 py-1.5 text-center text-margen">{r.ausente}</td>
                <td className="px-2 py-1.5 text-center text-guaria">{r.tardia}</td>
                <td className="px-2 py-1.5 text-center text-tinta/70">{r.justificada}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}
