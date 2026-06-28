import { useState } from "react"
import { Check, ChevronDown, RotateCcw, Route } from "lucide-react"
import { clsx } from "clsx"
import { useCityGraphStore } from "../store/cityGraphStore"
import type { AlgorithmId } from "../types/graph"

const algorithms: Array<{ id: AlgorithmId; label: string; detail: string }> = [
  { id: "dijkstra", label: "Dijkstra", detail: "Weighted shortest" },
  { id: "bidirectionalDijkstra", label: "Bi-Dijkstra", detail: "Two weighted fronts" },
  { id: "astar", label: "A*", detail: "Guided search" },
  { id: "bidirectionalAstar", label: "Bi-A*", detail: "Two guided fronts" },
  { id: "landmarkAstar", label: "ALT A*", detail: "Landmark guided" },
]

export function AlgorithmControls() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const algorithm = useCityGraphStore((state) => state.algorithm)
  const setAlgorithm = useCityGraphStore((state) => state.setAlgorithm)
  const restartAnimation = useCityGraphStore((state) => state.restartAnimation)
  const selectedAlgorithm = algorithms.find((item) => item.id === algorithm) ?? algorithms[0]

  return (
    <>
      <section
        className="glass-panel relative z-30 rounded-[24px] px-2 py-3 md:hidden"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsMenuOpen(false)
        }}
      >
        <div className="flex items-center gap-2">
          <button
            aria-expanded={isMenuOpen}
            className="flex h-12 min-w-0 flex-1 items-center justify-between gap-3 rounded-full border border-white/10 bg-black/20 pl-6 pr-4 text-left transition hover:border-white/16 hover:bg-white/[0.045]"
            type="button"
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">
                {selectedAlgorithm.label}
              </span>
              <span className="block truncate text-[0.65rem] font-medium text-white/36">
                {selectedAlgorithm.detail}
              </span>
            </span>
            <ChevronDown
              className={clsx(
                "shrink-0 text-white/46 transition",
                isMenuOpen && "rotate-180 text-white/70",
              )}
              size={16}
              strokeWidth={1.8}
            />
          </button>

          <button
            aria-label="Replay search"
            className="flex size-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/62 transition hover:border-white/18 hover:bg-white/[0.07] hover:text-white"
            type="button"
            onClick={() => {
              setIsMenuOpen(false)
              restartAnimation()
            }}
          >
            <RotateCcw size={16} strokeWidth={1.8} />
          </button>
        </div>

        <div
          className={clsx(
            "absolute left-2 right-2 top-[calc(100%+0.5rem)] overflow-hidden rounded-[22px] border border-white/10 bg-black/70 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition duration-200",
            isMenuOpen
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-1 opacity-0",
          )}
        >
          {algorithms.map((item) => {
            const isActive = algorithm === item.id

            return (
              <button
                className={clsx(
                  "flex h-11 w-full items-center justify-between rounded-[16px] px-3 text-left transition",
                  isActive
                    ? "bg-white/[0.085] text-white"
                    : "text-white/54 hover:bg-white/[0.055] hover:text-white/82",
                )}
                key={item.id}
                type="button"
                onClick={() => {
                  setAlgorithm(item.id)
                  setIsMenuOpen(false)
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{item.label}</span>
                  <span className="block truncate text-[0.65rem] font-medium text-white/34">
                    {item.detail}
                  </span>
                </span>
                {isActive && (
                  <Check
                    className="shrink-0 text-blue-100"
                    size={15}
                    strokeWidth={1.9}
                  />
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="glass-panel hidden rounded-[26px] p-5 md:block">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-blue-200">
          <Route size={17} strokeWidth={1.8} />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/38">
            Algorithm
          </p>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">
            Search mode
          </h2>
        </div>
      </div>

      <div className="space-y-1.5 rounded-[24px] border border-white/10 bg-black/20 p-1.5">
        {algorithms.map((item, index) => {
          const isActive = algorithm === item.id

          return (
            <button
              className={clsx(
                "group relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-[16px] border px-3.5 py-2.5 text-left transition duration-300",
                isActive
                  ? "border-white/18 bg-white/[0.075] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_28px_rgba(130,174,255,0.12)]"
                  : "border-transparent bg-white/[0.018] text-white/56 hover:border-white/10 hover:bg-white/[0.045] hover:text-white/82",
              )}
              key={item.id}
              type="button"
              onClick={() => setAlgorithm(item.id)}
            >
              <span
                className={clsx(
                  "absolute bottom-3 left-0 top-3 w-px rounded-full transition",
                  isActive
                    ? "bg-blue-200/80 shadow-[0_0_16px_rgba(145,190,255,0.72)]"
                    : "bg-white/0 group-hover:bg-white/12",
                )}
              />
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={clsx(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.6rem] font-semibold tracking-[0.08em] transition",
                    isActive
                      ? "border-blue-200/30 bg-blue-200/10 text-blue-100"
                      : "border-white/10 bg-white/[0.025] text-white/32 group-hover:text-white/58",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold tracking-[-0.01em]">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-white/38">
                    {item.detail}
                  </span>
                </span>
              </span>
              <span
                className={clsx(
                  "size-1.5 shrink-0 rounded-full transition",
                  isActive
                    ? "bg-blue-100 shadow-[0_0_14px_rgba(145,190,255,0.9)]"
                    : "bg-white/16 group-hover:bg-white/34",
                )}
              />
            </button>
          )
        })}
      </div>

      <button
        className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] text-sm font-medium text-white/68 transition hover:border-white/18 hover:bg-white/[0.07] hover:text-white"
        type="button"
        onClick={restartAnimation}
      >
        <RotateCcw size={16} strokeWidth={1.8} />
        Replay search
      </button>
      </section>
    </>
  )
}
