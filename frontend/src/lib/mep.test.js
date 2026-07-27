import { describe, it, expect } from 'vitest'
import {
  UMBRAL,
  MIN_ASISTENCIA_AMPLIACION,
  ESCALA_ASISTENCIA,
  PRESETS,
  listaPresets,
  umbralDeModalidad,
  rubrosDeModalidad,
  rubrosCompletosDeModalidad,
  notaAsistenciaMEP,
} from './mep'

// La normativa está como DATOS. Estas pruebas cuidan que los números sigan
// siendo los del reglamento (REAC, decreto 45509-MEP, curso lectivo 2026) y que
// nadie rompa la regla estructural: todo periodo suma exactamente 100.

describe('números del reglamento', () => {
  it('la nota mínima de aprobación es 65 y 70, NO 75', () => {
    // El 75 fue un error de prensa. Art. 47.
    expect(UMBRAL.egb).toBe(65)
    expect(UMBRAL.diversificada).toBe(70)
  })

  it('la asistencia mínima para ampliación es 80% (Art. 54)', () => {
    expect(MIN_ASISTENCIA_AMPLIACION).toBe(0.8)
  })

  it('la escala de asistencia baja de 20 en 20 por tramos de 10% (Art. 37)', () => {
    expect(ESCALA_ASISTENCIA.map((t) => t.nota)).toEqual([100, 80, 60, 40, 20, 0])
    expect(ESCALA_ASISTENCIA.at(-1).hasta).toBe(Infinity)
  })
})

describe('notaAsistenciaMEP — tramos del Art. 37', () => {
  it('cada tramo devuelve su nota', () => {
    expect(notaAsistenciaMEP(0)).toBe(100)
    expect(notaAsistenciaMEP(0.099)).toBe(100)
    expect(notaAsistenciaMEP(0.1)).toBe(80)
    expect(notaAsistenciaMEP(0.199)).toBe(80)
    expect(notaAsistenciaMEP(0.2)).toBe(60)
    expect(notaAsistenciaMEP(0.3)).toBe(40)
    expect(notaAsistenciaMEP(0.4)).toBe(20)
    expect(notaAsistenciaMEP(0.5)).toBe(0)
    expect(notaAsistenciaMEP(1)).toBe(0)
  })

  it('los límites son exclusivos: el 10% justo ya bajó de tramo', () => {
    expect(notaAsistenciaMEP(0.0999999)).toBe(100)
    expect(notaAsistenciaMEP(0.1)).toBe(80)
  })

  it('trata una fracción negativa o basura como 0 ausencias', () => {
    expect(notaAsistenciaMEP(-1)).toBe(100)
    expect(notaAsistenciaMEP(null)).toBe(100)
    expect(notaAsistenciaMEP('hola')).toBe(100)
  })
})

describe('presets de modalidad', () => {
  const claves = Object.keys(PRESETS)

  it('están todas las modalidades esperadas', () => {
    expect(claves).toEqual([
      'academico-i-ii',
      'academico-iii',
      'academico-diver',
      'tecnico-nocturno',
      'dual',
      'cindea-i',
      'cindea-ii',
      'cindea-iii',
      'coned',
    ])
  })

  it.each(claves)('%s suma exactamente 100 con su asistencia', (clave) => {
    // Es LA regla estructural: si un preset no suma 100, el editor de rubros lo
    // rechaza y el Modo MEP queda inservible para esa modalidad.
    const { rubros, asis } = rubrosDeModalidad(clave)
    const total =
      rubros.reduce((s, r) => s + r.porcentaje, 0) + (asis ? asis.porcentaje : 0)
    expect(total).toBe(100)
  })

  it.each(claves)('%s tiene un umbral de aprobación válido', (clave) => {
    expect([UMBRAL.egb, UMBRAL.diversificada]).toContain(umbralDeModalidad(clave))
  })

  it.each(claves)('%s no repite nombres de rubro', (clave) => {
    // Dos rubros con el mismo nombre harían contar dos veces la misma actividad.
    const nombres = PRESETS[clave].rubros.map((r) => r.nombre)
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it.each(claves)('%s no usa "Asistencia" como rubro normal', (clave) => {
    const nombres = PRESETS[clave].rubros.map((r) => r.nombre.toLowerCase())
    expect(nombres).not.toContain('asistencia')
  })

  it('la asistencia del MEP vale 5% y dos tardías hacen una ausencia', () => {
    const { asis } = rubrosDeModalidad('academico-iii')
    expect(asis).toMatchObject({
      porcentaje: 5,
      tardiasPorAusencia: 2,
      justificadaCuenta: true,
      mep: true,
    })
  })

  it('CONED no lleva asistencia: es a distancia', () => {
    const { rubros, asis } = rubrosDeModalidad('coned')
    expect(asis).toBeNull()
    expect(rubros.reduce((s, r) => s + r.porcentaje, 0)).toBe(100)
  })

  it('una modalidad inventada no devuelve nada', () => {
    expect(rubrosDeModalidad('no-existe')).toBeNull()
    expect(umbralDeModalidad('no-existe')).toBeNull()
    expect(rubrosCompletosDeModalidad('no-existe')).toBeNull()
  })

  it('listaPresets sirve para poblar el selector', () => {
    const lista = listaPresets()
    expect(lista).toHaveLength(claves.length)
    expect(lista.every((p) => p.clave && p.label)).toBe(true)
  })
})

describe('rubrosCompletosDeModalidad — listo para guardar en grupos.rubros', () => {
  it('devuelve los tres periodos, con el tercero vacío si el grupo tiene dos', () => {
    const r = rubrosCompletosDeModalidad('academico-iii', ['I', 'II'])
    expect(Object.keys(r)).toEqual(['I', 'II', 'III'])
    expect(r.III).toEqual([])
    expect(r.I.length).toBeGreaterThan(0)
  })

  it('agrega el rubro de asistencia marcado como tal', () => {
    const r = rubrosCompletosDeModalidad('academico-iii', ['I'])
    const asis = r.I.find((x) => x.nombre === 'Asistencia')
    expect(asis).toMatchObject({ porcentaje: 5, asistencia: true, mep: true })
  })

  it('cada periodo suma 100 por separado', () => {
    const r = rubrosCompletosDeModalidad('dual', ['I', 'II'])
    for (const p of ['I', 'II']) {
      expect(r[p].reduce((s, x) => s + x.porcentaje, 0)).toBe(100)
    }
  })

  it('los periodos no comparten el mismo objeto: editar uno no toca al otro', () => {
    const r = rubrosCompletosDeModalidad('academico-iii', ['I', 'II'])
    r.I[0].porcentaje = 999
    expect(r.II[0].porcentaje).not.toBe(999)
  })

  it('CONED arma periodos sin fila de asistencia', () => {
    const r = rubrosCompletosDeModalidad('coned', ['I', 'II'])
    expect(r.I.some((x) => x.asistencia)).toBe(false)
    expect(r.I.reduce((s, x) => s + x.porcentaje, 0)).toBe(100)
  })
})
