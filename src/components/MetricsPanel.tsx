import { Activity, Gauge, MapPinned, Percent, Route } from "lucide-react"
import type { SearchResult } from "../types/graph"
import { useCityGraphStore } from "../store/cityGraphStore"

export function MetricsPanel() {
  const result = useCityGraphStore((state) => state.result)

  return (
    <section className="glass-panel rounded-[26px] p-5">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-blue-200">
          <Activity size={17} strokeWidth={1.8} />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/38">
            Metrics
          </p>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">
            Search profile
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
        <Metric
          icon={<Gauge size={17} />}
          label="Distance"
          value={result?.found ? formatDistance(result.distanceMeters) : "-"}
        />
        <Metric
          icon={<Route size={17} />}
          label="Path nodes"
          value={result?.found ? result.path.length.toLocaleString() : "-"}
        />
        <Metric
          icon={<MapPinned size={17} />}
          label="Explored"
          value={result ? result.exploredNodes.toLocaleString() : "-"}
        />
        <Metric
          icon={<Percent size={17} />}
          label="Efficiency"
          value={result?.found ? formatEfficiency(result) : "-"}
        />
      </div>
    </section>
  )
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
      <div className="mb-5 text-blue-200/70">{icon}</div>
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/32">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">{value}</p>
    </div>
  )
}

function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${Math.round(meters)} m`
}

function formatEfficiency(result: SearchResult) {
  if (result.exploredNodes === 0) return "-"
  const efficiency = (result.path.length / result.exploredNodes) * 100
  return efficiency >= 10 ? `${efficiency.toFixed(1)}%` : `${efficiency.toFixed(2)}%`
}
