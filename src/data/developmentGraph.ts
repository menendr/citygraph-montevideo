import type { SerializedCityGraph } from "../types/graph"

const MONTEVIDEO_BOUNDS = {
  minLon: -56.285,
  minLat: -34.935,
  maxLon: -56.055,
  maxLat: -34.79,
}

export function createDevelopmentGraph(): SerializedCityGraph {
  const nodes: SerializedCityGraph["nodes"] = []
  const edges: SerializedCityGraph["edges"] = []
  const columns = 32
  const rows = 22
  const indexByGrid = new Map<string, number>()

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const coastCurve = Math.sin(column / 5.2) * 1.2 + Math.cos(column / 2.8) * 0.4
      if (row > rows - 4 + coastCurve && column > 3 && column < columns - 2) continue
      if (row < 2 && column < 4) continue
      if (row < 4 && column > columns - 6) continue

      const jitterLon = Math.sin(row * 1.7 + column * 0.9) * 0.0011
      const jitterLat = Math.cos(row * 1.1 - column * 0.7) * 0.0008
      const lon =
        MONTEVIDEO_BOUNDS.minLon +
        (column / (columns - 1)) * (MONTEVIDEO_BOUNDS.maxLon - MONTEVIDEO_BOUNDS.minLon) +
        jitterLon
      const lat =
        MONTEVIDEO_BOUNDS.minLat +
        (row / (rows - 1)) * (MONTEVIDEO_BOUNDS.maxLat - MONTEVIDEO_BOUNDS.minLat) +
        jitterLat

      const index = nodes.length
      indexByGrid.set(`${column}:${row}`, index)
      nodes.push([`dev-${column}-${row}`, lon, lat])
    }
  }

  const addEdge = (aKey: string, bKey: string, multiplier = 1) => {
    const source = indexByGrid.get(aKey)
    const target = indexByGrid.get(bKey)
    if (source === undefined || target === undefined) return
    const [, aLon, aLat] = nodes[source]
    const [, bLon, bLat] = nodes[target]
    const meters = Math.hypot((aLon - bLon) * 91_000, (aLat - bLat) * 111_000) * multiplier
    edges.push([source, target, Math.round(meters)])
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const key = `${column}:${row}`
      if (!indexByGrid.has(key)) continue

      addEdge(key, `${column + 1}:${row}`)
      addEdge(key, `${column}:${row + 1}`)

      if ((row + column) % 6 === 0) addEdge(key, `${column + 1}:${row + 1}`, 1.16)
      if (row % 7 === 0 && column < columns - 2) addEdge(key, `${column + 2}:${row}`, 1.05)
      if (column % 9 === 0 && row < rows - 3) addEdge(key, `${column}:${row + 2}`, 1.08)
    }
  }

  return {
    name: "CityGraph: Montevideo",
    source: "Generated development graph",
    attribution: "Development graph. Generate the OSM extract for production street data.",
    bounds: MONTEVIDEO_BOUNDS,
    nodes,
    edges,
  }
}
