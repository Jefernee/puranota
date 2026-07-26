import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { cerrarSesion } from '../services/auth.service'
import Logo from './Logo'
import MenuAcciones from './MenuAcciones'
import { temaActual, alternarTema } from '../lib/tema'

// Cabecera + contenedor para las áreas autenticadas (docente / estudiante).
// `ancho`:
//   - 'normal'   (1440px) dashboards con rejillas
//   - 'amplio'   (1400px) vistas con barra lateral (detalle de grupo)
//   - 'estrecho' (max-w-4xl) vistas de lectura/edición de una columna
export default function Layout({ children, ancho = 'normal' }) {
  const { perfil, esDocente } = useAuth()
  const navigate = useNavigate()
  const [saliendo, setSaliendo] = useState(false)
  const [tema, setTema] = useState(temaActual)
  // Anchos generosos para aprovechar monitores grandes, con gutter lateral.
  const maxW =
    ancho === 'amplio'
      ? 'max-w-[1680px]'
      : ancho === 'estrecho'
        ? 'max-w-4xl'
        : ancho === 'medio'
          ? 'max-w-6xl'
          : 'max-w-[1680px]'

  async function handleSalir() {
    setSaliendo(true)
    try {
      await cerrarSesion()
      navigate('/login', { replace: true })
    } catch (e) {
      console.error('Error al cerrar sesión:', e)
      setSaliendo(false)
    }
  }

  const nombreCorto = perfil?.nombre?.split(' ')[0] || 'Mi cuenta'
  const inicial = (perfil?.nombre?.trim()?.[0] || '?').toUpperCase()

  return (
    <div className="min-h-screen bg-papel">
      <header className="sticky top-0 z-10 border-b border-tinta/10 bg-papel/90 backdrop-blur">
        <div className={`mx-auto flex ${maxW} items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8`}>
          <Logo className="text-xl" />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTema(alternarTema())}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-tinta/15 bg-superficie text-tinta/70 shadow-sm transition-colors hover:border-pizarra/40 hover:text-pizarra"
              title={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label={
                tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
              }
            >
              {tema === 'dark' ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            <MenuAcciones
            etiqueta="Mi cuenta"
            anchoMenu="w-56"
            triggerClassName="flex items-center gap-2 rounded-full border border-tinta/15 bg-superficie py-1 pl-1 pr-2 shadow-sm transition-colors hover:border-pizarra/40 hover:bg-tinta/[0.03] sm:pr-2.5"
            trigger={
              <>
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-papel ${
                    esDocente ? 'bg-guaria' : 'bg-pizarra'
                  }`}
                >
                  {inicial}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-semibold text-tinta">
                    {nombreCorto}
                  </span>
                  <span
                    className={`block text-sm font-medium ${
                      esDocente ? 'text-guaria' : 'text-pizarra'
                    }`}
                  >
                    {esDocente ? 'Docente' : 'Estudiante'}
                  </span>
                </span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="mr-0.5 shrink-0 text-tinta/55"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </>
            }
            items={[
              { label: 'Mi cuenta', onClick: () => navigate('/cuenta') },
              ...(esDocente
                ? [
                    {
                      label: 'Reglamento MEP 2026',
                      onClick: () =>
                        window.open(
                          '/reglamento-mep-2026.pdf',
                          '_blank',
                          'noopener,noreferrer',
                        ),
                    },
                  ]
                : []),
              {
                label: saliendo ? 'Saliendo…' : 'Cerrar sesión',
                onClick: handleSalir,
                tono: 'margen',
              },
            ]}
            />
          </div>
        </div>
      </header>

      <main className={`mx-auto ${maxW} px-4 py-6 sm:px-6 sm:py-8 lg:px-8`}>
        {children}
      </main>
    </div>
  )
}
