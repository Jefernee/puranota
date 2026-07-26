// Lista de archivos de solo lectura (material del docente, adjuntos de clase).
//
// TODAS las filas tienen la misma altura y la misma estructura: miniatura o
// ficha de extensión, nombre, y botón de descarga. Antes las fotos iban como
// tarjetas grandes y los documentos como filas finas, así que unos archivos se
// veían mucho más grandes que otros dentro de la misma lista.
//
// La miniatura deja reconocer una foto de un vistazo; para verla completa se
// toca y se abre.
//
// Props: archivos [{url, nombre, tipo}].

function esImagen(a) {
  return a.tipo?.startsWith('image/')
}

function extension(a) {
  if (a.tipo === 'application/pdf' || a.nombre?.toLowerCase().endsWith('.pdf'))
    return 'PDF'
  return a.nombre?.includes('.')
    ? a.nombre.split('.').pop().toUpperCase().slice(0, 4)
    : 'DOC'
}

function descripcion(a) {
  if (esImagen(a)) return 'Imagen'
  const e = extension(a)
  return e === 'PDF' ? 'Documento PDF' : `Archivo ${e}`
}

// Descarga de verdad (blob) para forzar la bajada; si falla (CORS, red), abre
// en una pestaña como respaldo.
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

function IconoDescarga() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 12 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}

export default function GaleriaArchivos({ archivos = [] }) {
  if (archivos.length === 0)
    return <p className="text-[15px] text-tinta/65">Sin archivos.</p>

  return (
    <ul className="divide-y divide-tinta/10 overflow-hidden rounded-cuaderno border border-tinta/12 bg-superficie">
      {archivos.map((a) => (
        <li key={a.id ?? a.url}>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="group flex min-w-0 flex-1 items-center gap-3"
              title={`Abrir ${a.nombre}`}
            >
              {/* Misma caja de 40×40 para todos: la lista queda pareja. */}
              {esImagen(a) ? (
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-tinta/12 bg-tinta/[0.03]">
                  <img
                    src={a.url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </span>
              ) : (
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-tinta/12 bg-tinta/[0.04] text-[11px] font-bold text-tinta/70 transition-colors group-hover:border-pizarra/30 group-hover:text-pizarra"
                  aria-hidden="true"
                >
                  {extension(a)}
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="block break-words text-[15px] font-medium leading-snug text-tinta transition-colors group-hover:text-pizarra">
                  {a.nombre}
                </span>
                <span className="mt-0.5 block text-sm text-tinta/60">
                  {descripcion(a)}
                </span>
              </span>
            </a>

            <button
              type="button"
              onClick={() => descargar(a)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-tinta/60 transition-colors hover:bg-pizarra hover:text-papel"
              title={`Descargar ${a.nombre}`}
              aria-label={`Descargar ${a.nombre}`}
            >
              <IconoDescarga />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
