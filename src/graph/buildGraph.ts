import type {
  GraphEdge,
  GraphNode,
  Neighbor,
  RuntimeGraph,
  SerializedCityGraph,
} from "../types/graph"

export function edgeKey(source: number, target: number) {
  return source < target ? `${source}:${target}` : `${target}:${source}`
}

export function buildRuntimeGraph(serialized: SerializedCityGraph): RuntimeGraph {
  const nodes: GraphNode[] = serialized.nodes.map(([id, lon, lat], index) => ({
    index,
    id,
    lon,
    lat,
    ...lonLatToWebMercator(lon, lat),
  }))

  const edges: GraphEdge[] = []
  const adjacency: Neighbor[][] = Array.from({ length: nodes.length }, () => [])
  const seenEdges = new Set<string>()

  for (const [source, target, meters] of serialized.edges) {
    if (source === target) continue
    const key = edgeKey(source, target)
    if (seenEdges.has(key)) continue
    seenEdges.add(key)
    edges.push({ source, target, meters, key })
    adjacency[source]?.push({ node: target, meters, edgeKey: key })
    adjacency[target]?.push({ node: source, meters, edgeKey: key })
  }

  return {
    nodes,
    edges,
    adjacency,
  }
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
