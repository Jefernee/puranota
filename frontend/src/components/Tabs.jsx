// Navegación de pestañas. Orientaciones que comparten estado:
//   - 'horizontal' (default): barra deslizable, con subrayado en la activa.
//   - 'vertical': lista para la barra lateral en escritorio, con relleno en la activa.
//   - 'wrap': pastillas que se acomodan en varias filas, todas visibles.
//   - 'menu': un solo desplegable con la sección activa (ideal en móvil).
// Props: tabs [{id,label,icon}], value, onChange, orientacion.
export default function Tabs({ tabs, value, onChange, orientacion = 'horizontal' }) {
  if (orientacion === 'menu') {
    const activa = tabs.find((t) => t.id === value)
    return (
      <div className="relative mb-4">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-cuaderno border border-pizarra/30 bg-superficie py-3 pl-4 pr-10 text-base font-semibold text-tinta shadow-sm focus:border-pizarra focus:outline-none focus:ring-2 focus:ring-pizarra/20"
          aria-label="Secciones del grupo"
        >
          {tabs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icon ? `${t.icon}  ${t.label}` : t.label}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-lg leading-none text-pizarra"
          aria-hidden="true"
        >
          ▾
        </span>
        {activa?.icon && (
          <span className="sr-only">Sección actual: {activa.label}</span>
        )}
      </div>
    )
  }

  if (orientacion === 'wrap') {
    return (
      <nav
        className="mb-4 flex flex-wrap gap-1.5"
        aria-label="Secciones del grupo"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-1.5 rounded-cuaderno px-3 py-2 text-sm font-semibold transition-colors ${
              value === t.id
                ? 'border border-pizarra bg-pizarra text-papel shadow-sm'
                : 'border border-tinta/15 bg-superficie text-tinta/70 shadow-sm hover:border-pizarra/40 hover:text-pizarra'
            }`}
            aria-current={value === t.id ? 'page' : undefined}
          >
            {t.icon && (
              <span className="text-base leading-none" aria-hidden="true">
                {t.icon}
              </span>
            )}
            {t.label}
          </button>
        ))}
      </nav>
    )
  }

  if (orientacion === 'vertical') {
    return (
      <nav className="flex flex-col gap-1.5" aria-label="Secciones del grupo">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2.5 rounded-cuaderno px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
              value === t.id
                ? 'border border-pizarra bg-pizarra text-papel shadow-sm'
                : 'border border-tinta/15 bg-superficie text-tinta/70 shadow-sm hover:border-pizarra/40 hover:text-pizarra'
            }`}
            aria-current={value === t.id ? 'page' : undefined}
          >
            {t.icon && (
              <span className="text-base leading-none" aria-hidden="true">
                {t.icon}
              </span>
            )}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    )
  }

  return (
    <div className="mb-4 border-b border-tinta/10">
      <div className="scroll-tabs -mb-px">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
              value === t.id
                ? 'border-pizarra text-pizarra'
                : 'border-transparent text-tinta/60 hover:text-tinta'
            }`}
            aria-current={value === t.id ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
