import { Icon } from "./icons"

export function SampleDataNotice({ className = "" }: { className?: string }) {
  return (
    <div
      role="note"
      className={`flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-xs leading-5 text-slate-600 ${className}`}
    >
      <Icon name="info" className="mt-0.5 size-4 shrink-0 text-blue-700" />
      <p>
        <span className="font-bold text-blue-900">Sample data:</span> These demonstration records are not live TWD service updates and may not reflect current conditions.
      </p>
    </div>
  )
}