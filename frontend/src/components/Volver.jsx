import { Link, useNavigate, useLocation } from 'react-router-dom'

// Botón "volver": flecha dentro de un círculo + texto. Estilo claramente de
// "atrás" (verde, sin caja blanca), distinto de los botones de filtro/acción.
// - Por defecto es un enlace a `to`.
// - `atras`: regresa a la página anterior del historial (respaldo a `to`).
// - `onClick`: acción propia (ej. cerrar una vista inline sin cambiar de ruta).
const ESTILO =
  'group inline-flex items-center gap-2 text-sm font-semibold text-pizarra'

function Contenido({ children }) {
  return (
    <>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-pizarra/10 text-pizarra transition-colors group-hover:bg-pizarra/20">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="transition-transform group-hover:-translate-x-0.5"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </span>
      {children}
    </>
  )
}

export default function Volver({
  to = '/',
  atras = false,
  onClick,
  children = 'Volver',
  className = '',
}) {
  const navigate = useNavigate()
  const location = useLocation()

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${ESTILO} ${className}`}>
        <Contenido>{children}</Contenido>
      </button>
    )
  }

  if (atras) {
    const handleClick = () => {
      if (location.key && location.key !== 'default') navigate(-1)
      else navigate(to)
    }
    return (
      <button type="button" onClick={handleClick} className={`${ESTILO} ${className}`}>
        <Contenido>{children}</Contenido>
      </button>
    )
  }

  return (
    <Link to={to} className={`${ESTILO} ${className}`}>
      <Contenido>{children}</Contenido>
    </Link>
  )
}
