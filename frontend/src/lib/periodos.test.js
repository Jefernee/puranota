import { describe, it, expect } from 'vitest'
import {
  PERIODOS,
  CANTIDADES_PERIODOS,
  etiquetaPeriodo,
  cantidadPeriodos,
  periodosDeGrupo,
  periodoValido,
  fechasSugeridasPeriodos,
  CALENDARIO_LECTIVO,
} from './periodos'

// Recordatorio (ADR-001): `grupos.periodo` NO guarda "I Periodo", guarda la
// CANTIDAD de periodos como texto ("2" o "3"). Hay grupos viejos con el
// significado anterior, y no se pueden romper.

describe('cantidadPeriodos', () => {
  it('lee la cantidad guardada', () => {
    expect(cantidadPeriodos({ periodo: '2' })).toBe(2)
    expect(cantidadPeriodos({ periodo: '3' })).toBe(3)
  })

  it('acepta también un número', () => {
    expect(cantidadPeriodos({ periodo: 3 })).toBe(3)
  })

  it('un grupo viejo con "I Periodo" cae a 2 sin romperse', () => {
    expect(cantidadPeriodos({ periodo: 'I Periodo' })).toBe(2)
  })

  it('cualquier valor raro cae a 2', () => {
    expect(cantidadPeriodos({ periodo: '4' })).toBe(2)
    expect(cantidadPeriodos({ periodo: '0' })).toBe(2)
    expect(cantidadPeriodos({ periodo: null })).toBe(2)
    expect(cantidadPeriodos({})).toBe(2)
    expect(cantidadPeriodos(null)).toBe(2)
  })

  it('solo se permiten 2 o 3 periodos', () => {
    expect(CANTIDADES_PERIODOS).toEqual([2, 3])
  })
})

describe('periodosDeGrupo y periodoValido', () => {
  it('un grupo de 2 periodos usa I y II', () => {
    expect(periodosDeGrupo({ periodo: '2' })).toEqual(['I', 'II'])
  })

  it('un grupo de 3 usa los tres', () => {
    expect(periodosDeGrupo({ periodo: '3' })).toEqual(['I', 'II', 'III'])
  })

  it('el III no es válido en un grupo de dos periodos', () => {
    expect(periodoValido({ periodo: '2' }, 'III')).toBe(false)
    expect(periodoValido({ periodo: '3' }, 'III')).toBe(true)
  })

  it('el orden canónico no cambia', () => {
    expect(PERIODOS).toEqual(['I', 'II', 'III'])
  })

  it('etiquetaPeriodo escribe como en el registro', () => {
    expect(etiquetaPeriodo('I')).toBe('I Periodo')
  })
})

describe('fechasSugeridasPeriodos — reparto del año lectivo', () => {
  it('arranca el 1 de febrero y cierra el 15 de diciembre', () => {
    const f = fechasSugeridasPeriodos(2026, ['I', 'II'])
    expect(f.I.inicio).toBe('2026-02-01')
    expect(f.II.fin).toBe('2026-12-15')
  })

  it('parte el año en dos tramos que no se pisan', () => {
    const f = fechasSugeridasPeriodos(2026, ['I', 'II'])
    expect(f.I.fin < f.II.inicio).toBe(true)
  })

  it('parte el año en tres tramos ordenados', () => {
    const f = fechasSugeridasPeriodos(2026, ['I', 'II', 'III'])
    expect(f.I.inicio < f.I.fin).toBe(true)
    expect(f.I.fin < f.II.inicio).toBe(true)
    expect(f.II.fin < f.III.inicio).toBe(true)
    expect(f.III.fin).toBe('2026-12-15')
  })

  it('sirve para cualquier año', () => {
    const f = fechasSugeridasPeriodos(2027, ['I', 'II'])
    expect(f.I.inicio).toBe('2027-02-01')
    expect(f.II.fin).toBe('2027-12-15')
  })

  it('si el MEP mueve el calendario, solo cambia esa constante', () => {
    const otro = { inicio: { mes: 3, dia: 1 }, fin: { mes: 11, dia: 30 } }
    const f = fechasSugeridasPeriodos(2026, ['I', 'II'], otro)
    expect(f.I.inicio).toBe('2026-03-01')
    expect(f.II.fin).toBe('2026-11-30')
  })

  it('el calendario vigente es el del curso 2026', () => {
    expect(CALENDARIO_LECTIVO.inicio).toEqual({ mes: 2, dia: 1 })
    expect(CALENDARIO_LECTIVO.fin).toEqual({ mes: 12, dia: 15 })
  })

  it('todas las fechas salen en formato AAAA-MM-DD', () => {
    const f = fechasSugeridasPeriodos(2026, ['I', 'II', 'III'])
    for (const p of ['I', 'II', 'III']) {
      expect(f[p].inicio).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(f[p].fin).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
