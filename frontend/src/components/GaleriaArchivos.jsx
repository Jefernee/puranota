// Galería de solo lectura para ver archivos (imágenes / PDF / otros).
// Cada archivo es una tarjeta: miniatura arriba, nombre completo + descarga abajo.
// Props: archivos [{url,nombre,tipo}].

// Descarga el archivo de verdad (blob) para forzar la bajada; si falla (CORS,
// red), abre en una pestaña como respaldo.
async function descargar(a) {
  try {
    const resp = await fetch(a.url)
    if (!resp.ok) throw new Error('no-ok')
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = a.nombre || 'archivo'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch {
    window.open(a.url, '_blank', 'noopener')
  }
}

export default function GaleriaArchivos({ archivos = [] }) {
  if (archivos.length === 0)
    return <p className="text-sm text-tinta/65">Sin archivos.</p>

  return (
    <ul
      className="grid gap-3"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
    >
      {archivos.map((a) => {
        const esImagen = a.tipo?.startsWith('image/')
        const esPdf =
          a.tipo === 'application/pdf' ||
          a.nombre?.toLowerCase().endsWith('.pdf')
        const ext = a.nombre?.includes('.')
          ? a.nombre.split('.').pop().toUpperCase().slice(0, 4)
          : ''
        return (
          <li
            key={a.id ?? a.url}
            className="flex flex-col overflow-hidden rounded-cuaderno border border-tinta/12 bg-superficie shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Miniatura: abre el archivo en una pestaña */}
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="group block"
              title={`Abrir ${a.nombre}`}
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-tinta/[0.03]">
                {esImagen ? (
                  <img
                    src={a.url}
                    alt={a.nombre}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center bg-gradient-to-b from-pizarra/[0.07] to-pizarra/[0.02]">
                    <div className="flex h-12 w-9 flex-col overflow-hidden rounded-md border border-pizarra/25 bg-superficie shadow-sm transition-transform duration-200 group-hover:scale-105">
                      <div className="h-2 w-full bg-pizarra" />
                      <div className="flex flex-1 items-center justify-center px-1">
                        <span className="text-[10px] font-extrabold text-pizarra">
                          {esPdf ? 'PDF' : ext || 'DOC'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {esImagen && (
                  <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-papel/90 px-2 py-0.5 text-[10px] font-medium text-pizarra opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
                    Abrir ↗
                  </span>
                )}
              </div>
            </a>

            {/* Pie: nombre completo + botón de descarga */}
            <div className="flex flex-1 items-start gap-1.5 border-t border-tinta/10 px-2.5 py-2">
              <p className="min-w-0 flex-1 break-words text-xs leading-snug text-tinta/75">
                {a.nombre}
              </p>
              <button
                type="button"
                onClick={() => descargar(a)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-tinta/15 bg-superficie text-tinta/60 shadow-sm transition-colors hover:border-pizarra hover:bg-pizarra hover:text-papel"
                title={`Descargar ${a.nombre}`}
                aria-label={`Descargar ${a.nombre}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path d="M12 3v12" />
                  <path d="m7 12 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
