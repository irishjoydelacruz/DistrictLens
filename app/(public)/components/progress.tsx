import { Icon } from "./icons"

export function Progress({ step }: { step: number }) {
  const steps = ["Reported", "Responding", "Resolved"]

  return (
    <div className="flex w-full min-w-0 items-start">
      {steps.map((label, index) => {
        const position = index + 1
        const done = position < step
        const active = position === step

        return (
          <div
            key={label}
            className={`flex items-start ${index < steps.length - 1 ? "flex-1" : ""}`}
          >
            <div className="flex flex-col items-center">
              <span
                className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                  done || active
                    ? "bg-blue-700 text-white"
                    : "border border-slate-200 bg-white text-slate-400"
                }`}
              >
                {done ? (
                  <Icon name="check" className="size-4" />
                ) : (
                  position
                )}
              </span>

              <span
                className={`mt-2 text-xs font-semibold ${
                  active ? "text-blue-700" : "text-slate-500"
                }`}
              >
                {label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <span
                className={`mt-4 h-0.5 flex-1 ${
                  position < step ? "bg-blue-700" : "bg-slate-200"
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}