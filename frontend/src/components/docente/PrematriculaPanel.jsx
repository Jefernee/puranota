import { useEffect, useState } from 'react'
import Alerta from '../Alerta'
import {
  listarPrematriculas,
  agregarPrematriculas,
  quitarPrematricula,
  parsearCorreos,
} from '../../services/grupos.service'

// Pre-matrícula: pegar lista de correos en lote y verlos.
// Cuando uno de esos correos se registre, el trigger lo mete solo al grupo.
export default function PrematriculaPanel({ grupoId }) {
  const [texto, setTexto] = useState('')
  const [lista, setLista] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  async function cargar() {
    setCargando(true)
    try {
      setLista(await listarPrematriculas(grupoId))
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la pre-matrícula.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId])

  // Conteo en vivo de lo que se va a agregar.
  const previa = parsearCorreos(texto)

  async function handleAgregar() {
    setError('')
    setOk('')
    if (previa.validos.length === 0) {
      setError('Pegá al menos un correo válido.')
      return
    }
    setGuardando(true)
    try {
      const { agregados, invalidos } = await agregarPrematriculas(grupoId, texto)
      setTexto('')
      let msg = `Se agregaron ${agregados} correo${agregados === 1 ? '' : 's'}.`
      if (invalidos.length)
        msg += ` Se ignoraron ${invalidos.length} inválido${
          invalidos.length === 1 ? '' : 's'
        }.`
      setOk(msg)
      await cargar()
    } catch (e) {
      setError(e?.message || 'No se pudieron agregar los correos.')
    } finally {
      setGuardando(false)
    }
  }

  async function quitar(id) {
    setError('')
    try {
      await quitarPrematricula(id)
      await cargar()
    } catch (e) {
      setError(e?.message || 'No se pudo quitar el correo.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="tarjeta-cuaderno px-5 py-4 pl-7">
        <label htmlFor="prem" className="etiqueta">
          Pegá la lista de correos
        </label>
        <p className="mb-2 text-xs text-tinta/60">
          Separados por coma, espacio o salto de línea. Cuando cada estudiante se
          registre con ese correo, entra al grupo automáticamente.
        </p>
        <textarea
          id="prem"
          rows={4}
          className="campo font-mono text-sm"
          placeholder={'ana@correo.com\nluis@correo.com, maria@correo.com'}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-tinta/60">
            {previa.validos.length} válido
            {previa.validos.length === 1 ? '' : 's'}
            {previa.invalidos.length > 0 &&
              ` · ${previa.invalidos.length} inválido${
                previa.invalidos.length === 1 ? '' : 's'
              }`}
          </span>
          <button
            onClick={handleAgregar}
            disabled={guardando || previa.validos.length === 0}
            className="btn-primario"
          >
            {guardando ? 'Agregando…' : 'Agregar a pre-matrícula'}
          </button>
        </div>
      </div>

      <Alerta tipo="error">{error}</Alerta>
      <Alerta tipo="exito">{ok}</Alerta>

      {cargando ? (
        <p className="animate-pulse text-tinta/60">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-tinta/60">
          Todavía no hay correos en la pre-matrícula.
        </p>
      ) : (
        <ul className="divide-y divide-tinta/10 overflow-hidden rounded-cuaderno border border-tinta/10 bg-superficie/60">
          {lista.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <span className="truncate text-sm text-tinta">{p.correo}</span>
              <div className="flex items-center gap-2">
                {p.usado ? (
                  <span className="rounded-full bg-pizarra/10 px-2 py-0.5 text-xs font-medium text-pizarra">
                    Ya se unió
                  </span>
                ) : (
                  <span className="rounded-full bg-tinta/10 px-2 py-0.5 text-xs text-tinta/60">
                    Esperando
                  </span>
                )}
                {!p.usado && (
                  <button
                    onClick={() => quitar(p.id)}
                    className="rounded-cuaderno px-2 py-1 text-sm text-tinta/55 hover:bg-margen/10 hover:text-margen"
                    title="Quitar"
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
