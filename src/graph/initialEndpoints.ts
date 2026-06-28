import type { RuntimeGraph } from "../types/graph"
import type { CityGraphViewportProfile } from "./initialViewport"

const INITIAL_ENDPOINT_COORDINATES: Record<CityGraphViewportProfile, {
  end: { lat: number; lon: number }
  start: { lat: number; lon: number }
}> = {
  desktop: {
    start: { lon: -56.3, lat: -34.895 },
    end: { lon: -56.055, lat: -34.885 },
  },
  mobile: {
    start: { lon: -56.19, lat: -34.855 },
    end: { lon: -56.145, lat: -34.899 },
  },
}

export function chooseInitialEndpoints(
  graph: RuntimeGraph,
  profile: CityGraphViewportProfile = "desktop",
) {
  const coordinates = INITIAL_ENDPOINT_COORDINATES[profile]
  const startNode = nearestLonLatPosition(graph, coordinates.start.lon, coordinates.start.lat)
  const endNode = nearestLonLatPosition(graph, coordinates.end.lon, coordinates.end.lat)

  return startNode === endNode
    ? { startNode, endNode: graph.nodes.at(-1)?.index ?? startNode }
    : { startNode, endNode }
}

function nearestLonLatPosition(graph: RuntimeGraph, lon: number, lat: number) {
  let nearest = graph.nodes[0]?.index ?? 0
  let best = Number.POSITIVE_INFINITY
  const longitudeScale = Math.cos((lat * Math.PI) / 180)

  for (const node of graph.nodes) {
    const distance = Math.hypot((node.lon - lon) * longitudeScale, node.lat - lat)
    if (distance < best) {
      nearest = node.index
      best = distance
    }
  }

  return nearest
}
