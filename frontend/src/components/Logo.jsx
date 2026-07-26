// Logo "PuraNota" con una marquita verde (✓) al estilo cuaderno.
export default function Logo({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-display font-bold tracking-tight ${className}`}
    >
      <span className="grid h-7 w-7 place-items-center rounded-cuaderno bg-pizarra text-sm text-papel shadow-sm">
        ✓
      </span>
      <span className="text-tinta">
        Pura<span className="text-pizarra">Nota</span>
      </span>
    </span>
  )
}
