import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { completarOnboarding } from '../services/perfil.service'
import { cerrarSesion, definirPregunta } from '../services/auth.service'
import { PREGUNTAS_SEGURIDAD } from '../lib/preguntas-seguridad'
import AuthShell from '../components/AuthShell'
import Alerta from '../components/Alerta'

export default function Onboarding() {
  const { usuario, refrescarPerfil } = useAuth()
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [seccion, setSeccion] = useState('')
  const [pregunta, setPregunta] = useState(PREGUNTAS_SEGURIDAD[0])
  const [respuesta, setRespuesta] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const nombreLimpio = nombre.trim()
    const telefonoLimpio = telefono.replace(/\D/g, '')

    if (nombreLimpio.split(' ').filter(Boolean).length < 2) {
      setError('Escribí tu nombre completo (nombre y apellido).')
      return
    }
    if (telefonoLimpio.length !== 8) {
      setError('El teléfono debe tener 8 dígitos (formato de Costa Rica).')
      return
    }
    if (!seccion.trim()) {
      setError('Indicá tu sección (ej. 7-3).')
      return
    }
    if (respuesta.trim().length < 2) {
      setError('Escribí la respuesta a tu pregunta de seguridad.')
      return
    }

    setCargando(true)
    try {
      // Primero la pregunta de seguridad: si falla, no marcamos onboarding listo.
      await definirPregunta(pregunta, respuesta)
      await completarOnboarding(usuario.id, {
        nombre: nombreLimpio,
        telefono: telefonoLimpio,
        seccion,
      })
      const p = await refrescarPerfil()
      // Redirección por rol.
      navigate(p?.rol === 'docente' ? '/docente' : '/estudiante', {
        replace: true,
      })
    } catch (err) {
      setError(err?.message || 'No se pudo guardar. Intentá de nuevo.')
      setCargando(false)
    }
  }

  async function handleSalir() {
    await cerrarSesion()
    navigate('/login', { replace: true })
  }

  return (
    <AuthShell
      titulo="Completá tu perfil"
      subtitulo="Solo una vez, para dejar tu cuaderno listo."
      pie={
        <button onClick={handleSalir} className="text-tinta/60 hover:underline">
          Cerrar sesión
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="nombre" className="etiqueta">
            Nombre completo
          </label>
          <input
            id="nombre"
            type="text"
            autoComplete="name"
            required
            className="campo"
            placeholder="Ej. María Fernández Rojas"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="telefono" className="etiqueta">
            Teléfono (8 dígitos)
          </label>
          <input
            id="telefono"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            required
            maxLength={9}
            className="campo"
            placeholder="8888-8888"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="seccion" className="etiqueta">
            Sección
          </label>
          <input
            id="seccion"
            type="text"
            required
            className="campo"
            placeholder="Ej. 7-3"
            value={seccion}
            onChange={(e) => setSeccion(e.target.value)}
          />
        </div>

        <div className="rounded-cuaderno border border-tinta/10 bg-tinta/[0.03] p-3">
          <p className="mb-2 text-xs text-tinta/60">
            Pregunta de seguridad — te sirve para recuperar tu contraseña si la
            olvidás (no usamos correo). Elegí algo que solo vos sepás.
          </p>
          <div>
            <label htmlFor="pregunta" className="etiqueta">
              Pregunta
            </label>
            <select
              id="pregunta"
              className="campo"
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
            >
              {PREGUNTAS_SEGURIDAD.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <label htmlFor="respuesta" className="etiqueta">
              Respuesta
            </label>
            <input
              id="respuesta"
              type="text"
              className="campo"
              placeholder="Tu respuesta"
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
            />
            <p className="mt-1 text-xs text-tinta/60">
              No importan mayúsculas ni espacios al inicio/fin. Acordate bien de
              cómo la escribís.
            </p>
          </div>
        </div>

        <Alerta tipo="error">{error}</Alerta>

        <button type="submit" className="btn-primario w-full" disabled={cargando}>
          {cargando ? 'Guardando…' : 'Guardar y continuar'}
        </button>
      </form>
    </AuthShell>
  )
}
