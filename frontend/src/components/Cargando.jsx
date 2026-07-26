import Logo from './Logo'

// Pantalla de carga a pantalla completa mientras se resuelve la sesión.
export default function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-papel">
      <Logo className="text-3xl" />
      <p className="animate-pulse text-sm text-tinta/60">{texto}</p>
    </div>
  )
}
