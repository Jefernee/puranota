import { useEffect, useRef, useState } from 'react'

// Menú de acciones "⋮" (tres puntitos). Evita botones sueltos que se tocan por
// error cuando la tarjeta entera es clickeable.
// Props: items [{ label, onClick, tono? 'margen', icon? 'ocultar'|'mostrar'|'editar'|'eliminar' }].

function Icono({ nombre }) {
  const comun = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'h-4 w-4 shrink-0',
    'aria-hidden': true,
  }
  if (nombre === 'editar')
    return (
      <svg {...comun}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    )
  if (nombre === 'eliminar')
    return (
      <svg {...comun}>
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      </svg>
    )
  if (nombre === 'ocultar')
    return (
      <svg {...comun}>
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" x2="22" y1="2" y2="22" />
      </svg>
    )
  if (nombre === 'mostrar')
    return (
      <svg {...comun}>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  return null
}

export default function MenuAcciones({
  items = [],
  trigger,
  triggerClassName,
  anchoMenu = 'w-48',
  etiqueta = 'Acciones',
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [abierto])

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={
          triggerClassName ||
          `grid h-8 w-8 place-items-center rounded-full transition-colors ${
            abierto ? 'bg-tinta/10 text-tinta' : 'text-tinta/60 hover:bg-tinta/10 hover:text-tinta'
          }`
        }
        aria-label={etiqueta}
        aria-haspopup="true"
        aria-expanded={abierto}
        title={etiqueta}
      >
        {trigger || (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        )}
      </button>
      {abierto && (
        <div className={`absolute right-0 z-20 mt-1.5 ${anchoMenu} overflow-hidden rounded-cuaderno border border-tinta/10 bg-superficie p-1 shadow-lg ring-1 ring-tinta/5`}>
          {items.map((it, i) => {
            const esBorra = it.tono === 'margen'
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setAbierto(false)
                  it.onClick()
                }}
                className={`flex w-full items-center gap-2.5 rounded-cuaderno px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  esBorra
                    ? 'mt-1 border-t border-tinta/10 pt-2.5 text-margen hover:bg-margen/10'
                    : 'text-tinta/80 hover:bg-pizarra/10 hover:text-pizarra'
                }`}
              >
                {it.icon && <Icono nombre={it.icon} />}
                {it.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
