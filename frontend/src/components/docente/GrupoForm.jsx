import { useState } from 'react'
import Alerta from '../Alerta'
import Modal from '../Modal'
import { cantidadPeriodos, CANTIDADES_PERIODOS } from '../../lib/periodos'
import { listaPresets, PRESETS } from '../../lib/mep'

const PRESETS_MEP = listaPresets()

const ANIO_ACTUAL = new Date().getFullYear()

// Formulario de datos generales de un grupo (sirve para crear y editar).
// Props: inicial (opcional), onGuardar(datos)->Promise, onCancelar, textoBoton.
export default function GrupoForm({
  inicial = {},
  onGuardar,
  onCancelar,
  textoBoton = 'Guardar',
}) {
  const [nombre, setNombre] = useState(inicial.nombre || '')
  const [materia, setMateria] = useState(inicial.materia || '')
  const [especialidad, setEspecialidad] = useState(inicial.especialidad || '')
  const [nivel, setNivel] = useState(inicial.nivel || '')
  // El año lo fija la app (año escolar actual); no se le pregunta al docente.
  const anio = inicial.anio || ANIO_ACTUAL
  // `periodo` guarda la CANTIDAD de periodos del grupo (2 o 3). Ver ADR-001.
  const [periodos, setPeriodos] = useState(
    inicial.id ? cantidadPeriodos(inicial) : 2,
  )
  const [requiereAprobacion, setRequiereAprobacion] = useState(
    inicial.requiere_aprobacion ?? false,
  )
  // Modalidad del MEP (clave de preset) o '' si el grupo no usa Modo MEP.
  const [mepModalidad, setMepModalidad] = useState(inicial.mep_modalidad || '')
  const esEdicion = !!inicial.id
  const modalidadOriginal = inicial.mep_modalidad || ''
  // Se abre al presionar Guardar cuando el cambio sobrescribe los rubros del MEP.
  const [confirmar, setConfirmar] = useState(false)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Si al editar se cambia la modalidad a otra del MEP, al guardar se recargan
  // los rubros oficiales (con confirmación). Es automático: no hay que marcar nada.
  const vaARestablecer =
    esEdicion && !!mepModalidad && mepModalidad !== modalidadOriginal

  async function guardarReal() {
    setConfirmar(false)
    setGuardando(true)
    try {
      await onGuardar(
        {
          nombre,
          materia,
          nivel,
          anio,
          especialidad,
          periodo: String(periodos),
          requiere_aprobacion: requiereAprobacion,
          mep_modalidad: mepModalidad || null,
        },
        { restablecerRubrosMEP: vaARestablecer },
      )
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el grupo. Intentá de nuevo.')
      setGuardando(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) {
      setError('El grupo necesita una sección (ej. 7-3).')
      return
    }
    // Si el guardado sobrescribe los rubros del MEP, confirmar antes con aviso.
    if (vaARestablecer) {
      setConfirmar(true)
      return
    }
    guardarReal()
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
        <div>
          <label htmlFor="g-materia" className="etiqueta">
            Materia
          </label>
          <input
            id="g-materia"
            className="campo"
            placeholder="Ej. Matemática"
            value={materia}
            onChange={(e) => setMateria(e.target.value)}
          />
          <p className="mt-1 text-sm text-tinta/60">
            Si es técnico, acá va la sub-área (ej. Diseño de Software).
          </p>
        </div>

        <div>
          <label htmlFor="g-especialidad" className="etiqueta">
            Especialidad <span className="text-tinta/55">(opcional)</span>
          </label>
          <input
            id="g-especialidad"
            className="campo"
            placeholder="Ej. Desarrollo Web"
            value={especialidad}
            onChange={(e) => setEspecialidad(e.target.value)}
          />
          <p className="mt-1 text-sm text-tinta/60">
            Solo si es técnico. En materias regulares dejalo vacío.
          </p>
        </div>

        <div>
          <label htmlFor="g-nombre" className="etiqueta">
            Sección
          </label>
          <input
            id="g-nombre"
            className="campo"
            placeholder="Ej. 7-3"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="g-nivel" className="etiqueta">
            Nivel
          </label>
          <input
            id="g-nivel"
            className="campo"
            placeholder="Ej. Sétimo"
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="g-periodos" className="etiqueta">
          Cantidad de periodos
        </label>
        <select
          id="g-periodos"
          className="campo"
          value={periodos}
          onChange={(e) => setPeriodos(Number(e.target.value))}
        >
          {CANTIDADES_PERIODOS.map((n) => (
            <option key={n} value={n}>
              {n} periodos
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-tinta/60">
          El grupo dura todo el año; las notas van por periodo.
        </p>
      </div>

      <div>
        <label htmlFor="g-mep" className="etiqueta">
          Modo MEP (opcional)
        </label>
        <select
          id="g-mep"
          className="campo"
          value={mepModalidad}
          onChange={(e) => setMepModalidad(e.target.value)}
        >
          <option value="">Sin Modo MEP (rubros libres)</option>
          {PRESETS_MEP.map((p) => (
            <option key={p.clave} value={p.clave}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-tinta/60">
          Si elegís una modalidad, los rubros oficiales del MEP se cargan solos.
          Después podés ajustarlos en la pestaña Rubros.
        </p>

        {mepModalidad && PRESETS[mepModalidad] && (
          <div className="mt-2 rounded-cuaderno border border-tinta/12 bg-tinta/[0.03] px-3 py-2 text-sm text-tinta/75">
            <p className="mb-1 font-medium text-tinta">
              Rubros que se van a cargar:
            </p>
            <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
              {PRESETS[mepModalidad].rubros.map((r) => (
                <li key={r.nombre}>
                  {r.nombre} <b className="text-tinta">{r.porcentaje}%</b>
                </li>
              ))}
              {!PRESETS[mepModalidad].sinAsistencia && (
                <li>
                  Asistencia <b className="text-tinta">5%</b>
                </li>
              )}
            </ul>
            <p className="mt-1 text-tinta/65">
              Mínimo para aprobar: {PRESETS[mepModalidad].umbral}. Todo editable
              después.
            </p>
          </div>
        )}

      </div>

      <label className="flex items-start gap-2.5 text-sm text-tinta/80">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-pizarra"
          checked={requiereAprobacion}
          onChange={(e) => setRequiereAprobacion(e.target.checked)}
        />
        <span>
          Requiere mi aprobación para unirse
          <span className="block text-sm text-tinta/60">
            Si lo activás, los estudiantes que usen el código quedan pendientes
            hasta que vos los aprobés.
          </span>
        </span>
      </label>

      <Alerta tipo="error">{error}</Alerta>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secundario">
          Cancelar
        </button>
        <button type="submit" className="btn-primario" disabled={guardando}>
          {guardando ? 'Guardando…' : textoBoton}
        </button>
      </div>
    </form>

    {/* Confirmación al sobrescribir los rubros con los oficiales del MEP. */}
    <Modal
      abierto={confirmar}
      onCerrar={() => !guardando && setConfirmar(false)}
      titulo="¿Restablecer los rubros del MEP?"
    >
      <p className="text-sm leading-relaxed text-tinta/80">
        Se <b>sobrescriben los rubros de todos los periodos</b> por los oficiales de
        esta modalidad y cambia el cálculo de notas del grupo. Las actividades ya
        creadas conservan su rubro por nombre; las que queden con un rubro que ya no
        existe dejan de contar hasta que las reubiqués (te avisamos en Notas).
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="btn-secundario"
          onClick={() => setConfirmar(false)}
          disabled={guardando}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn-primario !bg-margen hover:!bg-margen/90"
          onClick={guardarReal}
          disabled={guardando}
        >
          {guardando ? 'Guardando…' : 'Restablecer y guardar'}
        </button>
      </div>
    </Modal>
    </>
  )
}
