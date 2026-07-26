import { useState } from 'react'

// Campo de contraseña con botón para mostrar/ocultar lo escrito.
// Reemplaza a un <input type="password" className="campo" />. Acepta las mismas
// props básicas (id, value, onChange, placeholder, autoComplete, required, autoFocus).
export default function CampoContrasena({
  id,
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  required = false,
  autoFocus = false,
}) {
  const [ver, setVer] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={ver ? 'text' : 'password'}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className="campo pr-11"
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-cuaderno p-2 text-tinta/60 hover:text-pizarra"
        aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={ver}
        title={ver ? 'Ocultar' : 'Mostrar'}
        tabIndex={-1}
      >
        {ver ? (
          // ojo tachado
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          // ojo
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}
