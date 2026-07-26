import { useEffect, useState } from 'react'
import Modal from '../Modal'
import Alerta from '../Alerta'
import { formatearFecha } from '../../lib/formato'
import {
  crearAnuncio,
  listarAnunciosDocente,
  borrarAnuncio,
} from '../../services/anuncios.service'

// Modal de avisos: redactar un mensaje, elegir a qué grupos va, y ver/borrar
// los ya enviados. Recibe los grupos ya cargados por el dashboard.
export default function AvisosModal({ abierto, onCerrar, docenteId, grupos }) {
  const [anuncios, setAnuncios] = useState([])
  const [cargando, setCargando] = useState(false)
  const [contenido, setContenido] = useState('')
  const [seleccion, setSeleccion] = useState([]) // ids de grupos destino
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState(null) // {tipo, texto}
  const [confirmarId, setConfirmarId] = useState(null)

  useEffect(() => {
    if (!abierto) return
    let activo = true
    setCargando(true)
    setAviso(null)
    setConfirmarId(null)
    listarAnunciosDocente(docenteId)
      .then((a) => activo && setAnuncios(a))
      .catch(
        (e) =>
          activo &&
          setAviso({
            tipo: 'error',
            texto: e?.message || 'No se pudieron cargar los avisos.',
          }),
      )
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [abierto, docenteId])

  const nombreGrupo = (id) => grupos.find((g) => g.id === id)?.nombre || 'grupo'
  const todos = grupos.length > 0 && seleccion.length === grupos.length
  function toggleGrupo(id) {
    setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function enviar(e) {
    e.preventDefault()
    setAviso(null)
    if (!contenido.trim()) {
      return setAviso({ tipo: 'error', texto: 'Escribí el mensaje.' })
    }
    if (seleccion.length === 0) {
      return setAviso({ tipo: 'error', texto: 'Elegí al menos un grupo.' })
    }
    setEnviando(true)
    try {
      await crearAnuncio(docenteId, contenido.trim(), seleccion)
      setContenido('')
      setSeleccion([])
      setAviso({ tipo: 'exito', texto: '¡Aviso enviado a tus estudiantes!' })
      setAnuncios(await listarAnunciosDocente(docenteId))
    } catch (err) {
      setAviso({ tipo: 'error', texto: err?.message || 'No se pudo enviar.' })
    } finally {
      setEnviando(false)
    }
  }

  async function borrar(id) {
    try {
      await borrarAnuncio(id)
      setConfirmarId(null)
      setAnuncios((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      setAviso({ tipo: 'error', texto: err?.message || 'No se pudo borrar.' })
    }
  }

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="📢 Avisos" size="ancho">
      <form onSubmit={enviar}>
        <label htmlFor="msg-aviso" className="etiqueta">
          Mensaje para tus estudiantes
        </label>
        <textarea
          id="msg-aviso"
          className="campo min-h-[84px] resize-y"
          placeholder="Ej: Recuerden traer el material para el laboratorio del viernes."
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
        />

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="etiqueta mb-0">
              ¿A qué grupos?
              {seleccion.length > 0 && (
                <span className="font-normal text-tinta/60">
                  {' '}
                  · {seleccion.length} seleccionado{seleccion.length === 1 ? '' : 's'}
                </span>
              )}
            </span>
            {grupos.length > 0 && (
              <button
                type="button"
                onClick={() => setSeleccion(todos ? [] : grupos.map((g) => g.id))}
                className="text-sm font-medium text-pizarra hover:underline"
              >
                {todos ? 'Quitar todos' : 'Seleccionar todos'}
              </button>
            )}
          </div>
          {grupos.length === 0 ? (
            <p className="text-sm text-tinta/65">Todavía no tenés grupos.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {grupos.map((g) => {
                const on = seleccion.includes(g.id)
                const detalle =
                  [g.materia, g.especialidad, g.nivel].filter(Boolean).join(' · ') ||
                  'Sin materia'
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGrupo(g.id)}
                    aria-pressed={on}
                    className={`flex items-center gap-3 rounded-cuaderno border px-3.5 py-2.5 text-left transition-colors ${
                      on
                        ? 'border-pizarra bg-pizarra/10'
                        : 'border-tinta/15 bg-superficie hover:border-pizarra/40'
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[11px] font-bold transition-colors ${
                        on
                          ? 'border-pizarra bg-pizarra text-papel'
                          : 'border-tinta/30 text-transparent'
                      }`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-tinta">
                        {g.nombre}
                      </span>
                      <span className="block truncate text-xs text-tinta/65">
                        {detalle}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {aviso && (
          <div className="mt-3">
            <Alerta tipo={aviso.tipo}>{aviso.texto}</Alerta>
          </div>
        )}

        <div className="mt-5">
          <button className="btn-primario" disabled={enviando || grupos.length === 0}>
            {enviando
              ? 'Enviando…'
              : seleccion.length > 0
                ? `Enviar a ${seleccion.length} grupo${seleccion.length === 1 ? '' : 's'}`
                : 'Enviar aviso'}
          </button>
        </div>
      </form>

      <div className="mt-6 border-t border-tinta/10 pt-4">
        <h3 className="mb-3 font-display text-base font-bold">Enviados</h3>
        {cargando ? (
          <p className="text-sm text-tinta/65">Cargando…</p>
        ) : anuncios.length === 0 ? (
          <p className="text-sm text-tinta/65">Todavía no enviaste ningún aviso.</p>
        ) : (
          <ul className="space-y-2.5">
            {anuncios.map((a) => (
              <li
                key={a.id}
                className={`rounded-cuaderno border px-4 py-3 transition-colors ${
                  confirmarId === a.id
                    ? 'border-margen/40 bg-margen/5'
                    : 'border-tinta/10 bg-superficie'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-tinta/90">
                    {a.contenido}
                  </p>
                  {confirmarId !== a.id && (
                    <button
                      type="button"
                      onClick={() => setConfirmarId(a.id)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-tinta/55 transition-colors hover:bg-margen/10 hover:text-margen"
                      aria-label="Borrar aviso"
                      title="Borrar"
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
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-tinta/60">
                  {formatearFecha(a.creado_en, false)} ·{' '}
                  {(a.grupo_ids || []).map(nombreGrupo).join(', ') || 'sin grupos'}
                </p>
                {confirmarId === a.id && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-margen/20 pt-3">
                    <span className="text-sm font-medium text-tinta/80">
                      ¿Borrar este aviso?
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmarId(null)}
                        className="btn-accion border border-tinta/20 bg-superficie text-tinta hover:bg-tinta/5"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => borrar(a.id)}
                        className="btn-accion bg-margen text-papel hover:bg-margen/90"
                      >
                        Sí, borrar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
