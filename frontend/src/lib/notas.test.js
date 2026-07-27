import { describe, it, expect } from 'vitest'
import {
  calificacionDe,
  motivoNoCuenta,
  calcularRegistro,
  notaAsistencia,
  contarAsistencia,
  diasRegistrados,
  porcentajeAsistencia,
  porcentajePresencia,
  esRubroAsistencia,
  estadoAprobacion,
  pct,
  pctFijo,
  redondear,
  redondearAnual,
} from './notas'

// Batería del módulo de notas (docs/PLAN.md §3.8).
//
// El caso de referencia es el del plan: si algo lo rompe, la nota que ve el
// estudiante deja de coincidir con la del docente, que es el peor error posible
// de este módulo (CLAUDE.md §7.6 D).
//
// Convención de estas pruebas: `cal(valor, nota, puntos)` arma una actividad
// calificada, para que cada caso se lea en una línea.

const asignacion = (extra = {}) => ({
  id: extra.id ?? 'a1',
  titulo: 'Actividad',
  rubro: 'Trabajo cotidiano',
  periodo: 'I',
  tipo: 'entrega',
  puntos: 10,
  porcentaje: 15,
  penalizacion_tardia: 0,
  requiere_entrega: true,
  ...extra,
})

const calificada = (nota, extra = {}) => ({
  estado: 'calificada',
  nota,
  tardia: false,
  ...extra,
})

describe('calificacionDe — (nota / puntos) × Valor %', () => {
  it('convierte la nota en porcentaje del periodo', () => {
    // 8 de 10 en una actividad que vale 15% → 12% del periodo
    expect(calificacionDe(asignacion(), calificada(8))).toBe(12)
  })

  it('una nota de 0 vale 0, no "sin calificar"', () => {
    expect(calificacionDe(asignacion(), calificada(0))).toBe(0)
  })

  it('la nota perfecta entrega el valor completo', () => {
    expect(calificacionDe(asignacion(), calificada(10))).toBe(15)
  })

  it('sin entrega no hay calificación', () => {
    expect(calificacionDe(asignacion(), null)).toBeNull()
  })

  it('entregada pero sin revisar no da número', () => {
    expect(calificacionDe(asignacion(), { estado: 'entregada', nota: null })).toBeNull()
  })

  it('estado calificada pero nota nula no da número', () => {
    expect(calificacionDe(asignacion(), { estado: 'calificada', nota: null })).toBeNull()
  })

  it('sin puntos no se puede dividir', () => {
    expect(calificacionDe(asignacion({ puntos: 0 }), calificada(8))).toBeNull()
  })

  it('sin Valor % no cuenta (CLAUDE.md §7.6 B)', () => {
    expect(calificacionDe(asignacion({ porcentaje: null }), calificada(8))).toBeNull()
    expect(calificacionDe(asignacion({ porcentaje: 0 }), calificada(8))).toBeNull()
  })

  describe('penalización por entrega tardía', () => {
    it('rebaja el porcentaje indicado', () => {
      // 4/5 = 0,80 → −10% → 0,72 → sobre un valor de 10% = 7,2%
      const a = asignacion({ puntos: 5, porcentaje: 10, penalizacion_tardia: 10 })
      expect(calificacionDe(a, calificada(4, { tardia: true }))).toBeCloseTo(7.2, 10)
    })

    it('no rebaja si la entrega no fue tardía', () => {
      const a = asignacion({ puntos: 5, porcentaje: 10, penalizacion_tardia: 10 })
      expect(calificacionDe(a, calificada(4))).toBe(8)
    })

    it('no rebaja si la penalización es 0 aunque sea tardía', () => {
      const a = asignacion({ puntos: 5, porcentaje: 10, penalizacion_tardia: 0 })
      expect(calificacionDe(a, calificada(4, { tardia: true }))).toBe(8)
    })

    it('NO penaliza cuando la actividad no se entrega (CLAUDE.md §7.6 A)', () => {
      // La "penalización fantasma": en una prueba escrita la fila de entrega la
      // crea el docente al calificar, y el trigger de la base la marca tardía
      // sin que el estudiante haya hecho nada mal.
      const a = asignacion({
        requiere_entrega: false,
        puntos: 5,
        porcentaje: 10,
        penalizacion_tardia: 10,
      })
      expect(calificacionDe(a, calificada(4, { tardia: true }))).toBe(8)
    })

    it('una penalización del 100% deja la calificación en 0', () => {
      const a = asignacion({ penalizacion_tardia: 100 })
      expect(calificacionDe(a, calificada(10, { tardia: true }))).toBe(0)
    })

    it('acota penalizaciones absurdas en vez de invertir la nota', () => {
      const exagerada = asignacion({ penalizacion_tardia: 500 })
      expect(calificacionDe(exagerada, calificada(10, { tardia: true }))).toBe(0)

      const negativa = asignacion({ penalizacion_tardia: -50 })
      expect(calificacionDe(negativa, calificada(10, { tardia: true }))).toBe(15)
    })
  })
})

describe('motivoNoCuenta — por qué una fila no suma', () => {
  const nombres = new Set(['Trabajo cotidiano', 'Pruebas'])

  it('detecta el rubro que ya no existe', () => {
    expect(motivoNoCuenta(asignacion({ rubro: 'Borrado' }), nombres)).toBe('rubro')
  })

  it('detecta la actividad sin Valor %', () => {
    expect(motivoNoCuenta(asignacion({ porcentaje: null }), nombres)).toBe('sin_valor')
    expect(motivoNoCuenta(asignacion({ porcentaje: 0 }), nombres)).toBe('sin_valor')
  })

  it('no se queja cuando está todo en orden', () => {
    expect(motivoNoCuenta(asignacion(), nombres)).toBeNull()
  })

  it('ignora espacios sobrantes en el nombre del rubro', () => {
    expect(motivoNoCuenta(asignacion({ rubro: '  Pruebas  ' }), nombres)).toBeNull()
  })

  it('el rubro faltante pesa más que el valor faltante', () => {
    const a = asignacion({ rubro: 'Borrado', porcentaje: null })
    expect(motivoNoCuenta(a, nombres)).toBe('rubro')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// EL CASO DE REFERENCIA (docs/PLAN.md §3.3). Si esto falla, algo grave cambió.
// ─────────────────────────────────────────────────────────────────────────────

const RUBROS_MEP = [
  { nombre: 'Trabajo cotidiano', porcentaje: 45 },
  { nombre: 'Tareas', porcentaje: 10 },
  { nombre: 'Pruebas', porcentaje: 40 },
  {
    nombre: 'Asistencia',
    porcentaje: 5,
    asistencia: true,
    mep: false,
    tardiasPorAusencia: 2,
    justificadaCuenta: true,
  },
]

const ACTIVIDADES = [
  asignacion({ id: 'c3', titulo: 'Cotidiano #3', rubro: 'Trabajo cotidiano', porcentaje: 15, puntos: 10 }),
  asignacion({ id: 'mapa', titulo: 'Mapa conceptual', rubro: 'Tareas', porcentaje: 10, puntos: 10 }),
  asignacion({ id: 'ex', titulo: 'Examen I Periodo', rubro: 'Pruebas', porcentaje: 40, puntos: 100 }),
  asignacion({ id: 'taller', titulo: 'Taller', rubro: 'Trabajo cotidiano', porcentaje: 5, puntos: 10 }),
]

const ENTREGAS = {
  c3: calificada(8), //   8/10 sobre 15% → 12,00%
  mapa: calificada(8), //  8/10 sobre 10% →  8,00%
  ex: null, //             sin entregar   →      —
  taller: { estado: 'entregada', nota: null }, // entregado, sin revisar → —
}

// 18 presentes y 2 ausentes de 20 lecciones → 90 de logro → 4,50% de un 5%
const CONTEOS = { presente: 18, ausente: 2, tardia: 0, justificada: 0 }

const registroDeReferencia = () =>
  calcularRegistro(RUBROS_MEP, ACTIVIDADES, (id) => ENTREGAS[id], CONTEOS)

describe('calcularRegistro — el caso del plan', () => {
  it('da NOTA FINAL 24,50%', () => {
    expect(redondear(registroDeReferencia().notaFinal)).toBe(24.5)
  })

  it('reporta 30% evaluado hasta hoy', () => {
    expect(registroDeReferencia().evaluado).toBe(30)
  })

  it('calcula cada fila como dice el plan', () => {
    const { filas } = registroDeReferencia()
    const por = (id) => filas.find((f) => f.asignacion.id === id)

    expect(por('c3').calificacion).toBe(12)
    expect(por('mapa').calificacion).toBe(8)
    expect(por('ex').calificacion).toBeNull() // sin entregar
    expect(por('taller').calificacion).toBeNull() // sin revisar
  })

  it('da 4,50% de asistencia', () => {
    expect(registroDeReferencia().asistencia.calificacion).toBe(4.5)
    expect(registroDeReferencia().asistencia.logro).toBe(90)
  })

  it('arma el resumen por rubro del plan', () => {
    const { porRubro } = registroDeReferencia()
    const sub = (n) => porRubro.find((r) => r.nombre === n)

    expect(sub('Trabajo cotidiano')).toMatchObject({ valor: 45, obtenido: 12 })
    expect(sub('Tareas')).toMatchObject({ valor: 10, obtenido: 8 })
    expect(sub('Pruebas')).toMatchObject({ valor: 40, obtenido: 0 })
    expect(sub('Asistencia')).toMatchObject({ valor: 5, obtenido: 4.5, esAsistencia: true })
  })

  it('no levanta ningún aviso: los datos están sanos', () => {
    const { avisos } = registroDeReferencia()
    expect(avisos.rubro).toHaveLength(0)
    expect(avisos.sinValor).toHaveLength(0)
  })

  it('LA REGLA DE ORO: la NOTA FINAL es la suma de lo que se ve en pantalla', () => {
    const r = registroDeReferencia()
    const visible = r.filas.reduce((s, f) => s + (f.calificacion ?? 0), 0)
    expect(redondear(r.notaFinal)).toBe(redondear(visible + r.asistencia.calificacion))
  })

  it('los subtotales por rubro también suman la NOTA FINAL', () => {
    const r = registroDeReferencia()
    const suma = r.porRubro.reduce((s, x) => s + x.obtenido, 0)
    expect(redondear(suma)).toBe(redondear(r.notaFinal))
  })
})

describe('calcularRegistro — casos de borde', () => {
  it('un periodo sin nada no inventa un cero', () => {
    const r = calcularRegistro([], [], () => null, null)
    expect(r.notaFinal).toBeNull()
    expect(r.evaluado).toBe(0)
  })

  it('nada calificado todavía deja la NOTA FINAL vacía', () => {
    const r = calcularRegistro(RUBROS_MEP, ACTIVIDADES, () => null, null)
    expect(r.notaFinal).toBeNull()
    expect(r.evaluado).toBe(0)
  })

  it('aguanta que le pasen null en vez de listas', () => {
    const r = calcularRegistro(null, null, () => null, null)
    expect(r.filas).toEqual([])
    expect(r.notaFinal).toBeNull()
  })

  it('una actividad huérfana no suma y se avisa (CLAUDE.md §7.5)', () => {
    const huerfana = asignacion({ id: 'h', rubro: 'Rubro borrado', porcentaje: 20 })
    const r = calcularRegistro(
      RUBROS_MEP,
      [huerfana],
      () => calificada(10),
      null,
    )
    expect(r.filas[0].calificacion).toBeNull()
    expect(r.filas[0].noCuenta).toBe('rubro')
    expect(r.notaFinal).toBeNull()
    expect(r.avisos.rubro).toHaveLength(1)
  })

  it('una actividad sin Valor % no suma y se avisa (CLAUDE.md §7.6 B)', () => {
    const sinValor = asignacion({ id: 's', porcentaje: null })
    const r = calcularRegistro(RUBROS_MEP, [sinValor], () => calificada(10), null)
    expect(r.filas[0].noCuenta).toBe('sin_valor')
    expect(r.filas[0].valor).toBeNull()
    expect(r.notaFinal).toBeNull()
    expect(r.avisos.sinValor).toHaveLength(1)
  })

  it('la actividad huérfana tampoco entra en el subtotal de su rubro', () => {
    const r = calcularRegistro(
      RUBROS_MEP,
      [asignacion({ id: 'h', rubro: 'Fantasma', porcentaje: 20 })],
      () => calificada(10),
      null,
    )
    expect(r.porRubro.every((x) => x.obtenido === 0)).toBe(true)
  })

  it('sin registro de asistencia, ese rubro no suma ni resta', () => {
    const r = calcularRegistro(RUBROS_MEP, ACTIVIDADES, (id) => ENTREGAS[id], null)
    expect(r.asistencia.calificacion).toBeNull()
    expect(redondear(r.notaFinal)).toBe(20) // 12 + 8, sin el 4,5 de asistencia
    expect(r.evaluado).toBe(25) // 15 + 10, sin el 5 de asistencia
  })

  it('reconoce el rubro de asistencia por su nombre, sin la marca', () => {
    const rubros = [{ nombre: 'Asistencia', porcentaje: 5 }]
    const r = calcularRegistro(rubros, [], () => null, CONTEOS)
    expect(r.asistencia).not.toBeNull()
    expect(r.asistencia.calificacion).toBe(4.5)
  })

  it('la asistencia sola ya produce NOTA FINAL', () => {
    const r = calcularRegistro(
      [{ nombre: 'Asistencia', porcentaje: 5, asistencia: true }],
      [],
      () => null,
      CONTEOS,
    )
    expect(r.notaFinal).toBe(4.5)
    expect(r.evaluado).toBe(5)
  })

  it('un grupo sin rubro de asistencia no arma esa fila', () => {
    const r = calcularRegistro(
      [{ nombre: 'Pruebas', porcentaje: 100 }],
      [],
      () => null,
      CONTEOS,
    )
    expect(r.asistencia).toBeNull()
  })

  it('la NOTA FINAL puede llegar a 100 con todo perfecto', () => {
    const rubros = [{ nombre: 'Pruebas', porcentaje: 100 }]
    const acts = [asignacion({ id: 'u', rubro: 'Pruebas', porcentaje: 100, puntos: 20 })]
    const r = calcularRegistro(rubros, acts, () => calificada(20), null)
    expect(r.notaFinal).toBe(100)
    expect(r.evaluado).toBe(100)
  })
})

describe('esRubroAsistencia', () => {
  it('lo reconoce por la marca', () => {
    expect(esRubroAsistencia({ nombre: 'Puntualidad', asistencia: true })).toBe(true)
  })
  it('lo reconoce por el nombre, sin importar mayúsculas ni espacios', () => {
    expect(esRubroAsistencia({ nombre: '  ASISTENCIA ' })).toBe(true)
  })
  it('no confunde un rubro normal', () => {
    expect(esRubroAsistencia({ nombre: 'Pruebas' })).toBe(false)
    expect(esRubroAsistencia(null)).toBe(false)
  })
})

describe('notaAsistencia — regla lineal', () => {
  it('18 presentes y 2 ausentes de 20 dan 90', () => {
    expect(notaAsistencia({ presente: 18, ausente: 2 })).toBe(90)
  })

  it('sin ausencias da 100', () => {
    expect(notaAsistencia({ presente: 20 })).toBe(100)
  })

  it('dos tardías equivalen a una ausencia', () => {
    // 2 tardías de 20 lecciones = 1 ausencia → 95
    expect(notaAsistencia({ presente: 18, tardia: 2 })).toBe(95)
  })

  it('se puede configurar que cada tardía valga una ausencia entera', () => {
    expect(notaAsistencia({ presente: 18, tardia: 2 }, { tardiasPorAusencia: 1 })).toBe(90)
  })

  it('un valor inválido de tardías cae al 2 por omisión', () => {
    expect(notaAsistencia({ presente: 18, tardia: 2 }, { tardiasPorAusencia: 0 })).toBe(95)
  })

  it('la justificada no baja la nota por omisión', () => {
    expect(notaAsistencia({ presente: 18, justificada: 2 })).toBe(100)
  })

  it('pero puede configurarse para que sí baje', () => {
    expect(
      notaAsistencia({ presente: 18, justificada: 2 }, { justificadaCuenta: false }),
    ).toBe(90)
  })

  it('sin lecciones registradas no hay nota', () => {
    expect(notaAsistencia({})).toBeNull()
    expect(notaAsistencia(null)).toBeNull()
  })

  it('nunca baja de 0 aunque falte a todo', () => {
    expect(notaAsistencia({ ausente: 20 })).toBe(0)
  })
})

describe('notaAsistencia — escala escalonada del MEP (Art. 37)', () => {
  const mep = { mep: true, tardiasPorAusencia: 2, justificadaCuenta: true }

  it('menos del 10% de ausencias mantiene el 100', () => {
    // 1 ausencia de 20 = 5%
    expect(notaAsistencia({ presente: 19, ausente: 1 }, mep)).toBe(100)
  })

  it('exactamente 10% ya baja al tramo siguiente', () => {
    // 2 de 20 = 10% justo; el límite del tramo es exclusivo
    expect(notaAsistencia({ presente: 18, ausente: 2 }, mep)).toBe(80)
  })

  it('recorre la escala completa', () => {
    const de = (ausente) => notaAsistencia({ presente: 20 - ausente, ausente }, mep)
    expect(de(0)).toBe(100) //  0%
    expect(de(1)).toBe(100) //  5%
    expect(de(3)).toBe(80) //  15%
    expect(de(5)).toBe(60) //  25%
    expect(de(7)).toBe(40) //  35%
    expect(de(9)).toBe(20) //  45%
    expect(de(12)).toBe(0) //  60%
  })

  it('sobre un rubro de 5% reproduce la escala oficial 5-4-3-2-1-0', () => {
    const puntos = (ausente) =>
      (notaAsistencia({ presente: 20 - ausente, ausente }, mep) * 5) / 100
    expect([puntos(0), puntos(3), puntos(5), puntos(7), puntos(9), puntos(12)]).toEqual([
      5, 4, 3, 2, 1, 0,
    ])
  })

  it('la justificada tampoco baja la nota en modo MEP', () => {
    expect(notaAsistencia({ presente: 18, justificada: 2 }, mep)).toBe(100)
  })
})

describe('contarAsistencia', () => {
  const filas = [
    { fecha: '2026-02-10', estado: 'presente' },
    { fecha: '2026-03-15', estado: 'ausente' },
    { fecha: '2026-05-20', estado: 'tardia' },
    { fecha: '2026-08-01', estado: 'presente' },
    { fecha: '2026-09-09', estado: 'justificada' },
  ]

  it('sin rango cuenta todo el año', () => {
    expect(contarAsistencia(filas, null)).toEqual({
      presente: 2,
      ausente: 1,
      tardia: 1,
      justificada: 1,
    })
  })

  it('acota al rango del periodo', () => {
    const c = contarAsistencia(filas, { inicio: '2026-02-01', fin: '2026-06-30' })
    expect(c).toEqual({ presente: 1, ausente: 1, tardia: 1, justificada: 0 })
  })

  it('incluye los días que caen justo en los bordes', () => {
    const c = contarAsistencia(filas, { inicio: '2026-02-10', fin: '2026-03-15' })
    expect(c.presente).toBe(1)
    expect(c.ausente).toBe(1)
  })

  it('ignora estados que no conoce', () => {
    const c = contarAsistencia([{ fecha: '2026-02-10', estado: 'inventado' }], null)
    expect(diasRegistrados(c)).toBe(0)
  })

  it('aguanta una lista vacía o nula', () => {
    expect(diasRegistrados(contarAsistencia(null, null))).toBe(0)
  })
})

describe('porcentajes de asistencia de referencia', () => {
  it('el crudo solo lo bajan las ausencias', () => {
    expect(porcentajeAsistencia({ presente: 18, ausente: 2 })).toBe(90)
    expect(porcentajeAsistencia({ presente: 18, tardia: 2 })).toBe(100)
  })

  it('la presencia cuenta al que llegó tarde como presente (Art. 54)', () => {
    expect(porcentajePresencia({ presente: 16, tardia: 2, ausente: 2 })).toBe(90)
  })

  it('la justificada baja la presencia: no estuvo en clase', () => {
    expect(porcentajePresencia({ presente: 16, justificada: 4 })).toBe(80)
  })

  it('sin registro no hay porcentaje que mostrar', () => {
    expect(porcentajeAsistencia({})).toBeNull()
    expect(porcentajePresencia({})).toBeNull()
  })
})

describe('formato de números (REAC Art. 26)', () => {
  it('no escribe decimales de relleno', () => {
    expect(pct(5)).toBe('5%')
    expect(pct(24)).toBe('24%')
  })

  it('escribe los decimales que existen, con coma', () => {
    expect(pct(31.5)).toBe('31,5%')
    expect(pct(24.5)).toBe('24,5%')
  })

  it('redondea a dos decimales', () => {
    expect(pct(31.476)).toBe('31,48%')
  })

  it('muestra una raya cuando no hay número', () => {
    expect(pct(null)).toBe('—')
    expect(pct(undefined)).toBe('—')
    expect(pct(NaN)).toBe('—')
  })

  it('el formato oficial sí escribe los dos decimales', () => {
    expect(pctFijo(5)).toBe('5,00%')
    expect(pctFijo(31.5)).toBe('31,50%')
    expect(pctFijo(null)).toBe('—')
  })

  it('redondear trabaja a dos decimales', () => {
    expect(redondear(24.499)).toBe(24.5)
    expect(redondear(0.005)).toBe(0.01)
    expect(redondear(null)).toBeNull()
  })

  it('el promedio anual sube desde 0,50 (Art. 26)', () => {
    expect(redondearAnual(79.5)).toBe(80)
    expect(redondearAnual(79.49)).toBe(79)
    expect(redondearAnual(79)).toBe(79)
    expect(redondearAnual(null)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Subtotales por rubro: son las COLUMNAS del registro del docente, así que un
// error acá se ve en pantalla como una nota equivocada por rubro.
// ─────────────────────────────────────────────────────────────────────────────

describe('porRubro — la columna que ve el docente', () => {
  it('suma las actividades de cada rubro, no las muestra sueltas', () => {
    const { porRubro } = registroDeReferencia()
    const tc = porRubro.find((r) => r.nombre === 'Trabajo cotidiano')
    // Cotidiano #3 aporta 12; el Taller está entregado pero sin revisar.
    expect(tc.obtenido).toBe(12)
    expect(tc.calificadas).toBe(1)
    expect(tc.total).toBe(2)
  })

  it('distingue "sacó cero" de "todavía no le califican nada"', () => {
    // Sin esto, la pantalla mostraría 0% en un rubro que aún no se evaluó.
    const rubros = [{ nombre: 'Pruebas', porcentaje: 40 }]
    const acts = [asignacion({ id: 'p1', rubro: 'Pruebas', porcentaje: 40, puntos: 10 })]

    const sinCalificar = calcularRegistro(rubros, acts, () => null, null)
    expect(sinCalificar.porRubro[0]).toMatchObject({ obtenido: 0, calificadas: 0, total: 1 })

    const conCero = calcularRegistro(rubros, acts, () => calificada(0), null)
    expect(conCero.porRubro[0]).toMatchObject({ obtenido: 0, calificadas: 1, total: 1 })
  })

  it('no cuenta como suya la actividad huérfana', () => {
    const r = calcularRegistro(
      RUBROS_MEP,
      [asignacion({ id: 'h', rubro: 'Fantasma', porcentaje: 20 })],
      () => calificada(10),
      null,
    )
    for (const x of r.porRubro) expect(x.total).toBe(x.esAsistencia ? 1 : 0)
  })

  it('la asistencia también reporta si ya tiene nota', () => {
    const conLista = calcularRegistro(RUBROS_MEP, [], () => null, CONTEOS)
    const asis = conLista.porRubro.find((r) => r.esAsistencia)
    expect(asis).toMatchObject({ obtenido: 4.5, calificadas: 1, total: 1 })

    const sinLista = calcularRegistro(RUBROS_MEP, [], () => null, null)
    expect(sinLista.porRubro.find((r) => r.esAsistencia).calificadas).toBe(0)
  })

  it('la suma de los subtotales sigue dando la NOTA FINAL', () => {
    // Es la regla de oro aplicada a las columnas del docente: lo que se ve
    // sumado horizontalmente tiene que dar el número de la derecha.
    const r = registroDeReferencia()
    const suma = r.porRubro.reduce((s, x) => s + x.obtenido, 0)
    expect(redondear(suma)).toBe(redondear(r.notaFinal))
  })
})

describe('estadoAprobacion — para que el color no mienta', () => {
  it('a mitad de periodo nadie está reprobado todavía', () => {
    // 30 de nota con solo 55% evaluado: le faltan 45 puntos por jugarse.
    expect(estadoAprobacion(30, 55, 65)).toBe('en_juego')
  })

  it('marca aprobado apenas alcanza el mínimo', () => {
    expect(estadoAprobacion(65, 70, 65)).toBe('aprobado')
    expect(estadoAprobacion(90, 100, 65)).toBe('aprobado')
  })

  it('marca perdido solo cuando ya no le alcanza', () => {
    // 20 de nota con 90% evaluado: aun sacando el 10% que falta, llega a 30.
    expect(estadoAprobacion(20, 90, 65)).toBe('perdido')
  })

  it('en el límite exacto todavía está en juego', () => {
    // 25 + 40 por evaluar = 65 justo: alcanza si saca todo.
    expect(estadoAprobacion(25, 60, 65)).toBe('en_juego')
    expect(estadoAprobacion(24.99, 60, 65)).toBe('perdido')
  })

  it('con el periodo cerrado, por debajo del mínimo es perdido', () => {
    expect(estadoAprobacion(64, 100, 65)).toBe('perdido')
  })

  it('sin umbral o sin nota no dice nada', () => {
    expect(estadoAprobacion(50, 100, null)).toBeNull()
    expect(estadoAprobacion(null, 100, 65)).toBeNull()
  })

  it('usa el umbral de la modalidad, no un número fijo', () => {
    // Diversificada aprueba con 70, EGB con 65 (Art. 47).
    expect(estadoAprobacion(67, 100, 65)).toBe('aprobado')
    expect(estadoAprobacion(67, 100, 70)).toBe('perdido')
  })
})
