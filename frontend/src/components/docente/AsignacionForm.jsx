import { useState } from 'react'
import Alerta from '../Alerta'
import RubricaEditor from './RubricaEditor'
import { etiquetaPeriodo } from '../../lib/periodos'
import { ACCEPT } from '../../services/storage.service'

// Formulario para crear/editar una asignación. Sirve para ambos casos.
// Props: inicial (opcional), periodos (array ['I','II'…] del grupo),
//        rubrosPorPeriodo (objeto {I:[…], II:[…]}), periodoInicial,
//        onGuardar(datos)->Promise, onCancelar, textoBoton.
export default function AsignacionForm({
  inicial = {},
  periodos = ['I'],
  rubrosPorPeriodo = {},
  asignacionesExistentes = [],
  clases = [],
  periodoInicial,
  onGuardar,
  onCancelar,
  textoBoton = 'Guardar',
}) {
  const [titulo, setTitulo] = useState(inicial.titulo || '')
  const [instrucciones, setInstrucciones] = useState(inicial.instrucciones || '')
  const [periodo, setPeriodo] = useState(
    inicial.periodo || periodoInicial || periodos[0] || 'I',
  )
  const rubrosDelPeriodo = rubrosPorPeriodo[periodo] || []
  // La asistencia NO se asigna: su nota sale del módulo de asistencia, no de
  // entregas. Se excluye de las opciones de rubro al crear/editar asignaciones.
  const rubrosCalificables = rubrosDelPeriodo.filter((r) => !esRubroAsistencia(r))
  const [rubro, setRubro] = useState(
    inicial.rubro || rubrosCalificables[0]?.nombre || 'Trabajo cotidiano',
  )
  const [puntos, setPuntos] = useState(inicial.puntos ?? 10)
  const [porcentaje, setPorcentaje] = useState(inicial.porcentaje ?? '')
  const [fechaLimite, setFechaLimite] = useState(
    aInputDate(inicial.fecha_limite),
  )
  const [permiteTardias, setPermiteTardias] = useState(
    inicial.permite_tardias ?? true,
  )
  const [penalizacionTardia, setPenalizacionTardia] = useState(
    inicial.penalizacion_tardia ?? 10,
  )
  const [requiereEntrega, setRequiereEntrega] = useState(
    inicial.requiere_entrega ?? true,
  )
  const [visible, setVisible] = useState(inicial.visible ?? true)
  const [rubrica, setRubrica] = useState(
    Array.isArray(inicial.rubrica) ? inicial.rubrica.map((c) => ({ ...c })) : [],
  )
  const [claseId, setClaseId] = useState(inicial.clase_id || '')
  // Archivos de material: existentes (modo edición) + nuevos por subir.
  const [existentes, setExistentes] = useState(
    Array.isArray(inicial.archivos) ? inicial.archivos : [],
  )
  const [seleccion, setSeleccion] = useState([]) // File[]
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Lista de rubros del periodo elegido. Si el rubro guardado ya no existe,
  // lo dejamos visible igual para no perderlo.
  const opcionesRubro = [
    ...new Set([...rubrosCalificables.map((r) => r.nombre), rubro]),
  ].filter(Boolean)

  // Presupuesto de % del rubro: cuánto vale el rubro, cuánto ya está asignado
  // (otras asignaciones del mismo periodo y rubro) y cuánto queda disponible.
  const pctRubro = Number(rubrosDelPeriodo.find((r) => r.nombre === rubro)?.porcentaje) || 0
  const usado = asignacionesExistentes
    .filter((a) => a.periodo === periodo && a.rubro === rubro && a.id !== inicial.id)
    .reduce((s, a) => s + (Number(a.porcentaje) || 0), 0)
  const disponible = Math.round(Math.max(0, pctRubro - usado) * 100) / 100

  // Al cambiar de periodo, si el rubro actual no existe en el nuevo periodo,
  // saltamos al primero disponible (excluyendo asistencia).
  function cambiarPeriodo(nuevo) {
    setPeriodo(nuevo)
    const rubrosNuevo = (rubrosPorPeriodo[nuevo] || []).filter(
      (r) => !esRubroAsistencia(r),
    )
    if (!rubrosNuevo.some((r) => r.nombre === rubro)) {
      setRubro(rubrosNuevo[0]?.nombre || 'Trabajo cotidiano')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!titulo.trim()) {
      setError('La asignación necesita un título.')
      return
    }
    if (!(Number(puntos) > 0)) {
      setError('Los puntos deben ser un número mayor a 0.')
      return
    }
    const pct = Number(porcentaje)
    if (!(pct > 0)) {
      setError('Indicá el porcentaje que vale esta asignación dentro de su rubro.')
      return
    }
    if (pctRubro > 0 && pct > disponible + 1e-9) {
      setError(
        `Te pasás del rubro "${rubro}" (${pctRubro}%). Disponible: ${disponible}%.`,
      )
      return
    }

    const rubricaLimpia = rubrica
      .map((c) => ({
        criterio: (c.criterio || '').trim(),
        puntos: Number(c.puntos) || 0,
      }))
      .filter((c) => c.criterio)

    setGuardando(true)
    try {
      await onGuardar(
        {
          titulo,
          instrucciones,
          periodo,
          rubro,
          puntos,
          porcentaje,
          clase_id: claseId || null,
          archivos: existentes, // los que se conservan; los nuevos se suben aparte
          // La fecha límite es por DÍA: se vence al final de ese día (23:59:59).
          fecha_limite: fechaLimite ? finDeDiaLocalISO(fechaLimite) : null,
          permite_tardias: permiteTardias,
          // Solo aplica si se permiten tardías; si no, no hay entrega tardía posible.
          penalizacion_tardia: permiteTardias ? Number(penalizacionTardia) || 0 : 0,
          requiere_entrega: requiereEntrega,
          visible,
          rubrica: rubricaLimpia,
        },
        seleccion,
      )
    } catch (err) {
      setError(err?.message || 'No se pudo guardar la asignación. Intentá de nuevo.')
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
      {/* Lo esencial */}
      <div className="space-y-3">
        <div>
          <label htmlFor="a-titulo" className="etiqueta">
            Título
          </label>
          <input
            id="a-titulo"
            className="campo"
            placeholder="Ej. Cotidiano #3 — Funciones"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="a-instrucciones" className="etiqueta">
            Instrucciones
          </label>
          <textarea
            id="a-instrucciones"
            className="campo min-h-[68px] resize-y"
            placeholder="Qué deben hacer y entregar…"
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
          />
        </div>
      </div>

      {/* Clasificación */}
      <Seccion titulo="Clasificación">
        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
          <div>
            <label htmlFor="a-periodo" className="etiqueta">
              Periodo
            </label>
            <select
              id="a-periodo"
              className="campo"
              value={periodo}
              onChange={(e) => cambiarPeriodo(e.target.value)}
            >
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {etiquetaPeriodo(p)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="a-rubro" className="etiqueta">
              Rubro
            </label>
            <select
              id="a-rubro"
              className="campo"
              value={rubro}
              onChange={(e) => setRubro(e.target.value)}
            >
              {opcionesRubro.map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        {clases.length > 0 && (
          <div>
            <label htmlFor="a-clase" className="etiqueta">
              Clase <span className="text-tinta/55">(opcional)</span>
            </label>
            <select
              id="a-clase"
              className="campo"
              value={claseId}
              onChange={(e) => setClaseId(e.target.value)}
            >
              <option value="">— Sin clase —</option>
              {clases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </select>
          </div>
        )}
      </Seccion>

      {/* Puntaje */}
      <Seccion titulo="Puntaje">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="a-porcentaje" className="etiqueta">
              % del periodo
            </label>
            <div className="relative">
              <input
                id="a-porcentaje"
                type="number"
                min="0"
                max="100"
                step="0.5"
                className="campo pr-7"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value)}
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-tinta/60">
                %
              </span>
            </div>
            {pctRubro > 0 && (
              <p className="mt-1 text-sm text-tinta/60">
                {rubro}: {pctRubro}% · disponible {disponible}%
              </p>
            )}
          </div>
          <div>
            <label htmlFor="a-puntos" className="etiqueta">
              Puntos (para calificar)
            </label>
            <input
              id="a-puntos"
              type="number"
              min="0"
              step="0.5"
              className="campo"
              value={puntos}
              onChange={(e) => setPuntos(e.target.value)}
            />
          </div>
        </div>
        <div>
          <p className="etiqueta">Rúbrica de calificación</p>
          <RubricaEditor value={rubrica} onChange={setRubrica} puntosTotales={puntos} />
        </div>
      </Seccion>

      {/* Entrega */}
      <Seccion titulo="Entrega">
        <label className="flex items-start gap-2.5 text-sm text-tinta/80">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-pizarra"
            checked={requiereEntrega}
            onChange={(e) => setRequiereEntrega(e.target.checked)}
          />
          <span>
            El estudiante entrega un archivo
            <span className="block text-sm text-tinta/60">
              Desactivalo para una prueba escrita o nota directa: el estudiante no
              sube nada y vos le ponés la nota en Revisión.
            </span>
          </span>
        </label>

        <div>
          <label htmlFor="a-fecha" className="etiqueta">
            Fecha límite <span className="text-tinta/55">(opcional)</span>
          </label>
          <input
            id="a-fecha"
            type="date"
            className="campo w-full sm:w-56"
            value={fechaLimite}
            onChange={(e) => setFechaLimite(e.target.value)}
          />
        </div>

        {requiereEntrega && (
          <div className="space-y-3">
            <label className="flex items-start gap-2.5 text-sm text-tinta/80">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-pizarra"
                checked={permiteTardias}
                onChange={(e) => setPermiteTardias(e.target.checked)}
              />
              <span>
                Permitir entregas tardías
                <span className="block text-sm text-tinta/60">
                  Si lo desactivás, no se podrá entregar después de la fecha límite.
                </span>
              </span>
            </label>

            {permiteTardias && (
              <div className="ml-[26px]">
                <label htmlFor="a-pen" className="mb-1 block text-sm text-tinta/70">
                  Rebaja si entrega tarde
                </label>
                <div className="relative w-28">
                  <input
                    id="a-pen"
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    className="campo pr-7"
                    value={penalizacionTardia}
                    onChange={(e) => setPenalizacionTardia(e.target.value)}
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-tinta/60">
                    %
                  </span>
                </div>
                <p className="mt-1 text-sm text-tinta/60">
                  Se le baja ese % a la nota de esa entrega. Poné 0 para no rebajar.
                </p>
              </div>
            )}
          </div>
        )}
      </Seccion>

      {/* Material para el estudiante */}
      <Seccion titulo="Material para el estudiante">
        <div>
          {existentes.length > 0 && (
            <ul className="mb-2 space-y-1">
              {existentes.map((a) => (
                <li
                  key={a.url}
                  className="flex items-center justify-between gap-2 rounded-cuaderno bg-tinta/5 px-3 py-1.5 text-sm"
                >
                  <span className="break-words text-tinta/80">{a.nombre}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setExistentes((prev) => prev.filter((x) => x.url !== a.url))
                    }
                    className="shrink-0 text-margen hover:underline"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-cuaderno border border-dashed border-tinta/30 px-4 py-3 text-[15px] font-medium text-tinta/75 transition-colors hover:border-pizarra hover:text-pizarra active:bg-pizarra/[0.06] sm:inline-flex sm:w-auto">
            <span>Elegir archivos</span>
            <input
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const nuevos = Array.from(e.target.files)
                e.target.value = ''
                if (nuevos.length) setSeleccion((prev) => [...prev, ...nuevos])
              }}
            />
          </label>
          {seleccion.length > 0 && (
            <ul className="mt-2 space-y-1">
              {seleccion.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-cuaderno bg-pizarra/5 px-3 py-1.5 text-sm"
                >
                  <span className="break-words text-tinta/80">{f.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSeleccion((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="shrink-0 text-margen hover:underline"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-sm text-tinta/60">
            Fotos o PDF (máx 10 MB c/u). Lo ve el estudiante en la asignación.
          </p>
        </div>
      </Seccion>

      {/* Visibilidad */}
      <Seccion titulo="Visibilidad">
        <label className="flex items-start gap-2.5 text-sm text-tinta/80">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-pizarra"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
          />
          <span>
            Visible para los estudiantes
            <span className="block text-sm text-tinta/60">
              Desactivala para prepararla y publicarla después.
            </span>
          </span>
        </label>
      </Seccion>

      <Alerta tipo="error">{error}</Alerta>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
        <button type="button" onClick={onCancelar} className="btn-secundario w-full justify-center sm:w-auto">
          Cancelar
        </button>
        <button type="submit" className="btn-primario w-full justify-center sm:w-auto" disabled={guardando}>
          {guardando ? 'Guardando…' : textoBoton}
        </button>
      </div>
    </form>
  )
}

// Bloque de sección con encabezado sutil y separador, para ordenar el formulario.
function Seccion({ titulo, children }) {
  return (
    <div className="space-y-3 border-t border-tinta/10 pt-4">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-tinta/65">
        {titulo}
      </p>
      {children}
    </div>
  )
}

// La asistencia es un rubro automático (sale del módulo de asistencia), no se
// asigna como actividad. Se detecta por el flag o por el nombre "Asistencia".
function esRubroAsistencia(r) {
  return (
    r?.asistencia === true ||
    (r?.nombre || '').trim().toLowerCase() === 'asistencia'
  )
}

// Convierte un timestamp ISO (o null) a "YYYY-MM-DD" en hora local, para el
// input type="date".
function aInputDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Toma "YYYY-MM-DD" y devuelve el ISO del FIN de ese día en hora local
// (23:59:59.999), que es el vencimiento real.
function finDeDiaLocalISO(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()
}
