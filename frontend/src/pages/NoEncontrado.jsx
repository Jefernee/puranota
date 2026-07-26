import { Link } from 'react-router-dom'
import Logo from '../components/Logo'

export default function NoEncontrado() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo className="text-3xl" />
      <p className="text-5xl font-bold text-tinta/20">404</p>
      <p className="text-tinta/70">Esta página no existe en el cuaderno.</p>
      <Link to="/" className="btn-primario">
        Volver al inicio
      </Link>
    </div>
  )
}
