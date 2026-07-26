import { useEffect } from 'react'

// Modal accesible y centrado. Cierra con Escape o clic en el fondo.
// `size`: 'lg' (por defecto, angosto) o 'ancho' (para formularios con más campos).
export default function Modal({ abierto, onCerrar, titulo, children, size = 'lg' }) {
  useEffect(() => {
    if (!abierto) return
    function onKey(e) {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', onKey)
    // Evita scroll del fondo mientras el modal está abierto.
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-0 sm:items-center sm:p-4"
      onMouseDown={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div
        className={`tarjeta-cuaderno max-h-[90vh] w-full overflow-y-auto rounded-b-none bg-papel px-5 py-5 pl-7 sm:rounded-cuaderno ${
          size === 'ancho' ? 'max-w-2xl' : 'max-w-lg'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-tinta sm:text-xl">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl leading-none text-tinta/60 transition-colors hover:bg-tinta/10 hover:text-tinta"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
