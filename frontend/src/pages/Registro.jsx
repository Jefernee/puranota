import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registrarse, reenviarConfirmacion } from '../services/auth.service'
import AuthShell from '../components/AuthShell'
import Alerta from '../components/Alerta'
import CampoContrasena from '../components/CampoContrasena'

export default function Registro() {
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [confirmarCorreo, setConfirmarCorreo] = useState(false)
  const [reenviado, setReenviado] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (contrasena.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (contrasena !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)
    try {
      const { necesitaConfirmar } = await registrarse(correo, contrasena)
      if (necesitaConfirmar) {
        // Supabase tiene la confirmación por correo activada.
        setConfirmarCorreo(true)
      } else {
        // Sesión inmediata: el AuthContext la detecta y el enrutador
        // lleva al onboarding.
        navigate('/', { replace: true })
      }
    } catch (err) {
      setError(traducirError(err))
    } finally {
      setCargando(false)
    }
  }

  async function handleReenviar() {
    try {
      await reenviarConfirmacion(correo)
      setReenviado(true)
    } catch (err) {
      setError(traducirError(err))
    }
  }

  if (confirmarCorreo) {
    return (
      <AuthShell
        titulo="Confirmá tu correo"
        subtitulo="Ya casi estás."
        pie={
          <Link to="/login" className="font-medium text-pizarra hover:underline">
            Ir a ingresar
          </Link>
        }
      >
        <div className="space-y-4">
          <Alerta tipo="info">
            Te enviamos un correo a <strong>{correo}</strong>. Abrí el enlace para
            activar tu cuenta y luego ingresá.
          </Alerta>

          {reenviado ? (
            <Alerta tipo="exito">Te reenviamos el correo de confirmación.</Alerta>
          ) : (
            <button
              type="button"
              onClick={handleReenviar}
              className="btn-secundario w-full"
            >
              Reenviar correo de confirmación
            </button>
          )}
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      titulo="Creá tu cuenta"
      subtitulo="Es gratis y toma un minuto."
      pie={
        <>
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="font-medium text-pizarra hover:underline">
            Ingresá
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="correo" className="etiqueta">
            Correo
          </label>
          <input
            id="correo"
            type="email"
            autoComplete="email"
            required
            className="campo"
            placeholder="vos@correo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="contrasena" className="etiqueta">
            Contraseña
          </label>
          <CampoContrasena
            id="contrasena"
            autoComplete="new-password"
            required
            placeholder="Al menos 6 caracteres"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="confirmar" className="etiqueta">
            Repetí la contraseña
          </label>
          <CampoContrasena
            id="confirmar"
            autoComplete="new-password"
            required
            placeholder="••••••••"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />
        </div>

        <Alerta tipo="error">{error}</Alerta>

        <button type="submit" className="btn-primario w-full" disabled={cargando}>
          {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
    </AuthShell>
  )
}

function traducirError(err) {
  const msg = err?.message || ''
  if (/already registered|already exists|user already/i.test(msg))
    return 'Ese correo ya tiene una cuenta. Probá ingresar.'
  if (/password/i.test(msg) && /weak|short|least/i.test(msg))
    return 'La contraseña es muy débil. Usá al menos 6 caracteres.'
  if (/valid email|invalid email/i.test(msg))
    return 'Escribí un correo válido.'
  if (/network|fetch/i.test(msg))
    return 'No se pudo conectar. Revisá tu internet e intentá de nuevo.'
  return msg || 'Ocurrió un error al registrarte. Intentá de nuevo.'
}
