import Logo from './Logo'

// Contenedor centrado para las pantallas de autenticación.
// Tarjeta con margen rojo de cuaderno (clase .tarjeta-cuaderno).
export default function AuthShell({ titulo, subtitulo, children, pie }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 hoja-rayada">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Logo className="text-3xl" />
        </div>

        <div className="tarjeta-cuaderno px-6 py-7 pl-8 sm:px-8 sm:pl-10">
          <h1 className="text-2xl font-bold text-tinta">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-tinta/60">{subtitulo}</p>}

          <div className="mt-6">{children}</div>
        </div>

        {pie && <div className="mt-5 text-center text-sm text-tinta/70">{pie}</div>}
      </div>
    </div>
  )
}
