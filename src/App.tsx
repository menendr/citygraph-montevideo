import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import { AlgorithmControls } from "./components/AlgorithmControls"
import { CityGraphDeck } from "./components/CityGraphDeck"
import { MetricsPanel } from "./components/MetricsPanel"
import { runSearch } from "./algorithms/search"
import { chooseInitialEndpoints } from "./graph/initialEndpoints"
import { getInitialViewportProfile } from "./graph/initialViewport"
import { loadGraph } from "./graph/loadGraph"
import { useCityGraphStore } from "./store/cityGraphStore"

function App() {
  const graph = useCityGraphStore((state) => state.graph)
  const algorithm = useCityGraphStore((state) => state.algorithm)
  const startNode = useCityGraphStore((state) => state.startNode)
  const endNode = useCityGraphStore((state) => state.endNode)
  const dragTarget = useCityGraphStore((state) => state.dragTarget)
  const setGraph = useCityGraphStore((state) => state.setGraph)
  const setResult = useCityGraphStore((state) => state.setResult)
  const initialViewportProfileRef = useRef(getInitialViewportProfile())

  useEffect(() => {
    let cancelled = false

    loadGraph().then((loadedGraph) => {
      if (cancelled) return
      const endpoints = chooseInitialEndpoints(loadedGraph, initialViewportProfileRef.current)
      setGraph(loadedGraph, endpoints.startNode, endpoints.endNode)
    })

    return () => {
      cancelled = true
    }
  }, [setGraph])

  useEffect(() => {
    if (!graph || startNode === null || endNode === null) return
    if (dragTarget) {
      setResult(null)
      return
    }
    setResult(runSearch(graph, algorithm, startNode, endNode))
  }, [algorithm, dragTarget, endNode, graph, setResult, startNode])

  return (
    <main className="min-h-svh w-full overflow-x-hidden px-5 py-4 xl:h-[100dvh] xl:w-screen xl:overflow-hidden xl:[@media(max-height:800px)]:py-3">
      <div className="mx-auto flex min-h-svh w-full max-w-[2400px] flex-col gap-4 xl:h-full xl:min-h-0 xl:[@media(max-height:800px)]:gap-3">
        <header className="flex h-14 items-center gap-3 border-b hairline xl:[@media(max-height:800px)]:h-11">
          <a
            aria-label="Back to homepage"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white/[0.025] text-[var(--muted)] transition hover:border-[var(--line-strong)] hover:bg-white/[0.055] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
            href="/"
          >
            <ArrowLeft aria-hidden="true" size={17} strokeWidth={1.9} />
          </a>
          <h1 className="text-xl font-medium tracking-normal">CityGraph: Montevideo</h1>
        </header>

        <div className="grid flex-1 gap-4 xl:min-h-0 xl:overflow-hidden xl:grid-cols-[310px_minmax(0,1fr)_286px]">
          <motion.aside
            animate={{ opacity: 1, y: 0 }}
            className="xl:min-h-0 xl:overflow-y-auto xl:block"
            initial={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <AlgorithmControls />
          </motion.aside>

          <motion.section
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-[32px] p-3 xl:min-h-0"
            initial={{ opacity: 0, y: 18 }}
            transition={{ delay: 0.05, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <CityGraphDeck />
          </motion.section>

          <motion.aside
            animate={{ opacity: 1, y: 0 }}
            className="xl:min-h-0 xl:overflow-y-auto"
            initial={{ opacity: 0, y: 14 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <MetricsPanel />
          </motion.aside>
        </div>
      </div>
    </main>
  )
}

export default App
