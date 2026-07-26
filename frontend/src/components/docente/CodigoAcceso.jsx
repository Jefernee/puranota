import { useState } from 'react'
import Modal from '../Modal'
import Alerta from '../Alerta'
import { regenerarCodigo } from '../../services/grupos.service'

// Código de acceso del grupo, en UNA sola línea compacta.
//
// Antes era una tarjeta con dos filas que en celular empujaba todo el contenido
// del grupo hacia abajo. El código es un dato de consulta ocasional —se comparte
// una vez y ya—, así que no merece ese espacio: va como una barra fina, y
// regenerarlo (que es destructivo) se confirma en un modal aparte.
//
// Props: grupoId, codigo, onCambio(nuevoCodigo).

export default function CodigoAcceso({ grupoId, codigo, onCambio }) {
  const [copiado, setCopiado] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [regenerando, setRegenerando] = useState(false)
  const [error, setError] = useState('')

  async function copiar() {
    setError('')
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
    <>
      <div className="inline-flex max-w-full items-center gap-2 rounded-cuaderno border border-tinta/15 bg-superficie px-3 py-1.5 shadow-sm">
        <span className="shrink-0 text-sm text-tinta/60">Código</span>
        <span className="select-all font-mono text-[15px] font-bold tracking-[0.14em] text-tinta">
          {codigo}
        </span>

        <button
          type="button"
          onClick={copiar}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-tinta/55 transition-colors hover:bg-tinta/5 hover:text-pizarra"
          title={copiado ? '¡Copiado!' : 'Copiar código'}
          aria-label="Copiar código"
        >
          {copiado ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-pizarra"
              aria-hidden="true"
            >
              <path d="m5 12.5 4.5 4.5L19 7" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="12" height="12" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => setConfirmar(true)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-tinta/55 transition-colors hover:bg-tinta/5 hover:text-tinta"
          title="Regenerar código"
          aria-label="Regenerar código"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mt-2">
          <Alerta tipo="error">{error}</Alerta>
        </div>
      )}

      <Modal
        abierto={confirmar}
        onCerrar={() => !regenerando && setConfirmar(false)}
        titulo="¿Regenerar el código?"
      >
        <p className="text-[15px] leading-relaxed text-tinta/80">
          Se va a generar un código nuevo y <b>el actual dejará de funcionar</b>.
          Los estudiantes que ya están en el grupo siguen adentro; solo cambia el
          código para los que se quieran unir de ahora en adelante.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="btn-secundario"
            onClick={() => setConfirmar(false)}
            disabled={regenerando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primario"
            onClick={regenerar}
            disabled={regenerando}
          >
            {regenerando ? 'Regenerando…' : 'Sí, regenerar'}
          </button>
        </div>
      </Modal>
    </>
  )
}
