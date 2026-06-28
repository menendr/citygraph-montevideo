import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import DeckGL from "@deck.gl/react"
import { BitmapLayer, LineLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers"
import { TileLayer } from "@deck.gl/geo-layers"
import { DataFilterExtension, type DataFilterExtensionProps } from "@deck.gl/extensions"
import { LocateFixed, Minus, Pause, Play, Plus, RotateCcw } from "lucide-react"
import { getAnimationTiming } from "../animation/timing"
import { NEIGHBORHOOD_LABELS, type NeighborhoodLabel } from "../graph/neighborhoodLabels"
import { getInitialViewportProfile } from "../graph/initialViewport"
import { useCityGraphStore } from "../store/cityGraphStore"
import type { GraphEdge, GraphNode, RuntimeGraph } from "../types/graph"
import type { CityGraphViewportProfile } from "../graph/initialViewport"

type DeckViewState = {
  bearing: number
  latitude: number
  longitude: number
  pitch: number
  zoom: number
}

type SearchEdgeRenderItem = {
  index: number
  source: [number, number]
  target: [number, number]
}

type SegmentRenderItem = {
  source: [number, number]
  target: [number, number]
}

type RecentSignalRenderItem = {
  alpha: number
  position: [number, number]
  radius: number
}

type MarkerRenderItem = {
  label: "A" | "B"
  nodeIndex: number
  position: [number, number]
  role: "start" | "end"
}

const INITIAL_VIEW_STATES: Record<CityGraphViewportProfile, DeckViewState> = {
  desktop: {
    bearing: 0,
    latitude: -34.84,
    longitude: -56.222,
    pitch: 0,
    zoom: 10.80,
  },
  mobile: {
    bearing: 0,
    latitude: -34.875,
    longitude: -56.17,
    pitch: 0,
    zoom: 10.48,
  },
}
const MAX_ZOOM = 15
const MIN_ZOOM_PERCENT = 80
const ZOOM_STEP_PERCENT = 20
const PAN_BOUNDS = {
  east: -55.95,
  north: -34.65,
  south: -35,
  west: -56.5,
}
const PAN_MAX_BOUNDS = [
  [PAN_BOUNDS.west, PAN_BOUNDS.south],
  [PAN_BOUNDS.east, PAN_BOUNDS.north],
] satisfies [[number, number], [number, number]]
const VIEW_ANIMATION_DURATION_MS = 340
const DRAG_HINT_DELAY_MS = 320
const DRAG_HINT_VISIBLE_MS = 7_000

export function CityGraphDeck() {
  const initialViewStateRef = useRef(getInitialViewState())
  const [viewState, setViewState] = useState<DeckViewState>(initialViewStateRef.current)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [showDragHint, setShowDragHint] = useState(false)
  const [hoveredMarkerRole, setHoveredMarkerRole] = useState<MarkerRenderItem["role"] | null>(null)
  const [pausedElapsedMs, setPausedElapsedMs] = useState<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const timelineElapsedRef = useRef(0)
  const timelineProgressLabelRef = useRef<HTMLSpanElement | null>(null)
  const timelineRangeRef = useRef<HTMLInputElement | null>(null)
  const dragHintTimerRef = useRef<number | null>(null)
  const dragHintDismissTimerRef = useRef<number | null>(null)
  const hasMovedEndpointRef = useRef(false)
  const hasShownDragHintRef = useRef(false)
  const viewAnimationFrameRef = useRef<number | null>(null)
  const viewStateRef = useRef<DeckViewState>(initialViewStateRef.current)

  const graph = useCityGraphStore((state) => state.graph)
  const result = useCityGraphStore((state) => state.result)
  const startNode = useCityGraphStore((state) => state.startNode)
  const endNode = useCityGraphStore((state) => state.endNode)
  const animationKey = useCityGraphStore((state) => state.animationKey)
  const dragTarget = useCityGraphStore((state) => state.dragTarget)
  const setEndpoints = useCityGraphStore((state) => state.setEndpoints)
  const setDragTarget = useCityGraphStore((state) => state.setDragTarget)
  const restartAnimation = useCityGraphStore((state) => state.restartAnimation)

  const clearDragHintTimers = useCallback(() => {
    if (dragHintTimerRef.current !== null) {
      window.clearTimeout(dragHintTimerRef.current)
      dragHintTimerRef.current = null
    }
    if (dragHintDismissTimerRef.current !== null) {
      window.clearTimeout(dragHintDismissTimerRef.current)
      dragHintDismissTimerRef.current = null
    }
  }, [])

  const dismissDragHintForEndpointMove = useCallback(() => {
    hasMovedEndpointRef.current = true
    clearDragHintTimers()
    setShowDragHint(false)
  }, [clearDragHintTimers])

  const handleMarkerDrag = useCallback((
    marker: MarkerRenderItem | undefined,
    coordinate?: number[],
  ) => {
    if (!graph || !marker || !coordinate) return false
    const nextNode = nearestNodeByLonLat(graph, coordinate[0], coordinate[1])
    setEndpoints(marker.role === "start" ? { startNode: nextNode } : { endNode: nextNode })
    return true
  }, [graph, setEndpoints])

  const handleMarkerDragStart = useCallback((marker: MarkerRenderItem | undefined) => {
    if (!marker) return false
    dismissDragHintForEndpointMove()
    setDragTarget(marker.role)
    setHoveredMarkerRole(marker.role)
    return true
  }, [dismissDragHintForEndpointMove, setDragTarget])

  const handleMarkerDragEnd = useCallback(() => {
    setDragTarget(null)
    setHoveredMarkerRole(null)
    return true
  }, [setDragTarget])

  const handleMarkerHover = useCallback((marker: MarkerRenderItem | undefined) => {
    const nextRole = marker?.role ?? null
    setHoveredMarkerRole((currentRole) => currentRole === nextRole ? currentRole : nextRole)
    return true
  }, [])

  const animationTiming = useMemo(
    () => (result ? getAnimationTiming(result.distanceMeters) : null),
    [result],
  )
  const animationTotalMs = animationTiming
    ? animationTiming.searchDurationMs + animationTiming.pathRevealDurationMs
    : 0
  const isTimelinePaused = pausedElapsedMs !== null
  const isTimelineComplete = Boolean(result && animationTotalMs > 0 && elapsedMs >= animationTotalMs)
  const shouldShowTimelinePlay = isTimelinePaused || isTimelineComplete
  const searchProgress = result && animationTiming
    ? clamp(elapsedMs / animationTiming.searchDurationMs, 0, 1)
    : 0
  const activeFloat = result ? result.visited.length * searchProgress : 0
  const activeSteps = Math.max(0, Math.floor(activeFloat))
  const pathProgress = result && animationTiming
    ? clamp((elapsedMs - animationTiming.searchDurationMs) / animationTiming.pathRevealDurationMs, 0, 1)
    : 0

  useEffect(() => {
    viewStateRef.current = viewState
  }, [viewState])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
      if (viewAnimationFrameRef.current !== null) cancelAnimationFrame(viewAnimationFrameRef.current)
      clearDragHintTimers()
    }
  }, [clearDragHintTimers])

  useEffect(() => {
    if (!graph) return
    setViewState((current) => clampViewState(graph, current, initialViewStateRef.current.zoom))
  }, [graph])

  useEffect(() => {
    clearDragHintTimers()
    setShowDragHint(false)

    if (!result?.found || hasMovedEndpointRef.current || hasShownDragHintRef.current) return

    const timing = getAnimationTiming(result.distanceMeters)
    dragHintTimerRef.current = window.setTimeout(() => {
      if (hasMovedEndpointRef.current || hasShownDragHintRef.current) return
      hasShownDragHintRef.current = true
      setShowDragHint(true)
      dragHintDismissTimerRef.current = window.setTimeout(() => {
        setShowDragHint(false)
        dragHintDismissTimerRef.current = null
      }, DRAG_HINT_VISIBLE_MS)
    }, timing.searchDurationMs + timing.pathRevealDurationMs + DRAG_HINT_DELAY_MS)

    return clearDragHintTimers
  }, [animationKey, clearDragHintTimers, result])

  const syncTimelineControls = useCallback((nextElapsedMs: number, totalMs: number) => {
    const boundedElapsed = totalMs > 0 ? clamp(nextElapsedMs, 0, totalMs) : 0
    const progress = totalMs > 0 ? (boundedElapsed / totalMs) * 100 : 0
    timelineElapsedRef.current = boundedElapsed

    if (timelineRangeRef.current) {
      timelineRangeRef.current.value = String(Math.round(boundedElapsed))
      timelineRangeRef.current.style.setProperty("--timeline-progress", `${progress}%`)
    }

    if (timelineProgressLabelRef.current) {
      timelineProgressLabelRef.current.textContent = `${Math.round(progress)}%`
    }
  }, [])

  useEffect(() => {
    startedAtRef.current = performance.now()
    setElapsedMs(0)
    setPausedElapsedMs(null)
    syncTimelineControls(0, animationTotalMs)
  }, [animationKey, animationTotalMs, result, syncTimelineControls])

  useEffect(() => {
    let cancelled = false

    const render = () => {
      const pausedElapsed = pausedElapsedMs
      const nextElapsed =
        pausedElapsed ?? Math.min(performance.now() - startedAtRef.current, animationTotalMs || Number.POSITIVE_INFINITY)
      setElapsedMs(nextElapsed)

      if (result && pausedElapsed === null) {
        syncTimelineControls(Math.min(nextElapsed, animationTotalMs), animationTotalMs)
      }

      const searchIsAnimating = Boolean(result && pausedElapsed === null && nextElapsed < animationTotalMs)
      if (!cancelled && (searchIsAnimating || showDragHint)) {
        animationFrameRef.current = requestAnimationFrame(render)
        return
      }

      animationFrameRef.current = null
    }

    render()

    return () => {
      cancelled = true
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [animationKey, animationTotalMs, pausedElapsedMs, result, showDragHint, syncTimelineControls])

  const edgeByKey = useMemo(() => {
    const map = new Map<string, GraphEdge>()
    graph?.edges.forEach((edge) => map.set(edge.key, edge))
    return map
  }, [graph])

  const roadEdges = useMemo(() => {
    if (!graph) return []
    return graph.edges.map((edge) => edgeToRenderItem(graph, edge))
  }, [graph])

  const searchEdges = useMemo(() => {
    if (!graph || !result) return []

    const edges: SearchEdgeRenderItem[] = []
    for (let index = 0; index < result.visited.length; index += 1) {
      const step = result.visited[index]
      if (!step.edgeKey) continue
      const edge = edgeByKey.get(step.edgeKey)
      if (!edge) continue
      edges.push({ ...edgeToRenderItem(graph, edge), index })
    }
    return edges
  }, [edgeByKey, graph, result])

  const pathPositions = useMemo(() => {
    if (!graph || !result?.found || pathProgress <= 0) return []
    return partialPathPositions(graph, result.path, pathProgress)
  }, [graph, pathProgress, result])

  const activeEdge = useMemo(() => {
    if (!graph || !result) return []
    const step = result.visited[activeSteps]
    if (!step || step.from === null) return []
    const source = graph.nodes[step.from]
    const target = graph.nodes[step.node]
    const progress = activeFloat - Math.floor(activeFloat)
    return [{
      source: nodePosition(source),
      target: [
        lerp(source.lon, target.lon, progress),
        lerp(source.lat, target.lat, progress),
      ] as [number, number],
    }]
  }, [activeFloat, activeSteps, graph, result])

  const recentSignals = useMemo(() => {
    if (!graph || !result || activeSteps >= result.visited.length) return []

    const startIndex = Math.max(0, activeSteps - 90)
    const length = Math.max(1, activeSteps - startIndex)
    const signals: RecentSignalRenderItem[] = []
    for (let index = startIndex; index < activeSteps; index += 1) {
      const step = result.visited[index]
      const node = graph.nodes[step.node]
      if (!node) continue
      const alpha = ((index - startIndex + 1) / length) ** 1.6
      signals.push({
        alpha: 0.18 + alpha * 0.82,
        position: nodePosition(node),
        radius: 1.6 + alpha * 2.4,
      })
    }
    return signals
  }, [activeSteps, graph, result])

  const markers = useMemo(() => {
    if (!graph || startNode === null || endNode === null) return []
    return [
      {
        label: "A",
        nodeIndex: startNode,
        position: nodePosition(graph.nodes[startNode]),
        role: "start",
      },
      {
        label: "B",
        nodeIndex: endNode,
        position: nodePosition(graph.nodes[endNode]),
        role: "end",
      },
    ] satisfies MarkerRenderItem[]
  }, [endNode, graph, startNode])

  const filterExtension = useMemo(() => new DataFilterExtension({ filterSize: 1 }), [])

  const layers = useMemo(() => {
    if (!graph) return []

    return [
      new TileLayer({
        id: "osm-tiles",
        data: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        getTileData: ({ signal, url }) => {
          if (!url) return null
          return loadTileImage(url, signal)
        },
        maxZoom: 17,
        minZoom: 10,
        opacity: 0.1,
        renderSubLayers: (props) => {
          const { east, north, south, west } = props.tile.bbox as {
            east: number
            north: number
            south: number
            west: number
          }

          return new BitmapLayer({
            ...props,
            bounds: [west, south, east, north],
            data: [0] as never,
            desaturate: 1,
            image: props.data,
            tintColor: [75, 85, 96],
          })
        },
        tileSize: 256,
      }),
      new LineLayer<SegmentRenderItem>({
        data: roadEdges,
        getColor: [180, 190, 204, 27],
        getSourcePosition: (edge) => edge.source,
        getTargetPosition: (edge) => edge.target,
        getWidth: 0.72,
        id: "roads",
        widthUnits: "pixels",
      }),
      new ScatterplotLayer<GraphNode>({
        data: graph.nodes,
        getFillColor: [190, 198, 210, 40],
        getPosition: (node) => nodePosition(node),
        getRadius: 1.2,
        id: "passive-nodes",
        radiusUnits: "pixels",
      }),
      new LineLayer<SearchEdgeRenderItem, DataFilterExtensionProps<SearchEdgeRenderItem>>({
        data: searchEdges,
        extensions: [filterExtension],
        filterRange: [0, Math.max(0, activeSteps - 1)],
        getColor: [120, 170, 255, 72],
        getFilterValue: (edge: SearchEdgeRenderItem) => edge.index,
        getSourcePosition: (edge) => edge.source,
        getTargetPosition: (edge) => edge.target,
        getWidth: 1.35,
        id: "search-edges",
        updateTriggers: {
          filterRange: activeSteps,
        },
        widthUnits: "pixels",
      }),
      new LineLayer<SegmentRenderItem>({
        data: activeEdge,
        getColor: [214, 229, 255, 184],
        getSourcePosition: (edge) => edge.source,
        getTargetPosition: (edge) => edge.target,
        getWidth: 2,
        id: "active-edge",
        widthUnits: "pixels",
      }),
      new ScatterplotLayer<RecentSignalRenderItem>({
        data: recentSignals,
        getFillColor: (signal) => [175, 207, 255, Math.round(signal.alpha * 112)],
        getPosition: (signal) => signal.position,
        getRadius: (signal) => signal.radius,
        id: "recent-signals",
        radiusUnits: "pixels",
      }),
      new LineLayer<SegmentRenderItem>({
        data: pathSegments(pathPositions),
        getColor: [232, 240, 255, 230],
        getSourcePosition: (segment) => segment.source,
        getTargetPosition: (segment) => segment.target,
        getWidth: 2.6,
        id: "final-path",
        widthUnits: "pixels",
      }),
      new ScatterplotLayer<MarkerRenderItem>({
        data: markers,
        getFillColor: (marker) => marker.role === "start" ? [202, 222, 255, 244] : [120, 170, 255, 244],
        getLineColor: [255, 255, 255, 184],
        getLineWidth: 1.6,
        getPosition: (marker) => marker.position,
        getRadius: 7.2,
        id: "markers",
        lineWidthUnits: "pixels",
        onDrag: (info) => handleMarkerDrag(info.object, info.coordinate),
        onDragEnd: handleMarkerDragEnd,
        onDragStart: (info) => handleMarkerDragStart(info.object),
        onHover: (info) => handleMarkerHover(info.object),
        pickable: true,
        radiusUnits: "pixels",
        stroked: true,
      }),
      new ScatterplotLayer<MarkerRenderItem>({
        data: markers,
        getFillColor: [0, 0, 0, 0],
        getLineColor: [255, 255, 255, 184],
        getLineWidth: 1.6,
        getPosition: (marker) => marker.position,
        getRadius: 12.5,
        id: "marker-rings",
        lineWidthUnits: "pixels",
        radiusUnits: "pixels",
        stroked: true,
      }),
      new TextLayer<MarkerRenderItem>({
        data: markers,
        getColor: [255, 255, 255, 178],
        getPosition: (marker) => marker.position,
        getSize: 11,
        getText: (marker) => marker.label,
        getTextAnchor: "middle",
        getPixelOffset: [0, -18],
        id: "marker-labels",
      }),
      new ScatterplotLayer<MarkerRenderItem>({
        data: markers,
        getFillColor: [255, 255, 255, 1],
        getPosition: (marker) => marker.position,
        getRadius: 22,
        id: "marker-hit-targets",
        onDrag: (info) => handleMarkerDrag(info.object, info.coordinate),
        onDragEnd: handleMarkerDragEnd,
        onDragStart: (info) => handleMarkerDragStart(info.object),
        onHover: (info) => handleMarkerHover(info.object),
        pickable: true,
        radiusUnits: "pixels",
      }),
      new TextLayer<NeighborhoodLabel>({
        data: NEIGHBORHOOD_LABELS.filter((label) => viewState.zoom >= label.minZoom + 9.55),
        getColor: [232, 238, 248, 104],
        getPosition: (label) => [label.lon, label.lat],
        getSize: 10,
        getText: (label) => label.name.toUpperCase(),
        getTextAnchor: "middle",
        id: "neighborhood-labels",
      }),
    ]
  }, [
    activeEdge,
    activeSteps,
    filterExtension,
    graph,
    handleMarkerDrag,
    handleMarkerDragEnd,
    handleMarkerDragStart,
    handleMarkerHover,
    markers,
    pathPositions,
    recentSignals,
    roadEdges,
    searchEdges,
    viewState.zoom,
  ])

  function applyDeckViewStateChange(
    nextViewState: Record<string, unknown>,
  ) {
    const nextNormalizedViewState = normalizeDeckViewState(nextViewState)
    const nextBoundedViewState = graph
      ? clampViewState(graph, nextNormalizedViewState, initialViewStateRef.current.zoom)
      : nextNormalizedViewState

    if (isSameViewState(viewStateRef.current, nextBoundedViewState)) return

    if (viewAnimationFrameRef.current !== null) {
      cancelAnimationFrame(viewAnimationFrameRef.current)
      viewAnimationFrameRef.current = null
    }
    viewStateRef.current = nextBoundedViewState
    setViewState(nextBoundedViewState)
  }

  function zoomToAdjacentStep(direction: -1 | 1) {
    const baseZoom = initialViewStateRef.current.zoom
    const currentPercent = zoomToPercent(viewStateRef.current.zoom, baseZoom)
    const currentStep = currentPercent / ZOOM_STEP_PERCENT
    const nextStep = direction > 0
      ? Math.floor(currentStep + 0.0001) + 1
      : Math.ceil(currentStep - 0.0001) - 1
    const maxZoomPercent = zoomToPercent(MAX_ZOOM, baseZoom)
    const nextPercent = clamp(
      nextStep * ZOOM_STEP_PERCENT,
      MIN_ZOOM_PERCENT,
      maxZoomPercent,
    )

    animateViewState({
      ...viewStateRef.current,
      zoom: zoomFromPercent(nextPercent, baseZoom),
    })
  }

  function animateViewState(target: DeckViewState, durationMs = VIEW_ANIMATION_DURATION_MS) {
    if (viewAnimationFrameRef.current !== null) cancelAnimationFrame(viewAnimationFrameRef.current)
    const startedAt = performance.now()
    const start = viewStateRef.current

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs)
      const eased = 1 - (1 - progress) ** 3
      const nextViewState = {
        bearing: 0,
        latitude: lerp(start.latitude, target.latitude, eased),
        longitude: lerp(start.longitude, target.longitude, eased),
        pitch: 0,
        zoom: lerp(start.zoom, target.zoom, eased),
      }
      viewStateRef.current = nextViewState
      setViewState(nextViewState)

      if (progress < 1) {
        viewAnimationFrameRef.current = requestAnimationFrame(animate)
        return
      }

      viewAnimationFrameRef.current = null
      viewStateRef.current = target
      setViewState(target)
    }

    viewAnimationFrameRef.current = requestAnimationFrame(animate)
  }

  function resetCamera() {
    const initialViewState = initialViewStateRef.current
    if (!graph) {
      animateViewState(initialViewState)
      return
    }
    animateViewState(clampViewState(graph, initialViewState, initialViewState.zoom))
  }

  function replaySearch() {
    restartAnimation()
  }

  function toggleTimelinePlayback() {
    if (!result || animationTotalMs <= 0) return

    const currentElapsed = Math.min(timelineElapsedRef.current, animationTotalMs)
    if (currentElapsed >= animationTotalMs) {
      restartAnimation()
      return
    }

    if (pausedElapsedMs === null) {
      syncTimelineControls(currentElapsed, animationTotalMs)
      setElapsedMs(currentElapsed)
      setPausedElapsedMs(currentElapsed)
      return
    }

    startedAtRef.current = performance.now() - pausedElapsedMs
    syncTimelineControls(pausedElapsedMs, animationTotalMs)
    setPausedElapsedMs(null)
  }

  function scrubTimeline(nextElapsedMs: number) {
    const nextElapsed = Math.min(animationTotalMs, Math.max(0, nextElapsedMs))
    syncTimelineControls(nextElapsed, animationTotalMs)
    setElapsedMs(nextElapsed)
    setPausedElapsedMs(nextElapsed)
  }

  return (
    <div className="relative h-[min(64svh,520px)] min-h-[360px] overflow-hidden rounded-[28px] xl:h-full xl:min-h-0">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_55%_42%,rgba(35,53,72,0.18),rgba(9,12,15,0.48)_56%,rgba(4,6,8,0.96))]" />
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:58px_58px]" />
      <DeckGL
        controller={{
          doubleClickZoom: true,
          dragPan: !dragTarget && !hoveredMarkerRole,
          maxBounds: PAN_MAX_BOUNDS,
          scrollZoom: { smooth: true },
          touchZoom: true,
        }}
        getCursor={({ isDragging, isHovering }) =>
          dragTarget || isDragging ? "grabbing" : isHovering ? "grab" : "grab"
        }
        layers={layers}
        viewState={viewState}
        onViewStateChange={({ viewState: nextViewState }) => {
          applyDeckViewStateChange(nextViewState)
        }}
      />
      <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/38 p-1 shadow-[0_16px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <button
          aria-label="Zoom out"
          className="pointer-events-auto flex size-9 items-center justify-center rounded-full text-white/62 transition hover:bg-white/10 hover:text-white"
          type="button"
          onClick={() => zoomToAdjacentStep(-1)}
        >
          <Minus size={16} strokeWidth={1.8} />
        </button>
        <span className="mono min-w-12 text-center text-xs text-white/48">
          {Math.round(zoomToPercent(viewState.zoom, initialViewStateRef.current.zoom))}%
        </span>
        <button
          aria-label="Zoom in"
          className="pointer-events-auto flex size-9 items-center justify-center rounded-full text-white/62 transition hover:bg-white/10 hover:text-white"
          type="button"
          onClick={() => zoomToAdjacentStep(1)}
        >
          <Plus size={16} strokeWidth={1.8} />
        </button>
        <button
          aria-label="Reset map"
          className="pointer-events-auto flex size-9 items-center justify-center rounded-full text-white/62 transition hover:bg-white/10 hover:text-white"
          type="button"
          onClick={resetCamera}
        >
          <LocateFixed size={16} strokeWidth={1.8} />
        </button>
      </div>
      {result && animationTotalMs > 0 && (
        <div className="pointer-events-auto absolute bottom-5 left-1/2 z-20 flex w-[min(30rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/42 p-1.5 shadow-[0_18px_58px_rgba(0,0,0,0.36)] backdrop-blur-xl">
          <button
            aria-label="Replay route search"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/58 transition hover:bg-white/10 hover:text-white"
            type="button"
            onClick={replaySearch}
          >
            <RotateCcw size={15} strokeWidth={1.8} />
          </button>
          <button
            aria-label={shouldShowTimelinePlay ? "Play route animation" : "Pause route animation"}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.055] text-white/70 transition hover:bg-white/12 hover:text-white"
            type="button"
            onClick={toggleTimelinePlayback}
          >
            {shouldShowTimelinePlay ? (
              <Play size={15} strokeWidth={1.9} />
            ) : (
              <Pause size={15} strokeWidth={1.9} />
            )}
          </button>
          <input
            ref={timelineRangeRef}
            aria-label="Replay timeline"
            className="timeline-range min-w-0 flex-1"
            defaultValue={0}
            max={animationTotalMs}
            min={0}
            step={16}
            type="range"
            onChange={(event) => scrubTimeline(Number(event.currentTarget.value))}
          />
          <span ref={timelineProgressLabelRef} className="mono min-w-9 text-right text-[10px] text-white/38">
            0%
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 left-4 hidden rounded-full border border-white/8 bg-black/28 px-3 py-1 text-[10px] text-white/28 backdrop-blur-xl md:block">
        © OpenStreetMap contributors
      </div>
      <div
        aria-live="polite"
        className={`pointer-events-none absolute bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/10 bg-black/36 px-3.5 py-2 text-xs font-medium text-white/56 shadow-[0_16px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-500 ${
          showDragHint ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        Drag A or B to compare routes
      </div>
    </div>
  )
}

function edgeToRenderItem(graph: RuntimeGraph, edge: GraphEdge) {
  return {
    source: nodePosition(graph.nodes[edge.source]),
    target: nodePosition(graph.nodes[edge.target]),
  }
}

function nodePosition(node: GraphNode): [number, number] {
  return [node.lon, node.lat]
}

function nearestNodeByLonLat(graph: RuntimeGraph, lon: number, lat: number) {
  const target = lonLatToWebMercator(lon, lat)
  let nearest = graph.nodes[0]?.index ?? 0
  let bestDistance = Number.POSITIVE_INFINITY

  for (const node of graph.nodes) {
    const distance = (node.x - target.x) ** 2 + (node.y - target.y) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      nearest = node.index
    }
  }

  return nearest
}

function partialPathPositions(graph: RuntimeGraph, path: number[], progress: number) {
  if (path.length < 2) return []

  const points = path.map((nodeIndex) => graph.nodes[nodeIndex])
  const segmentLengths = points.slice(1).map((point, index) => {
    const previous = points[index]
    return Math.hypot(point.x - previous.x, point.y - previous.y)
  })
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0)
  let remainingLength = totalLength * progress
  const positions: Array<[number, number]> = [nodePosition(points[0])]

  for (let index = 1; index < points.length; index += 1) {
    if (remainingLength <= 0) break

    const source = points[index - 1]
    const target = points[index]
    const segmentLength = segmentLengths[index - 1]
    const partial = segmentLength === 0 ? 1 : clamp(remainingLength / segmentLength, 0, 1)
    positions.push([
      lerp(source.lon, target.lon, partial),
      lerp(source.lat, target.lat, partial),
    ])
    remainingLength -= segmentLength
  }

  return positions
}

function pathSegments(positions: Array<[number, number]>) {
  const segments: Array<{ source: [number, number]; target: [number, number] }> = []
  for (let index = 1; index < positions.length; index += 1) {
    segments.push({ source: positions[index - 1], target: positions[index] })
  }
  return segments
}

function clampViewState(graph: RuntimeGraph, viewState: DeckViewState, baseZoom: number): DeckViewState {
  void graph
  return {
    bearing: 0,
    latitude: clamp(viewState.latitude, PAN_BOUNDS.south, PAN_BOUNDS.north),
    longitude: clamp(viewState.longitude, PAN_BOUNDS.west, PAN_BOUNDS.east),
    pitch: 0,
    zoom: clamp(viewState.zoom, zoomFromPercent(MIN_ZOOM_PERCENT, baseZoom), MAX_ZOOM),
  }
}

function normalizeDeckViewState(viewState: Record<string, unknown>): DeckViewState {
  return {
    bearing: 0,
    latitude: Number(viewState.latitude ?? INITIAL_VIEW_STATES.desktop.latitude),
    longitude: Number(viewState.longitude ?? INITIAL_VIEW_STATES.desktop.longitude),
    pitch: 0,
    zoom: Number(viewState.zoom ?? INITIAL_VIEW_STATES.desktop.zoom),
  }
}

function isSameViewState(a: DeckViewState, b: DeckViewState) {
  return (
    Math.abs(a.latitude - b.latitude) < 0.000001 &&
    Math.abs(a.longitude - b.longitude) < 0.000001 &&
    Math.abs(a.zoom - b.zoom) < 0.000001 &&
    a.bearing === b.bearing &&
    a.pitch === b.pitch
  )
}

function lonLatToWebMercator(lon: number, lat: number) {
  const radius = 6_378_137
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const lambda = (lon * Math.PI) / 180
  const phi = (clampedLat * Math.PI) / 180

  return {
    x: radius * lambda,
    y: radius * Math.log(Math.tan(Math.PI / 4 + phi / 2)),
  }
}

function lerp(a: number, b: number, progress: number) {
  return a + (b - a) * progress
}

function getInitialViewState() {
  return { ...INITIAL_VIEW_STATES[getInitialViewportProfile()] }
}

function zoomFromPercent(percent: number, baseZoom: number) {
  return baseZoom + Math.log2(percent / 100)
}

function zoomToPercent(zoom: number, baseZoom: number) {
  return 2 ** (zoom - baseZoom) * 100
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function loadTileImage(url: string, signal?: AbortSignal) {
  return new Promise<HTMLImageElement | null>((resolve, reject) => {
    if (signal?.aborted) {
      resolve(null)
      return
    }

    const image = new Image()
    image.crossOrigin = "anonymous"

    const abort = () => {
      image.onload = null
      image.onerror = null
      image.src = ""
      resolve(null)
    }

    image.onload = () => {
      signal?.removeEventListener("abort", abort)
      resolve(image)
    }
    image.onerror = () => {
      signal?.removeEventListener("abort", abort)
      reject(new Error(`Unable to load map tile: ${url}`))
    }
    signal?.addEventListener("abort", abort, { once: true })
    image.src = url
  })
}
