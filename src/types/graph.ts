export type AlgorithmId =
  | "dijkstra"
  | "bidirectionalDijkstra"
  | "astar"
  | "bidirectionalAstar"
  | "landmarkAstar"

export type SerializedCityGraph = {
  name: string
  source: string
  attribution: string
  bounds: {
    minLon: number
    minLat: number
    maxLon: number
    maxLat: number
  }
  nodes: Array<[id: string, lon: number, lat: number]>
  edges: Array<[source: number, target: number, meters: number]>
}

export type GraphNode = {
  index: number
  id: string
  lon: number
  lat: number
  x: number
  y: number
}

export type GraphEdge = {
  source: number
  target: number
  meters: number
  key: string
}

export type Neighbor = {
  node: number
  meters: number
  edgeKey: string
}

export type RuntimeGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  adjacency: Neighbor[][]
}

export type SearchStep = {
  node: number
  from: number | null
  edgeKey: string | null
}

export type SearchResult = {
  visited: SearchStep[]
  path: number[]
  distanceMeters: number
  exploredNodes: number
  found: boolean
}
