import { useEffect, useState } from 'react'
import Alerta from '../Alerta'
import Modal from '../Modal'
import { periodosDeGrupo, etiquetaPeriodo } from '../../lib/periodos'
import { rubrosPorPeriodo } from '../../services/grupos.service'
import {
  resumenAsignacionesPorRubro,
  renombrarRubroEnAsignaciones,
} from '../../services/asignaciones.service'
import { PRESETS } from '../../lib/mep'

// Editor de rubros POR periodo (ver ADR-001).
// - Cada periodo define sus rubros {nombre, porcentaje} que deben sumar 100.
// - Opcionalmente, un rubro de ASISTENCIA automática (se calcula del registro de
//   asistencia) con su % y su regla (tardías por ausencia, si la justificada cuenta).
// - El I Periodo pre-llena los rubros normales de los demás como BORRADOR editable.
// Props: grupo, onGuardar(rubrosPorPeriodoCompleto) -> Promise.

const PERIODOS_TODOS = ['I', 'II', 'III']

const ASIS_POR_DEFECTO = {
  activa: false,
  porcentaje: 0,
  tardiasPorAusencia: 2,
  justificadaCuenta: true,
  mep: false,
}

// Separa un arreglo de rubros guardados en { rubros normales, config de asistencia }.
// Se reconoce como asistencia tanto la marcada (asistencia:true) como cualquier
// rubro llamado "Asistencia" (datos viejos), para no mostrarla dos veces.
function separarAsistencia(arr) {
  const rubros = []
  let asis = { ...ASIS_POR_DEFECTO }
  for (const r of arr || []) {
    const esAsistencia =
      r.asistencia || (r.nombre || '').trim().toLowerCase() === 'asistencia'
    if (esAsistencia) {
      asis = {
        activa: true,
        porcentaje: Number(r.porcentaje) || 0,
        tardiasPorAusencia: Number(r.tardiasPorAusencia) || 2,
        justificadaCuenta: r.justificadaCuenta !== false,
        mep: r.mep === true,
      }
    } else {
      rubros.push({ nombre: r.nombre || '', porcentaje: Number(r.porcentaje) || 0 })
    }
  }
  return { rubros, asis }
}

// Construye el arreglo a guardar para un periodo: rubros normales + asistencia.
function armarPeriodo(rubros, asis) {
  const arr = rubros.map((r) => ({ nombre: r.nombre, porcentaje: r.porcentaje }))
  if (asis.activa && (Number(asis.porcentaje) || 0) > 0) {
    arr.push({
      nombre: 'Asistencia',
      porcentaje: Number(asis.porcentaje) || 0,
      asistencia: true,
      tardiasPorAusencia: Number(asis.tardiasPorAusencia) || 2,
      justificadaCuenta: asis.justificadaCuenta !== false,
      mep: asis.mep === true,
    })
  }
  return arr
}

export default function RubrosEditor({ grupo, onGuardar }) {
  const periodos = periodosDeGrupo(grupo)
  const modalidadMEP = grupo?.mep_modalidad || ''
  const presetMEP = modalidadMEP ? PRESETS[modalidadMEP] : null

  // Estado inicial: separar rubros normales (por periodo) y la asistencia, que es
  // ÚNICA para todo el grupo (el MEP la aplica igual en cada periodo). La primera
  // asistencia activa que aparezca en cualquier periodo define la config global.
  const inicial = () => {
    const porP = rubrosPorPeriodo(grupo)
    const rubros = {}
    let asis = { ...ASIS_POR_DEFECTO }
    for (const p of PERIODOS_TODOS) {
      const s = separarAsistencia(porP[p])
      rubros[p] = s.rubros
      if (s.asis.activa && !asis.activa) asis = s.asis
    }
    return { rubros, asis }
  }

  const ini = inicial()
  // Rubros normales persistidos, por periodo (fuente de verdad de "ya confirmado").
  const [guardado, setGuardado] = useState(ini.rubros)
  // Inputs editables de rubros normales por periodo. Cada fila recuerda su
  // `orig` (el nombre con que se guardó) para detectar renombres al guardar.
  const [borradores, setBorradores] = useState(() => {
    const init = {}
    for (const p of PERIODOS_TODOS) {
      init[p] = ini.rubros[p].length
        ? ini.rubros[p].map((r) => ({ ...r, orig: r.nombre }))
        : [{ nombre: '', porcentaje: 0, orig: undefined }]
    }
    return init
  })
  // Config de asistencia ÚNICA para todo el grupo (igual en todos los periodos).
  const [asistencia, setAsistencia] = useState(ini.asis)
  // Periodos que el docente ya tocó (dejan de espejar al I).
  const [tocados, setTocados] = useState(() => new Set())
  const [periodoActivo, setPeriodoActivo] = useState('I')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [guardando, setGuardando] = useState(false)
  // Resumen de asignaciones por periodo/rubro { I:{Tareas:{count,pct}}, … } para
  // avisar antes de quitar y mostrar cuánto reparten. Se refresca tras guardar.
  const [conteoAsig, setConteoAsig] = useState({})
  // Guardado en espera de confirmación (hay rubros con asignaciones por quitar).
  const [pendiente, setPendiente] = useState(null)

  useEffect(() => {
    if (!grupo?.id) return
    resumenAsignacionesPorRubro(grupo.id)
      .then(setConteoAsig)
      .catch(() => setConteoAsig({}))
  }, [grupo?.id])

  const estaGuardado = (p) => (guardado[p]?.length ?? 0) > 0
  const espejaI =
    periodoActivo !== 'I' && !estaGuardado(periodoActivo) && !tocados.has(periodoActivo)

  const listaActiva = espejaI ? borradores.I : borradores[periodoActivo]
  // La asistencia es global: se muestra idéntica en todos los periodos.
  const asisActiva = asistencia
  const sumaRubros = listaActiva.reduce((acc, r) => acc + (Number(r.porcentaje) || 0), 0)
  const sumaAsis = asisActiva.activa ? Number(asisActiva.porcentaje) || 0 : 0
  const suma = sumaRubros + sumaAsis
  const sumaOk = suma === 100
  const faltante = 100 - suma
  const estado = sumaOk ? 'ok' : suma < 100 ? 'falta' : 'pasa'
  const estadoClase =
    estado === 'ok'
      ? 'border-pizarra/30 bg-pizarra/10 text-pizarra'
      : estado === 'falta'
        ? 'border-amber-500/40 bg-amber-50 text-amber-700'
        : 'border-margen/40 bg-margen/10 text-margen'
  const estadoTexto =
    estado === 'ok'
      ? '¡Listo! Suma 100%'
      : estado === 'falta'
        ? `Te faltan ${faltante}% para llegar a 100`
        : `Te pasaste ${-faltante}% — bajá algún peso`
  // Colores para la barra visual del reparto (uno por rubro; asistencia en morado).
  const COLORES = ['#176B4D', '#C98A00', '#2A6F97', '#6B8E23', '#B5651D', '#4C6EF5']
  const segmentos = [
    ...listaActiva.map((r, i) => ({
      nombre: (r.nombre || '').trim() || 'Rubro',
      pct: Number(r.porcentaje) || 0,
      color: COLORES[i % COLORES.length],
    })),
    ...(asisActiva.activa && sumaAsis > 0
      ? [{ nombre: 'Asistencia', pct: sumaAsis, color: '#8A4FBE' }]
      : []),
  ].filter((s) => s.pct > 0)

  function editarLista(updater) {
    setOk('')
    const p = periodoActivo
    const adoptar = espejaI
    setBorradores((prev) => {
      const base = (adoptar ? prev.I : prev[p]).map((r) => ({ ...r }))
      return { ...prev, [p]: updater(base) }
    })
    if (adoptar) setTocados((prev) => new Set(prev).add(p))
  }

  const actualizar = (i, campo, valor) =>
    editarLista((base) => base.map((r, idx) => (idx === i ? { ...r, [campo]: valor } : r)))
  const agregar = () =>
    editarLista((base) => [...base, { nombre: '', porcentaje: 0, orig: undefined }])
  const quitar = (i) => editarLista((base) => base.filter((_, idx) => idx !== i))

  // La asistencia es global: editarla afecta a todos los periodos por igual.
  function editarAsis(campo, valor) {
    setOk('')
    setAsistencia((prev) => ({ ...prev, [campo]: valor }))
  }

  // Vuelve a incluir la asistencia (con 5% por defecto si no tenía peso).
  function agregarAsistencia() {
    setOk('')
    setAsistencia((prev) => ({
      ...prev,
      activa: true,
      porcentaje: (Number(prev.porcentaje) || 0) > 0 ? prev.porcentaje : 5,
    }))
  }

  function copiarDelPrimero() {
    setOk('')
    const p = periodoActivo
    // Filas nuevas para este periodo: no arrastran el `orig` del I (no son
    // renombres de lo que este periodo tuviera guardado).
    setBorradores((prev) => ({
      ...prev,
      [p]: prev.I.map((r) => ({ nombre: r.nombre, porcentaje: r.porcentaje, orig: undefined })),
    }))
    setTocados((prev) => new Set(prev).add(p))
  }

  async function guardarPeriodo() {
    setError('')
    setOk('')
    const p = periodoActivo

    // Filas actuales con su nombre original (para detectar renombres).
    const filas = listaActiva.map((r) => ({
      nombre: (r.nombre || '').trim(),
      porcentaje: Number(r.porcentaje) || 0,
      orig: (r.orig || '').trim(),
    }))
    const limpios = filas.map(({ nombre, porcentaje }) => ({ nombre, porcentaje }))

    if (limpios.some((r) => !r.nombre)) {
      setError('Cada rubro necesita un nombre.')
      return
    }
    if (limpios.some((r) => r.porcentaje <= 0)) {
      setError('Cada rubro debe tener un porcentaje mayor a 0.')
      return
    }
    // Nombres repetidos: en las notas cada rubro filtra asignaciones por su nombre,
    // así que dos rubros iguales contarían la misma actividad dos veces.
    const nombresLower = limpios.map((r) => r.nombre.toLowerCase())
    if (new Set(nombresLower).size !== nombresLower.length) {
      setError('Hay dos rubros con el mismo nombre. Poneles nombres distintos.')
      return
    }
    // "Asistencia" es el rubro especial (se calcula solo): no se usa como rubro
    // normal. Si la querés, activala con "+ Agregar asistencia".
    if (nombresLower.includes('asistencia')) {
      setError('"Asistencia" es un rubro especial: activala con "+ Agregar asistencia", no como rubro normal.')
      return
    }
    if (asisActiva.activa && sumaAsis <= 0) {
      setError('La asistencia debe tener un porcentaje mayor a 0 (o desactivala).')
      return
    }
    if (limpios.reduce((a, r) => a + r.porcentaje, 0) + sumaAsis !== 100) {
      setError('Los porcentajes (incluida la asistencia) deben sumar exactamente 100%.')
      return
    }

    // Reconstruir el objeto COMPLETO {I,II,III}: guardarRubros sobrescribe todo
    // el jsonb. La asistencia es global: se aplica igual a cada periodo que tenga
    // rubros definidos (los periodos vacíos quedan vacíos hasta que se configuren).
    const obj = {}
    for (const q of PERIODOS_TODOS) {
      const rubrosQ = q === p ? limpios : guardado[q] || []
      const asisQ = q === p || rubrosQ.length > 0 ? asistencia : { ...ASIS_POR_DEFECTO }
      obj[q] = armarPeriodo(rubrosQ, asisQ)
    }

    // Diferencia contra lo YA guardado en este periodo: un rubro guardado que ya
    // no está por nombre fue renombrado (si una fila lo recuerda como su `orig`)
    // o quitado. El renombre se propaga a las asignaciones; el quitado, si tiene
    // asignaciones, se avisa antes de dejar sus notas huérfanas.
    const viejos = (guardado[p] || []).map((r) => (r.nombre || '').trim()).filter(Boolean)
    const nombresActuales = new Set(filas.map((f) => f.nombre))
    const renames = []
    const quitados = []
    for (const v of viejos) {
      if (nombresActuales.has(v)) continue // se mantiene
      const fila = filas.find((f) => f.orig === v && f.nombre && f.nombre !== v)
      if (fila) renames.push({ de: v, a: fila.nombre })
      else quitados.push(v)
    }

    const quitadosConAsig = quitados
      .map((nombre) => ({ nombre, count: conteoAsig[p]?.[nombre]?.count || 0 }))
      .filter((q) => q.count > 0)

    // Renombres que tocan actividades (los que no tienen actividades no importan).
    const renamesInfo = renames.map((r) => ({
      ...r,
      count: conteoAsig[p]?.[r.de]?.count || 0,
    }))
    const renamesConAsig = renamesInfo.filter((r) => r.count > 0)

    const payload = { p, limpios, obj, renames: renamesInfo }
    // Avisar solo si hay cambios que afectan actividades (renombres o quitados con
    // actividades). Si no —primer armado o ajuste de %—, guardar directo.
    if (renamesConAsig.length || quitadosConAsig.length) {
      setPendiente({ ...payload, renamesMostrar: renamesConAsig, quitados: quitadosConAsig })
      return
    }
    await commit(payload)
  }

  // Guarda de verdad: primero renombra en cascada las asignaciones de los rubros
  // renombrados (para que sus notas no se desconecten), luego persiste los rubros.
  async function commit({ p, limpios, obj, renames }) {
    setGuardando(true)
    setError('')
    try {
      for (const rn of renames) {
        await renombrarRubroEnAsignaciones(grupo.id, p, rn.de, rn.a)
      }
      await onGuardar(obj)
      setGuardado((prev) => ({ ...prev, [p]: limpios }))
      // Reiniciar el `orig` de cada fila al nombre recién guardado.
      setBorradores((prev) => ({
        ...prev,
        [p]: limpios.map((r) => ({ ...r, orig: r.nombre })),
      }))
      setTocados((prev) => new Set(prev).add(p))
      setPendiente(null)
      setOk(`Rubros del ${etiquetaPeriodo(p)} guardados.`)
      // Los renombres movieron asignaciones: refrescar los conteos.
      resumenAsignacionesPorRubro(grupo.id).then(setConteoAsig).catch(() => {})
    } catch (err) {
      setError(err?.message || 'No se pudieron guardar los rubros.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div>
        <h3 className="text-lg font-bold text-tinta">Rubros de evaluación</h3>
        <p className="mt-0.5 text-sm text-tinta/60">
          Repartí el 100% de la nota del periodo entre los rubros. Deben sumar 100%.
        </p>
      </div>

      {/* Pestañas de periodo */}
      <div className="flex flex-wrap gap-1.5">
        {periodos.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setPeriodoActivo(p)
              setError('')
              setOk('')
            }}
            className={`rounded-cuaderno px-4 py-2 text-sm font-semibold transition-colors ${
              periodoActivo === p
                ? 'bg-pizarra text-papel'
                : 'bg-tinta/5 text-tinta/70 hover:bg-tinta/10'
            }`}
          >
            {etiquetaPeriodo(p)}
            {estaGuardado(p) && <span className="ml-1.5">✓</span>}
          </button>
        ))}
      </div>

      {espejaI && (
        <Alerta tipo="info">
          Esta es una copia del I Periodo. Ajustala (o dejala igual) y guardá para
          confirmar este periodo.
        </Alerta>
      )}

      {presetMEP && (
        <div className="rounded-cuaderno border border-guaria/25 bg-guaria/5 px-3 py-2 text-sm text-tinta/75">
          <b className="text-guaria">MEP:</b> {presetMEP.label}
        </div>
      )}

      {/* Dos columnas en pantalla grande: editar (izq) + resumen fijo (der) */}
      <div className="grid gap-6 lg:grid-cols-[1fr_19rem] lg:items-start">
        {/* --- Columna de edición --- */}
        <div className="space-y-4">
          {/* Encabezados de columna */}
          <div className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-tinta/55">
            <span className="min-w-0 flex-1">Rubro</span>
            <span className="w-20 shrink-0 text-right sm:w-28">
              <span className="sm:hidden">Peso</span>
              <span className="hidden sm:inline">Ponderación</span>
            </span>
            <span className="w-9 shrink-0" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            {listaActiva.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="campo min-w-0 flex-1 text-base"
                  placeholder="Ej. Tareas"
                  value={r.nombre}
                  onChange={(e) => actualizar(i, 'nombre', e.target.value)}
                  aria-label="Nombre del rubro"
                />
                <div className="relative w-20 shrink-0 sm:w-28">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="campo pr-7 text-right text-base"
                    value={r.porcentaje}
                    onChange={(e) => actualizar(i, 'porcentaje', e.target.value)}
                    aria-label="Porcentaje"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-tinta/60">
                    %
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  disabled={listaActiva.length === 1}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-cuaderno text-tinta/60 hover:bg-margen/10 hover:text-margen disabled:opacity-30"
                  aria-label="Quitar rubro"
                  title="Quitar"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Asistencia: se ve como un rubro más, pero su nota se calcula sola. */}
            {asisActiva.activa && (
              <div className="flex items-center gap-2">
                <div className="campo flex min-w-0 flex-1 items-center gap-2 bg-tinta/[0.04] text-base text-tinta">
                  <span className="shrink-0 font-medium">Asistencia</span>
                  <span className="truncate text-xs text-tinta/60">
                    <span className="sm:hidden">automática</span>
                    <span className="hidden sm:inline">
                      se calcula sola · igual en todos los periodos
                    </span>
                  </span>
                </div>
                <div className="relative w-20 shrink-0 sm:w-28">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="campo pr-7 text-right text-base"
                    value={asisActiva.porcentaje}
                    onChange={(e) => editarAsis('porcentaje', e.target.value)}
                    aria-label="Porcentaje de asistencia"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-tinta/60">
                    %
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => editarAsis('activa', false)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-cuaderno text-tinta/60 hover:bg-margen/10 hover:text-margen"
                  aria-label="Quitar asistencia"
                  title="Quitar asistencia"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={agregar}
              className="text-sm font-semibold text-pizarra hover:underline"
            >
              + Agregar rubro
            </button>
            {!asisActiva.activa && (
              <button
                type="button"
                onClick={agregarAsistencia}
                className="text-sm font-semibold text-pizarra hover:underline"
              >
                + Agregar asistencia
              </button>
            )}
            {periodoActivo !== 'I' && (
              <button
                type="button"
                onClick={copiarDelPrimero}
                className="text-sm font-semibold text-guaria hover:underline"
              >
                Usar los mismos del I Periodo
              </button>
            )}
          </div>

        </div>

        {/* --- Columna de resumen (fija al hacer scroll) --- */}
        <div className="space-y-3 lg:sticky lg:top-4">
          <div className={`rounded-cuaderno border p-4 ${estadoClase}`}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-semibold">{estadoTexto}</span>
              <span className="text-xl font-bold">{suma}%</span>
            </div>
            {/* Barra visual del reparto */}
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-tinta/10">
              {segmentos.map((s, i) => (
                <div
                  key={i}
                  style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                  title={`${s.nombre}: ${s.pct}%`}
                />
              ))}
            </div>
            {/* Leyenda */}
            {segmentos.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {segmentos.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 text-sm text-tinta/80"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="truncate">{s.nombre}</span>
                    </span>
                    <span className="font-semibold text-tinta">{s.pct}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Alerta tipo="error">{error}</Alerta>
          <Alerta tipo="exito">{ok}</Alerta>

          <button
            type="button"
            onClick={guardarPeriodo}
            className="btn-primario w-full justify-center py-2.5"
            disabled={guardando || !sumaOk}
          >
            {guardando ? 'Guardando…' : `Guardar ${etiquetaPeriodo(periodoActivo)}`}
          </button>
        </div>
      </div>

      {/* Resumen de los cambios al guardar (renombres y quitados con actividades). */}
      <Modal
        abierto={!!pendiente}
        onCerrar={() => !guardando && setPendiente(null)}
        titulo="Confirmá los cambios"
      >
        {pendiente?.renamesMostrar?.length > 0 && (
          <div>
            <p className="text-sm text-tinta/80">
              Se van a renombrar estos rubros (sus actividades se actualizan solas):
            </p>
            <ul className="mt-2 space-y-1.5">
              {pendiente.renamesMostrar.map((r) => (
                <li
                  key={r.de}
                  className="flex items-center justify-between gap-2 rounded-cuaderno bg-pizarra/5 px-3 py-1.5 text-sm"
                >
                  <span className="min-w-0 truncate text-tinta">
                    <b>{r.de}</b> → <b>{r.a}</b>
                  </span>
                  <span className="shrink-0 text-tinta/60">
                    {r.count} {r.count === 1 ? 'actividad' : 'actividades'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {pendiente?.quitados?.length > 0 && (
          <div className={pendiente?.renamesMostrar?.length ? 'mt-4' : ''}>
            <p className="text-sm text-tinta/80">
              Se van a quitar estos rubros; sus notas <b>dejan de contar</b> hasta
              que muevas las actividades a otro rubro (editándolas):
            </p>
            <ul className="mt-2 space-y-1.5">
              {pendiente.quitados.map((q) => (
                <li
                  key={q.nombre}
                  className="flex items-center justify-between gap-2 rounded-cuaderno bg-margen/5 px-3 py-1.5 text-sm"
                >
                  <span className="font-semibold text-tinta">{q.nombre}</span>
                  <span className="text-tinta/60">
                    {q.count} {q.count === 1 ? 'actividad' : 'actividades'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="btn-secundario"
            onClick={() => setPendiente(null)}
            disabled={guardando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className={
              pendiente?.quitados?.length
                ? 'btn-primario !bg-margen hover:!bg-margen/90'
                : 'btn-primario'
            }
            onClick={() => commit(pendiente)}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
