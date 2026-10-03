export function ProgressBar({ value, label }: { value: number; label: string }) {
  const safe = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span>{safe}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-canvas"
        role="progressbar"
        aria-valuenow={safe}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-navy" style={{ width: `${safe}%` }} />
      </div>
    </div>
  )
}
