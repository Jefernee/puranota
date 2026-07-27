import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  calcularEstado,
  puedeEntregar,
  tipoDe,
  estadoRegistro,
  TIPOS,
  TONO_BADGE,
} from './entregas'

// Estas funciones guían la interfaz, pero deben reflejar las políticas RLS de la
// base. Si divergen, el estudiante ve un botón que la base le va a rechazar
// (o peor: no ve uno que sí podía usar).

const HOY = new Date('2026-07-15T12:00:00Z')
const AYER = '2026-07-14T23:59:59Z'
const MANANA = '2026-07-16T23:59:59Z'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(HOY)
})
afterEach(() => {
  vi.useRealTimers()
})

const abierta = (extra = {}) => ({
  fecha_limite: MANANA,
  permite_tardias: false,
  requiere_entrega: true,
  ...extra,
})
const vencida = (extra = {}) => ({
  fecha_limite: AYER,
  permite_tardias: false,
  requiere_entrega: true,
  ...extra,
})

describe('puedeEntregar — debe coincidir con la política RLS', () => {
  it('sin entrega y con plazo abierto, sí', () => {
    expect(puedeEntregar(abierta(), null)).toBe(true)
  })

  it('sin entrega y vencida sin tardías, no', () => {
    expect(puedeEntregar(vencida(), null)).toBe(false)
  })

  it('sin entrega y vencida pero admite tardías, sí', () => {
    expect(puedeEntregar(vencida({ permite_tardias: true }), null)).toBe(true)
  })

  it('sin fecha límite siempre se puede', () => {
    expect(puedeEntregar({ fecha_limite: null, requiere_entrega: true }, null)).toBe(true)
  })

  it('con entrega sin calificar y plazo abierto puede reemplazar', () => {
    expect(puedeEntregar(abierta(), { estado: 'entregada' })).toBe(true)
  })

  it('YA CALIFICADA no se toca, aunque el plazo siga abierto', () => {
    // Es justo el hueco que se cerró en la política RLS el 2026-07-26.
    expect(puedeEntregar(abierta(), { estado: 'calificada' })).toBe(false)
  })

  it('con el plazo vencido no se reemplaza, ni admitiendo tardías', () => {
    // Ojo: admitir tardías permite ENTREGAR tarde, no REEMPLAZAR después.
    const a = vencida({ permite_tardias: true })
    expect(puedeEntregar(a, { estado: 'entregada' })).toBe(false)
  })

  it('una prueba escrita nunca la entrega el estudiante', () => {
    expect(puedeEntregar(abierta({ requiere_entrega: false }), null)).toBe(false)
  })
})

describe('calcularEstado — lo que ve el estudiante arriba', () => {
  it('pendiente mientras haya plazo', () => {
    expect(calcularEstado(abierta(), null)).toMatchObject({ clave: 'pendiente' })
  })

  it('cerrada cuando venció y no admite tardías', () => {
    expect(calcularEstado(vencida(), null)).toMatchObject({ clave: 'cerrada' })
  })

  it('avisa que todavía puede entregar tarde', () => {
    expect(calcularEstado(vencida({ permite_tardias: true }), null)).toMatchObject({
      clave: 'pendiente_tardia',
    })
  })

  it('entregada a tiempo', () => {
    expect(calcularEstado(abierta(), { estado: 'entregada', tardia: false })).toMatchObject(
      { clave: 'entregada' },
    )
  })

  it('entregada tarde se marca en rojo', () => {
    const e = calcularEstado(abierta(), { estado: 'entregada', tardia: true })
    expect(e.clave).toBe('tardia')
    expect(e.tono).toBe('margen')
  })

  it('calificada manda sobre cualquier otro estado', () => {
    const e = calcularEstado(vencida(), { estado: 'calificada', tardia: true })
    expect(e.clave).toBe('calificada')
  })

  it('una prueba escrita solo distingue si ya tiene nota', () => {
    const a = abierta({ requiere_entrega: false })
    expect(calcularEstado(a, null)).toMatchObject({ clave: 'sin_nota' })
    expect(calcularEstado(a, { estado: 'calificada' })).toMatchObject({
      clave: 'calificada',
    })
  })

  it('todos los tonos usados existen en la paleta', () => {
    const casos = [
      calcularEstado(abierta(), null),
      calcularEstado(vencida(), null),
      calcularEstado(vencida({ permite_tardias: true }), null),
      calcularEstado(abierta(), { estado: 'entregada', tardia: true }),
      calcularEstado(abierta(), { estado: 'calificada' }),
    ]
    for (const c of casos) expect(TONO_BADGE[c.tono]).toBeDefined()
  })
})

describe('estadoRegistro — la columna Estado de la tabla', () => {
  it('acá "calificada" NO es un estado: eso va en su propia columna', () => {
    const e = estadoRegistro(abierta(), { estado: 'calificada', tardia: false })
    expect(e.clave).toBe('entregada')
  })

  it('distingue la entrega tardía', () => {
    expect(estadoRegistro(abierta(), { tardia: true })).toMatchObject({ clave: 'tardia' })
  })

  it('sin entregar mientras hay plazo', () => {
    expect(estadoRegistro(abierta(), null)).toMatchObject({ clave: 'sin_entregar' })
  })

  it('cerrada cuando venció sin tardías', () => {
    expect(estadoRegistro(vencida(), null)).toMatchObject({ clave: 'cerrada' })
  })

  it('la prueba escrita dice que no requiere entrega', () => {
    expect(estadoRegistro({ requiere_entrega: false }, null)).toMatchObject({
      clave: 'sin_entrega',
    })
  })
})

describe('tipoDe — columna Tipo del registro (D13)', () => {
  it('usa la columna tipo cuando existe', () => {
    expect(tipoDe({ tipo: 'foro' })).toMatchObject({ clave: 'foro', label: 'Foro' })
    expect(tipoDe({ tipo: 'proyecto' })).toMatchObject({ clave: 'proyecto' })
  })

  it('una fila vieja sin tipo se deduce de requiere_entrega', () => {
    expect(tipoDe({ requiere_entrega: false })).toMatchObject({ clave: 'prueba' })
    expect(tipoDe({ requiere_entrega: true })).toMatchObject({ clave: 'entrega' })
  })

  it('un tipo desconocido no rompe la pantalla', () => {
    expect(tipoDe({ tipo: 'inventado' })).toMatchObject({ clave: 'entrega' })
    expect(tipoDe(null)).toMatchObject({ clave: 'entrega' })
  })

  it('los cuatro tipos del plan tienen nombre legible', () => {
    expect(Object.keys(TIPOS)).toEqual(['entrega', 'prueba', 'proyecto', 'foro'])
    expect(Object.values(TIPOS).every((t) => t.label)).toBe(true)
  })
})
