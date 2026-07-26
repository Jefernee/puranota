// Editor de rúbrica de una asignación: lista de {criterio, puntos}.
// Controlado: el formulario padre es dueño del estado (value + onChange).
// La suma de criterios es informativa; no obliga a igualar los puntos totales.
export default function RubricaEditor({ value = [], onChange, puntosTotales }) {
  const criterios = value

  function actualizar(i, campo, val) {
    onChange(criterios.map((c, idx) => (idx === i ? { ...c, [campo]: val } : c)))
  }
  function agregar() {
    onChange([...criterios, { criterio: '', puntos: 0 }])
  }
  function quitar(i) {
    onChange(criterios.filter((_, idx) => idx !== i))
  }

  const suma = criterios.reduce((acc, c) => acc + (Number(c.puntos) || 0), 0)
  const total = Number(puntosTotales) || 0
  const coincide = suma === total

  return (
    <div className="space-y-3">
      {criterios.length === 0 && (
        <p className="text-sm text-tinta/60">
          Opcional. Agregá criterios para guiar la calificación (ej. “Portada
          completa”, “Resuelve los ejercicios”).
        </p>
      )}

      {criterios.length > 0 && (
        <div className="space-y-2">
          {criterios.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="campo flex-1"
                placeholder="Criterio (ej. Portada completa)"
                value={c.criterio}
                onChange={(e) => actualizar(i, 'criterio', e.target.value)}
                aria-label="Criterio"
              />
              <div className="relative w-24 shrink-0">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="campo pr-8 text-right"
                  value={c.puntos}
                  onChange={(e) => actualizar(i, 'puntos', e.target.value)}
                  aria-label="Puntos del criterio"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-tinta/60">
                  pts
                </span>
              </div>
              <button
                type="button"
                onClick={() => quitar(i)}
                className="shrink-0 rounded-cuaderno px-2 py-2 text-tinta/60 hover:bg-margen/10 hover:text-margen"
                aria-label="Quitar criterio"
                title="Quitar"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={agregar}
        className="inline-flex min-h-[40px] items-center gap-1 rounded-cuaderno bg-pizarra/10 px-4 text-sm font-semibold text-pizarra transition-colors hover:bg-pizarra/20"
      >
        + Agregar criterio
      </button>

      {criterios.length > 0 && (
        <div
          className={`flex items-center justify-between rounded-cuaderno border px-3 py-2 text-sm ${
            coincide
              ? 'border-pizarra/30 bg-pizarra/10 text-pizarra'
              : 'border-tinta/15 bg-tinta/5 text-tinta/60'
          }`}
        >
          <span>Suma de criterios</span>
          <span className="font-bold">
            {suma} / {total} pts {coincide ? '✓' : ''}
          </span>
        </div>
      )}
    </div>
  )
}
