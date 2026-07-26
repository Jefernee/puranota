// Estado vacío reutilizable, con ícono, título y texto opcional.
export default function EstadoVacio({ icono = '📝', titulo, children }) {
  return (
    <div className="tarjeta-cuaderno px-4 py-8 sm:px-5 sm:py-10 sm:pl-7 text-center">
      <div className="text-3xl" aria-hidden="true">
        {icono}
      </div>
      {titulo && <p className="mt-2 font-medium text-tinta">{titulo}</p>}
      {children && <p className="mt-1 text-sm text-tinta/60">{children}</p>}
    </div>
  )
}
