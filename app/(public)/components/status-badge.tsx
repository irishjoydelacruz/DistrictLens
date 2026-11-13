import type { Status } from "../data/mock-data"
import { statusStyle } from "../data/mock-data"

export function StatusBadge({
  status,
  className = "",
}: {
  status: Status
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyle[status]} ${className}`}
    >
      <span aria-hidden="true" className="status-indicator-dot" data-status={status.toLowerCase()} />
      {status}
    </span>
  )
}