import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import Alerta from '../components/Alerta'
import CampoContrasena from '../components/CampoContrasena'
import Volver from '../components/Volver'
import {
  cambiarContrasena,
  definirPregunta,
  cambiarCorreo,
} from '../services/auth.service'
import { actualizarPerfil } from '../services/perfil.service'
import { PREGUNTAS_SEGURIDAD } from '../lib/preguntas-seguridad'

export default function MiCuenta() {
  const { perfil, esDocente } = useAuth()
  const inicial = (perfil?.nombre?.trim()?.[0] || '?').toUpperCase()

  return (
    <Layout
      ancho="normal"
      // La barra lleva el CURSO cuando hay uno. Acá no hay: es la cuenta del
      // usuario, no un grupo. Por eso el título va abajo, en el cuerpo.
      volver={
        <Volver to="/" atras>
          Volver
        </Volver>
      }
    >
      <div className="mb-4 lg:hidden">
        <Volver to="/" atras>
          Volver
        </Volver>
      </div>

      {/* Centrado en escritorio, donde el título encabeza las tres columnas;
          alineado a la izquierda en celular, que es una sola columna. */}
      <h1 className="mb-4 text-xl font-bold leading-tight text-tinta sm:text-2xl lg:text-center">
        Mi cuenta
      </h1>

      {/* Ficha de identidad: quién sos, en una tarjeta como el resto de la
          pantalla. Antes era texto suelto sobre el fondo y se leía plano. */}

      <div className="tarjeta-cuaderno mb-5 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5 sm:pl-7">
        <span
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-full text-xl font-bold text-papel shadow-sm ${
            esDocente ? 'bg-guaria' : 'bg-pizarra'
          }`}
        >
          {inicial}
        </span>
        <div className="min-w-0">
          <p className="break-words text-xl font-bold leading-tight text-tinta">
            {perfil?.nombre || 'Mi cuenta'}
          </p>
          {perfil?.correo && (
            <p className="mt-0.5 break-all text-sm text-tinta/65">{perfil.correo}</p>
          )}
        </div>
        <span
          className={`ml-auto shrink-0 rounded-full border px-3 py-1 text-sm font-medium ${
            esDocente
              ? 'border-guaria/25 bg-guaria/10 text-guaria'
              : 'border-pizarra/20 bg-pizarra/10 text-pizarra'
          }`}
        >
          {esDocente ? 'Docente' : 'Estudiante'}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        <DatosPersonales perfil={perfil} />
        <CambiarClave />
        <PreguntaSeguridad perfil={perfil} />
      </div>
    </Layout>
  )
}

function DatosPersonales({ perfil }) {
  const { usuario, refrescarPerfil } = useAuth()
  const [nombre, setNombre] = useState(perfil?.nombre || '')
  const [telefono, setTelefono] = useState(perfil?.telefono || '')
  const [seccion, setSeccion] = useState(perfil?.seccion || '')
  const [correo, setCorreo] = useState(perfil?.correo || '')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setOk('')
    if (!nombre.trim()) {
      setError('El nombre no puede quedar vacío.')
      return
    }
    const tel = telefono.trim()
    if (tel && !/^\d{8}$/.test(tel)) {
      setError('El teléfono debe tener 8 dígitos.')
      return
    }
    const nuevoCorreo = correo.trim().toLowerCase()
    const correoActual = (perfil?.correo || '').toLowerCase()
    const cambioCorreo = !!nuevoCorreo && nuevoCorreo !== correoActual
    if (cambioCorreo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevoCorreo)) {
      setError('El correo no es válido.')
      return
    }
    setCargando(true)
    try {
      // El correo (es el login) lo cambia la Edge Function: auth + perfiles, al
      // instante. El resto de datos van directo a la tabla perfiles.
      if (cambioCorreo) await cambiarCorreo(nuevoCorreo)
      await actualizarPerfil(usuario.id, { nombre, telefono: tel, seccion })
      await refrescarPerfil()
      setOk('Datos actualizados.')
    } catch (err) {
      setError(err?.message || 'No se pudieron guardar los datos.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="tarjeta-cuaderno space-y-3 px-4 py-4 sm:px-5 sm:pl-7"
      noValidate
    >
      <p className="-mx-4 border-b border-tinta/10 px-4 pb-2.5 font-display text-base font-semibold text-tinta sm:-mx-5 sm:-ml-7 sm:px-5 sm:pl-7">
        Datos personales
      </p>
      <div>
        <label htmlFor="d-nombre" className="etiqueta">
          Nombre completo
        </label>
        <input
          id="d-nombre"
          className="campo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="d-tel" className="etiqueta">
          Teléfono
        </label>
        <input
          id="d-tel"
          className="campo"
          inputMode="numeric"
          maxLength={8}
          placeholder="88887777"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <div>
        <label htmlFor="d-seccion" className="etiqueta">
          Sección
        </label>
        <input
          id="d-seccion"
          className="campo"
          value={seccion}
          onChange={(e) => setSeccion(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="d-correo" className="etiqueta">
          Correo
        </label>
        <input
          id="d-correo"
          type="email"
          className="campo"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
        <p className="mt-1 text-sm text-tinta/65">
          Es también tu usuario para iniciar sesión.
        </p>
      </div>
      <Alerta tipo="error">{error}</Alerta>
      <Alerta tipo="exito">{ok}</Alerta>
      <button className="btn-primario w-full" disabled={cargando}>
        {cargando ? 'Guardando…' : 'Guardar datos'}
      </button>
    </form>
  )
}

function CambiarClave() {
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setOk('')
    if (nueva.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (nueva !== confirmar) {
      setError('Las contraseñas nuevas no coinciden.')
      return
    }
    setCargando(true)
    try {
      // La sesión ya está iniciada: no hace falta re-pedir la contraseña actual.
      await cambiarContrasena(nueva)
      setOk('Contraseña actualizada.')
      setNueva('')
      setConfirmar('')
    } catch (err) {
      setError(err?.message || 'No se pudo cambiar la contraseña.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="tarjeta-cuaderno space-y-3 px-4 py-4 sm:px-5 sm:pl-7" noValidate>
      <p className="-mx-4 border-b border-tinta/10 px-4 pb-2.5 font-display text-base font-semibold text-tinta sm:-mx-5 sm:-ml-7 sm:px-5 sm:pl-7">
        Cambiar contraseña
      </p>
      <div>
        <label htmlFor="c-nueva" className="etiqueta">
          Nueva contraseña
        </label>
        <CampoContrasena
          id="c-nueva"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="c-confirmar" className="etiqueta">
          Repetí la nueva
        </label>
        <CampoContrasena
          id="c-confirmar"
          autoComplete="new-password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          required
        />
      </div>
      <Alerta tipo="error">{error}</Alerta>
      <Alerta tipo="exito">{ok}</Alerta>
      <button className="btn-primario w-full" disabled={cargando}>
        {cargando ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}

function PreguntaSeguridad({ perfil }) {
  const [pregunta, setPregunta] = useState(
    perfil?.pregunta_seguridad || PREGUNTAS_SEGURIDAD[0],
  )
  const [respuesta, setRespuesta] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setOk('')
    if (respuesta.trim().length < 2) {
      setError('Escribí la respuesta.')
      return
    }
    setCargando(true)
    try {
      await definirPregunta(pregunta, respuesta)
      setOk('Pregunta de seguridad actualizada.')
      setRespuesta('')
    } catch (err) {
      setError(err?.message || 'No se pudo guardar.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="tarjeta-cuaderno space-y-3 px-4 py-4 sm:px-5 sm:pl-7" noValidate>
      <p className="-mx-4 border-b border-tinta/10 px-4 pb-2.5 font-display text-base font-semibold text-tinta sm:-mx-5 sm:-ml-7 sm:px-5 sm:pl-7">
        Pregunta de seguridad
      </p>
      <p className="text-sm text-tinta/70">
        Sirve para recuperar tu contraseña sin correo. Por seguridad no mostramos
        tu respuesta anterior; si la cambiás, escribí una nueva.
      </p>
      <div>
        <label htmlFor="p-pregunta" className="etiqueta">
          Pregunta
        </label>
        <select
          id="p-pregunta"
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
      <div>
        <label htmlFor="p-respuesta" className="etiqueta">
          Respuesta
        </label>
        <input
          id="p-respuesta"
          type="text"
          className="campo"
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
        />
      </div>
      <Alerta tipo="error">{error}</Alerta>
      <Alerta tipo="exito">{ok}</Alerta>
      <button className="btn-primario w-full" disabled={cargando}>
        {cargando ? 'Guardando…' : 'Guardar pregunta'}
      </button>
    </form>
  )
}
