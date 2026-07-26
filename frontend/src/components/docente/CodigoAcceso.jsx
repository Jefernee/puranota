import { useState } from 'react'
import { regenerarCodigo } from '../../services/grupos.service'

// Barra compacta con el código de acceso, copiar y regenerar (RPC).
// Props: grupoId, codigo, onCambio(nuevoCodigo).
export default function CodigoAcceso({ grupoId, codigo, onCambio }) {
  const [copiado, setCopiado] = useState(false)
  const [regenerando, setRegenerando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [error, setError] = useState('')

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {
      setError('No se pudo copiar. Copialo a mano.')
    }
  }

  async function regenerar() {
    setError('')
    setRegenerando(true)
    try {
      const nuevo = await regenerarCodigo(grupoId)
      onCambio(nuevo)
      setConfirmar(false)
    } catch (e) {
      setError(e?.message || 'No se pudo regenerar el código.')
    } finally {
      setRegenerando(false)
    }
  }

  return (
    <div className="tarjeta-cuaderno inline-flex max-w-full flex-col px-4 py-2 pl-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-tinta/65">Código:</span>
        <span className="select-all font-display text-lg font-bold tracking-[0.18em] text-pizarra">
          {codigo}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={copiar}
            className="btn-accion bg-pizarra/10 text-pizarra hover:bg-pizarra/20"
          >
            {copiado ? '¡Copiado!' : 'Copiar'}
          </button>
          <button
            onClick={() => setConfirmar((v) => !v)}
            className="btn-accion text-tinta/60 hover:bg-tinta/5"
            title="Regenerar código"
          >
            Regenerar
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-margen">{error}</p>}

      {confirmar && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-tinta/10 pt-2 text-sm">
          <span className="text-tinta/70">
            El código anterior dejará de funcionar. ¿Seguro?
          </span>
          <button
            onClick={regenerar}
            disabled={regenerando}
            className="btn-accion bg-guaria/10 text-guaria hover:bg-guaria/20"
          >
            {regenerando ? 'Regenerando…' : 'Sí, regenerar'}
          </button>
          <button
            onClick={() => setConfirmar(false)}
            className="btn-accion text-tinta/60 hover:bg-tinta/5"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
