// Placeholder de carga: unas cuantas barras tipo tarjeta.
export default function SkeletonLista({ filas = 3, altura = 'h-16' }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className={`skeleton w-full ${altura}`} />
      ))}
    </div>
  )
}
