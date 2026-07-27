import { supabase } from '../lib/supabase'
import {
  PERIODOS,
  periodosDeGrupo,
  fechasSugeridasPeriodos,
} from '../lib/periodos'
import { borrarArchivos } from './storage.service'

// Capa de servicios para grupos del docente, matrícula y pre-matrícula.
// Las reglas RLS ya garantizan que el docente solo toca lo suyo.

/** Lista los grupos del docente, más recientes primero. */
export async function listarGrupos(docenteId) {
  const { data, error } = await supabase
    .from('grupos')
    .select('*')
    .eq('docente_id', docenteId)
    .order('creado_en', { ascending: false })
  if (error) throw error
  return data
}

/** Obtiene un grupo por id. */
export async function obtenerGrupo(grupoId) {
  const { data, error } = await supabase
    .from('grupos')
    .select('*')
    .eq('id', grupoId)
    .single()
  if (error) throw error
  return data
}

/**
 * Crea un grupo. El código de acceso y los rubros por defecto los pone
 * la base (defaults del esquema), así que solo mandamos lo del formulario.
 */
export async function crearGrupo(docenteId, datos) {
  const { data, error } = await supabase
    .from('grupos')
    .insert({ ...limpiarDatosGrupo(datos), docente_id: docenteId })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Junta TODAS las URLs de R2 asociadas a un grupo, para limpiarlas al borrarlo:
 * material de asignaciones (jsonb), archivos de entregas de sus estudiantes y
 * archivos de clases. Solo devuelve lo que el docente puede ver por RLS (lo suyo).
 */
export async function archivosDeGrupo(grupoId) {
  const urls = []

  const { data: asigs } = await supabase
    .from('asignaciones')
    .select('id, archivos')
    .eq('grupo_id', grupoId)
  const asigIds = (asigs || []).map((a) => a.id)
  for (const a of asigs || []) {
    for (const x of a.archivos || []) if (x?.url) urls.push(x.url)
  }

  if (asigIds.length) {
    const { data: ents } = await supabase
      .from('entregas')
      .select('id')
      .in('asignacion_id', asigIds)
    const entIds = (ents || []).map((e) => e.id)
    if (entIds.length) {
      const { data: ea } = await supabase
        .from('entrega_archivos')
        .select('url')
        .in('entrega_id', entIds)
      for (const r of ea || []) if (r?.url) urls.push(r.url)
    }
  }

  const { data: clases } = await supabase
    .from('clases')
    .select('id')
    .eq('grupo_id', grupoId)
  const claseIds = (clases || []).map((c) => c.id)
  if (claseIds.length) {
    const { data: ca } = await supabase
      .from('clase_archivos')
      .select('url')
      .in('clase_id', claseIds)
    for (const r of ca || []) if (r?.url) urls.push(r.url)
  }

  return urls
}

/**
 * Elimina un grupo por completo. Por cascada en la base arrastra sus
 * asignaciones (y entregas/archivos), clases, asistencia y matrículas.
 * Antes limpia los objetos de R2 (best-effort) usando las URLs EXACTAS del grupo,
 * así nunca toca archivos de otros. Acción irreversible; confirmar en la UI.
 */
export async function eliminarGrupo(grupoId) {
  // Limpieza de R2 ANTES de borrar: las filas deben existir para que la Edge
  // Function autorice el borrado (por pertenencia al grupo, vía RLS).
  try {
    const urls = await archivosDeGrupo(grupoId)
    await borrarArchivos(urls)
  } catch {
    /* limpieza best-effort: si falla, los objetos quedan huérfanos pero no rompe */
  }
  const { error } = await supabase.from('grupos').delete().eq('id', grupoId)
  if (error) throw error
}

/** Actualiza los datos generales de un grupo (no toca rubros ni código). */
export async function actualizarGrupo(grupoId, datos) {
  const { data, error } = await supabase
    .from('grupos')
    .update(limpiarDatosGrupo(datos))
    .eq('id', grupoId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Guarda los rubros agrupados por periodo (jsonb), ej. { I:[…], II:[…] }.
 * Validar que cada periodo confirmado sume 100 antes de llamar (lo hace el editor).
 */
export async function guardarRubros(grupoId, rubrosPorPeriodo) {
  const { data, error } = await supabase
    .from('grupos')
    .update({ rubros: rubrosPorPeriodo })
    .eq('id', grupoId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * ¿Las calificaciones de este periodo ya están publicadas para el estudiante?
 *
 * El docente puede querer terminar de calificar a todo el grupo antes de que
 * nadie vea su nota. Vacío = publicado, así que los grupos que existían siguen
 * funcionando igual que antes.
 *
 * OJO: esto es presentación, no secreto. Oculta la nota en la pantalla del
 * estudiante, pero el dato sigue en la base y RLS no puede tapar una sola
 * columna. Sirve para "todavía no", no para información confidencial.
 */
export function notasPublicadas(grupo, periodo) {
  const ocultas = Array.isArray(grupo?.notas_ocultas) ? grupo.notas_ocultas : []
  return !ocultas.includes(periodo)
}

/**
 * Guarda cuántas lecciones da el grupo cada día de la semana, ej. {"1":2,"3":4}
 * (1 = lunes … 5 = viernes). Los días en 0 o vacíos se quitan.
 */
export async function guardarLeccionesPorDia(grupoId, porDia) {
  const limpio = {}
  for (const [dia, n] of Object.entries(porDia || {})) {
    const v = Number(n)
    if (v > 0) limpio[String(dia)] = v
  }
  const { data, error } = await supabase
    .from('grupos')
    .update({ lecciones_por_dia: limpio })
    .eq('id', grupoId)
    .select()
    .single()
  if (error) throw new Error('No se pudieron guardar las lecciones por día.')
  return data
}

/** Publica u oculta las calificaciones de un periodo. Devuelve el grupo. */
export async function definirNotasPublicadas(grupo, periodo, publicar) {
  const previas = Array.isArray(grupo?.notas_ocultas) ? grupo.notas_ocultas : []
  const ocultas = publicar
    ? previas.filter((p) => p !== periodo)
    : [...new Set([...previas, periodo])]

  const { data, error } = await supabase
    .from('grupos')
    .update({ notas_ocultas: ocultas })
    .eq('id', grupo.id)
    .select()
    .single()
  if (error) throw new Error('No se pudo cambiar la visibilidad de las notas.')
  return data
}

/**
 * Normaliza grupos.rubros a la forma { I:[], II:[], III:[] }.
 * Acepta el formato viejo (arreglo plano) tratándolo como rubros del I Periodo,
 * para no romper grupos creados antes del ADR-001.
 */
export function rubrosPorPeriodo(grupo) {
  const out = { I: [], II: [], III: [] }
  const raw = grupo?.rubros
  if (Array.isArray(raw)) {
    out.I = raw.map((r) => ({ ...r }))
  } else if (raw && typeof raw === 'object') {
    for (const p of PERIODOS) {
      if (Array.isArray(raw[p])) out[p] = raw[p].map((r) => ({ ...r }))
    }
  }
  return out
}

/**
 * Fechas de cada periodo del grupo (ADR-001 / asistencia por periodo).
 * Normaliza grupos.periodos_fechas a { I:{inicio,fin}|null, II:…, III:… }.
 */
export function periodosFechas(grupo) {
  const out = { I: null, II: null, III: null }
  const raw = grupo?.periodos_fechas
  if (raw && typeof raw === 'object') {
    for (const p of PERIODOS) {
      const r = raw[p]
      if (r && (r.inicio || r.fin)) {
        out[p] = { inicio: r.inicio || null, fin: r.fin || null }
      }
    }
  }
  return out
}

/**
 * Rango de fechas a USAR para un periodo al contar asistencia. Si el docente
 * cargó fechas explícitas, se usan; si no (lo normal, porque casi nadie las
 * llena), cae automáticamente al reparto sugerido del año lectivo. Así la
 * asistencia por periodo funciona sola, sin depender de que el profe entre a
 * configurarla. El calendario que alimenta el reparto vive en lib/periodos.js.
 */
export function rangoPeriodo(grupo, periodo) {
  const guardado = periodosFechas(grupo)[periodo]
  if (guardado?.inicio && guardado?.fin) return guardado
  const sugeridas = fechasSugeridasPeriodos(grupo?.anio, periodosDeGrupo(grupo))
  return sugeridas[periodo] || null
}

/** Guarda las fechas de los periodos (jsonb { I:{inicio,fin}, … }). */
export async function guardarPeriodosFechas(grupoId, fechas) {
  const { data, error } = await supabase
    .from('grupos')
    .update({ periodos_fechas: fechas })
    .eq('id', grupoId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---------------- Estudiante ----------------

/**
 * Unirse a un grupo con el código de acceso (RPC).
 * Devuelve { ok, mensaje|grupo, estado }. No lanza por código inválido:
 * el ok=false viene en el cuerpo para mostrarlo como mensaje al estudiante.
 */
export async function unirseConCodigo(codigo) {
  const { data, error } = await supabase.rpc('unirse_con_codigo', {
    p_codigo: codigo,
  })
  if (error) throw error
  return data
}

/**
 * Lista los grupos del estudiante con su estado de matrícula (activo/pendiente).
 */
export async function listarMisGrupos(estudianteId) {
  const { data, error } = await supabase
    .from('grupo_estudiantes')
    .select(
      'id, estado, grupo:grupos(id, nombre, materia, especialidad, nivel, anio, periodo, rubros, mep_modalidad)',
    )
    .eq('estudiante_id', estudianteId)
    .order('creado_en', { ascending: false })
  if (error) throw error
  return data
}

/** Cuenta los estudiantes ACTIVOS en un conjunto de grupos (para el resumen). */
export async function contarEstudiantesActivos(grupoIds) {
  if (!grupoIds?.length) return 0
  const { count, error } = await supabase
    .from('grupo_estudiantes')
    .select('id', { count: 'exact', head: true })
    .in('grupo_id', grupoIds)
    .eq('estado', 'activo')
  if (error) throw error
  return count || 0
}

/** Regenera el código de acceso vía RPC (solo el docente dueño). */
export async function regenerarCodigo(grupoId) {
  const { data, error } = await supabase.rpc('regenerar_codigo', {
    p_grupo_id: grupoId,
  })
  if (error) throw error
  return data // nuevo código (text)
}

// ---------------- Estudiantes / matrícula ----------------

/**
 * Lista los estudiantes del grupo con su perfil y estado (activo/pendiente).
 * Pendientes primero para que el docente los apruebe de un vistazo.
 */
export async function listarEstudiantes(grupoId) {
  const { data, error } = await supabase
    .from('grupo_estudiantes')
    .select(
      'id, estado, creado_en, estudiante:perfiles(id, nombre, correo, telefono, seccion)',
    )
    .eq('grupo_id', grupoId)
    .order('estado', { ascending: false }) // 'pendiente' antes que 'activo'
    .order('creado_en', { ascending: true })
  if (error) throw error
  return data
}

/** Aprueba a un estudiante pendiente (pasa su matrícula a 'activo'). */
export async function aprobarEstudiante(matriculaId) {
  const { error } = await supabase
    .from('grupo_estudiantes')
    .update({ estado: 'activo' })
    .eq('id', matriculaId)
  if (error) throw error
}

/** Expulsa a un estudiante del grupo (borra su matrícula). */
export async function expulsarEstudiante(matriculaId) {
  const { error } = await supabase
    .from('grupo_estudiantes')
    .delete()
    .eq('id', matriculaId)
  if (error) throw error
}

// ---------------- Pre-matrícula ----------------

/** Lista los correos pre-matriculados del grupo. */
export async function listarPrematriculas(grupoId) {
  const { data, error } = await supabase
    .from('prematriculas')
    .select('id, correo, usado, creado_en')
    .eq('grupo_id', grupoId)
    .order('creado_en', { ascending: false })
  if (error) throw error
  return data
}

/**
 * Agrega una lista de correos a pre-matrícula.
 * Recibe texto pegado (separado por coma, espacios o saltos de línea),
 * lo normaliza, quita duplicados/correos inválidos e ignora los que ya existían.
 * Devuelve { agregados, invalidos }.
 */
export async function agregarPrematriculas(grupoId, textoCorreos) {
  const correos = parsearCorreos(textoCorreos)
  const invalidos = correos.invalidos

  if (correos.validos.length === 0) {
    return { agregados: 0, invalidos }
  }

  const filas = correos.validos.map((correo) => ({ grupo_id: grupoId, correo }))

  // upsert ignorando conflictos contra el unique (grupo_id, correo).
  const { data, error } = await supabase
    .from('prematriculas')
    .upsert(filas, { onConflict: 'grupo_id,correo', ignoreDuplicates: true })
    .select('id')
  if (error) throw error

  return { agregados: data?.length ?? 0, invalidos }
}

/** Quita un correo de la pre-matrícula. */
export async function quitarPrematricula(prematriculaId) {
  const { error } = await supabase
    .from('prematriculas')
    .delete()
    .eq('id', prematriculaId)
  if (error) throw error
}

// ---------------- Helpers ----------------

const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Separa, normaliza y valida correos pegados en lote. */
export function parsearCorreos(texto) {
  const piezas = (texto || '')
    .split(/[\s,;]+/)
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean)

  const vistos = new Set()
  const validos = []
  const invalidos = []

  for (const c of piezas) {
    if (vistos.has(c)) continue
    vistos.add(c)
    if (RE_CORREO.test(c)) validos.push(c)
    else invalidos.push(c)
  }
  return { validos, invalidos }
}

// Solo deja pasar las columnas que el formulario maneja.
function limpiarDatosGrupo(d) {
  const out = {}
  if (d.nombre !== undefined) out.nombre = d.nombre.trim()
  if (d.materia !== undefined) out.materia = d.materia?.trim() || null
  if (d.especialidad !== undefined) out.especialidad = d.especialidad?.trim() || null
  if (d.nivel !== undefined) out.nivel = d.nivel?.trim() || null
  if (d.anio !== undefined) out.anio = Number(d.anio)
  // periodo guarda (por convención, ADR-001) la CANTIDAD de periodos: "2" | "3".
  if (d.periodo !== undefined) out.periodo = String(d.periodo)
  if (d.requiere_aprobacion !== undefined)
    out.requiere_aprobacion = !!d.requiere_aprobacion
  if (d.activo !== undefined) out.activo = !!d.activo
  // Modalidad del "Modo MEP" (clave de preset en lib/mep.js) o null si no aplica.
  if (d.mep_modalidad !== undefined) out.mep_modalidad = d.mep_modalidad || null
  return out
}
