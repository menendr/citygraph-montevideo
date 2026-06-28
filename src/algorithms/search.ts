import { PriorityQueue, type QueueItem } from "./priorityQueue"
import { edgeKey } from "../graph/buildGraph"
import type {
  AlgorithmId,
  RuntimeGraph,
  SearchResult,
  SearchStep,
} from "../types/graph"

type LandmarkIndex = {
  distances: Float64Array[]
}

type SearchHeuristic = (node: number, goal: number) => number

const landmarkCache = new WeakMap<RuntimeGraph, LandmarkIndex>()
const EARTH_RADIUS_METERS = 6_371_000
const PRIORITY_EPSILON = 1e-7

export function runSearch(
  graph: RuntimeGraph,
  algorithm: AlgorithmId,
  start: number,
  goal: number,
): SearchResult {
  if (algorithm === "dijkstra") {
    return finishResult(graph, start, goal, weightedSearch(graph, start, goal))
  }

  if (algorithm === "bidirectionalDijkstra") {
    return finishResult(
      graph,
      start,
      goal,
      bidirectionalDijkstraSearch(graph, start, goal),
    )
  }

  if (algorithm === "astar") {
    return finishResult(
      graph,
      start,
      goal,
      weightedSearch(graph, start, goal, (node, target) => heuristic(graph, node, target)),
    )
  }

  if (algorithm === "bidirectionalAstar") {
    return finishResult(
      graph,
      start,
      goal,
      bidirectionalAstarSearch(graph, start, goal),
    )
  }

  const landmarks = getLandmarkIndex(graph)
  return finishResult(
    graph,
    start,
    goal,
    weightedSearch(graph, start, goal, (node, target) =>
      landmarkHeuristic(landmarks, node, target),
    ),
  )
}

function weightedSearch(
  graph: RuntimeGraph,
  start: number,
  goal: number,
  searchHeuristic: SearchHeuristic = () => 0,
) {
  const visited: SearchStep[] = []
  const settled = new Set<number>()
  const parent = new Map<number, number>()
  const best = new Map<number, number>([[start, 0]])
  const queue = new PriorityQueue()

  queue.push(start, 0)

  while (queue.size > 0) {
    const item = queue.pop()
    if (!item || settled.has(item.node)) continue

    const cost = best.get(item.node) ?? Number.POSITIVE_INFINITY
    settled.add(item.node)
    visited.push({
      node: item.node,
      from: parent.get(item.node) ?? null,
      edgeKey:
        item.node === start
          ? null
          : edgeKey(item.node, parent.get(item.node) ?? item.node),
    })

    if (item.node === goal) break

    for (const neighbor of graph.adjacency[item.node] ?? []) {
      const nextCost = cost + neighbor.meters
      if (nextCost >= (best.get(neighbor.node) ?? Number.POSITIVE_INFINITY)) continue

      parent.set(neighbor.node, item.node)
      best.set(neighbor.node, nextCost)
      queue.push(
        neighbor.node,
        nextCost + searchHeuristic(neighbor.node, goal),
      )
    }
  }

  return { visited, parent, distanceMeters: best.get(goal) ?? Number.POSITIVE_INFINITY }
}

function bidirectionalDijkstraSearch(graph: RuntimeGraph, start: number, goal: number) {
  if (start === goal) {
    return {
      visited: [{ node: start, from: null, edgeKey: null }],
      parent: new Map<number, number>(),
      path: [start],
      distanceMeters: 0,
    }
  }

  const visited: SearchStep[] = []
  const parentForward = new Map<number, number>()
  const parentBackward = new Map<number, number>()
  const bestForward = new Map<number, number>([[start, 0]])
  const bestBackward = new Map<number, number>([[goal, 0]])
  const settledForward = new Set<number>()
  const settledBackward = new Set<number>()
  const forwardQueue = new PriorityQueue()
  const backwardQueue = new PriorityQueue()
  let meetingNode: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  forwardQueue.push(start, 0)
  backwardQueue.push(goal, 0)

  const updateBestPath = (node: number, distance: number) => {
    if (distance >= bestDistance) return
    bestDistance = distance
    meetingNode = node
  }

  const expandFront = (direction: "forward" | "backward") => {
    const queue = direction === "forward" ? forwardQueue : backwardQueue
    const settled = direction === "forward" ? settledForward : settledBackward
    const parent = direction === "forward" ? parentForward : parentBackward
    const best = direction === "forward" ? bestForward : bestBackward
    const otherBest = direction === "forward" ? bestBackward : bestForward
    const origin = direction === "forward" ? start : goal
    const item = queue.pop()

    if (!item || settled.has(item.node)) return

    const cost = best.get(item.node) ?? Number.POSITIVE_INFINITY
    if (item.priority > cost) return

    settled.add(item.node)
    visited.push({
      node: item.node,
      from: parent.get(item.node) ?? null,
      edgeKey:
        item.node === origin
          ? null
          : edgeKey(item.node, parent.get(item.node) ?? item.node),
    })

    const oppositeCost = otherBest.get(item.node)
    if (oppositeCost !== undefined) updateBestPath(item.node, cost + oppositeCost)

    for (const neighbor of graph.adjacency[item.node] ?? []) {
      if (settled.has(neighbor.node)) continue

      const nextCost = cost + neighbor.meters
      if (nextCost < (best.get(neighbor.node) ?? Number.POSITIVE_INFINITY)) {
        parent.set(neighbor.node, item.node)
        best.set(neighbor.node, nextCost)
        queue.push(neighbor.node, nextCost)
      }

      const oppositeNeighborCost = otherBest.get(neighbor.node)
      if (oppositeNeighborCost !== undefined) {
        updateBestPath(neighbor.node, nextCost + oppositeNeighborCost)
      }
    }
  }

  while (forwardQueue.size > 0 && backwardQueue.size > 0) {
    const forwardNext = nextUnsettled(forwardQueue, settledForward)
    const backwardNext = nextUnsettled(backwardQueue, settledBackward)
    if (!forwardNext || !backwardNext) break
    if (forwardNext.priority + backwardNext.priority >= bestDistance) break

    expandFront(forwardNext.priority <= backwardNext.priority ? "forward" : "backward")
  }

  const path =
    meetingNode === null
      ? []
      : reconstructBidirectionalPath(parentForward, parentBackward, start, goal, meetingNode)

  return {
    visited,
    parent: parentForward,
    path,
    distanceMeters: Number.isFinite(bestDistance) ? bestDistance : Number.POSITIVE_INFINITY,
  }
}

function bidirectionalAstarSearch(graph: RuntimeGraph, start: number, goal: number) {
  if (start === goal) {
    return {
      visited: [{ node: start, from: null, edgeKey: null }],
      parent: new Map<number, number>(),
      path: [start],
      distanceMeters: 0,
    }
  }

  const potential = balancedAstarPotential(graph, start, goal)
  const priorityForward = (node: number, cost: number) => cost + potential[node]
  const priorityBackward = (node: number, cost: number) => cost - potential[node]

  const visited: SearchStep[] = []
  const parentForward = new Map<number, number>()
  const parentBackward = new Map<number, number>()
  const bestForward = new Map<number, number>([[start, 0]])
  const bestBackward = new Map<number, number>([[goal, 0]])
  const settledForward = new Set<number>()
  const settledBackward = new Set<number>()
  const forwardQueue = new PriorityQueue()
  const backwardQueue = new PriorityQueue()
  let meetingNode: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  forwardQueue.push(start, priorityForward(start, 0))
  backwardQueue.push(goal, priorityBackward(goal, 0))

  const updateBestPath = (node: number, distance: number) => {
    if (distance >= bestDistance) return
    bestDistance = distance
    meetingNode = node
  }

  const expandFront = (direction: "forward" | "backward") => {
    const queue = direction === "forward" ? forwardQueue : backwardQueue
    const settled = direction === "forward" ? settledForward : settledBackward
    const parent = direction === "forward" ? parentForward : parentBackward
    const best = direction === "forward" ? bestForward : bestBackward
    const otherBest = direction === "forward" ? bestBackward : bestForward
    const priority = direction === "forward" ? priorityForward : priorityBackward
    const origin = direction === "forward" ? start : goal
    const item = queue.pop()

    if (!item || settled.has(item.node)) return

    const cost = best.get(item.node) ?? Number.POSITIVE_INFINITY
    if (item.priority > priority(item.node, cost) + PRIORITY_EPSILON) return

    settled.add(item.node)
    visited.push({
      node: item.node,
      from: parent.get(item.node) ?? null,
      edgeKey:
        item.node === origin
          ? null
          : edgeKey(item.node, parent.get(item.node) ?? item.node),
    })

    const oppositeCost = otherBest.get(item.node)
    if (oppositeCost !== undefined) updateBestPath(item.node, cost + oppositeCost)

    for (const neighbor of graph.adjacency[item.node] ?? []) {
      if (settled.has(neighbor.node)) continue

      const nextCost = cost + neighbor.meters
      if (nextCost < (best.get(neighbor.node) ?? Number.POSITIVE_INFINITY)) {
        parent.set(neighbor.node, item.node)
        best.set(neighbor.node, nextCost)
        queue.push(neighbor.node, priority(neighbor.node, nextCost))
      }

      const oppositeNeighborCost = otherBest.get(neighbor.node)
      if (oppositeNeighborCost !== undefined) {
        updateBestPath(neighbor.node, nextCost + oppositeNeighborCost)
      }
    }
  }

  while (forwardQueue.size > 0 && backwardQueue.size > 0) {
    const forwardNext = nextUnsettled(forwardQueue, settledForward)
    const backwardNext = nextUnsettled(backwardQueue, settledBackward)
    if (!forwardNext || !backwardNext) break
    if (forwardNext.priority + backwardNext.priority >= bestDistance) break

    expandFront(forwardNext.priority <= backwardNext.priority ? "forward" : "backward")
  }

  const path =
    meetingNode === null
      ? []
      : reconstructBidirectionalPath(parentForward, parentBackward, start, goal, meetingNode)

  return {
    visited,
    parent: parentForward,
    path,
    distanceMeters: Number.isFinite(bestDistance) ? bestDistance : Number.POSITIVE_INFINITY,
  }
}

function finishResult(
  graph: RuntimeGraph,
  start: number,
  goal: number,
  partial: {
    visited: SearchStep[]
    parent: Map<number, number>
    path?: number[]
    distanceMeters: number
  },
): SearchResult {
  const path = partial.path ?? reconstructPath(partial.parent, start, goal)

  return {
    visited: partial.visited,
    path,
    distanceMeters: Number.isFinite(partial.distanceMeters)
      ? partial.distanceMeters
      : pathDistance(graph, partial.parent, start, goal),
    exploredNodes: partial.visited.length,
    found: path.length > 0,
  }
}

function reconstructBidirectionalPath(
  parentForward: Map<number, number>,
  parentBackward: Map<number, number>,
  start: number,
  goal: number,
  meetingNode: number,
) {
  const forwardPath = [meetingNode]
  let current = meetingNode

  while (current !== start) {
    const next = parentForward.get(current)
    if (next === undefined) return []
    current = next
    forwardPath.push(current)
  }

  forwardPath.reverse()
  current = meetingNode

  while (current !== goal) {
    const next = parentBackward.get(current)
    if (next === undefined) return []
    current = next
    forwardPath.push(current)
  }

  return forwardPath
}

function reconstructPath(parent: Map<number, number>, start: number, goal: number) {
  if (start === goal) return [start]
  if (!parent.has(goal)) return []

  const path = [goal]
  let current = goal

  while (current !== start) {
    const next = parent.get(current)
    if (next === undefined) return []
    current = next
    path.push(current)
  }

  return path.reverse()
}

function nextUnsettled(queue: PriorityQueue, settled: Set<number>): QueueItem | null {
  while (queue.size > 0 && settled.has(queue.peek()?.node ?? -1)) {
    queue.pop()
  }

  return queue.peek()
}

function pathDistance(graph: RuntimeGraph, parent: Map<number, number>, start: number, goal: number) {
  const path = reconstructPath(parent, start, goal)
  return pathDistanceFromNodes(graph, path)
}

function pathDistanceFromNodes(graph: RuntimeGraph, path: number[]) {
  if (path.length === 0) return Number.POSITIVE_INFINITY

  let total = 0
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1]
    const current = path[index]
    const edge = graph.adjacency[previous]?.find((neighbor) => neighbor.node === current)
    total += edge?.meters ?? 0
  }

  return total
}

function heuristic(graph: RuntimeGraph, source: number, target: number) {
  const a = graph.nodes[source]
  const b = graph.nodes[target]
  return distanceMeters(a.lon, a.lat, b.lon, b.lat)
}

function balancedAstarPotential(graph: RuntimeGraph, start: number, goal: number) {
  const potential = new Float64Array(graph.nodes.length)
  for (const node of graph.nodes) {
    potential[node.index] = (heuristic(graph, node.index, goal) - heuristic(graph, start, node.index)) / 2
  }
  return potential
}

function getLandmarkIndex(graph: RuntimeGraph) {
  const cached = landmarkCache.get(graph)
  if (cached) return cached

  const landmarks = chooseLandmarks(graph)
  const distances = landmarks.map((landmark) => shortestDistancesFrom(graph, landmark))
  const index = { distances }
  landmarkCache.set(graph, index)
  return index
}

function chooseLandmarks(graph: RuntimeGraph) {
  const landmarks: number[] = []
  const addLandmark = (nodeIndex: number) => {
    if (!landmarks.includes(nodeIndex)) landmarks.push(nodeIndex)
  }

  let west = graph.nodes[0]?.index ?? 0
  let east = west
  let south = west
  let north = west
  let meanLon = 0
  let meanLat = 0

  for (const node of graph.nodes) {
    meanLon += node.lon
    meanLat += node.lat
    if (node.lon < graph.nodes[west].lon) west = node.index
    if (node.lon > graph.nodes[east].lon) east = node.index
    if (node.lat < graph.nodes[south].lat) south = node.index
    if (node.lat > graph.nodes[north].lat) north = node.index
  }

  addLandmark(west)
  addLandmark(east)
  addLandmark(south)
  addLandmark(north)

  meanLon /= Math.max(1, graph.nodes.length)
  meanLat /= Math.max(1, graph.nodes.length)

  while (landmarks.length < Math.min(4, graph.nodes.length)) {
    let farthest = graph.nodes[0]?.index ?? 0
    let bestDistance = -1
    for (const node of graph.nodes) {
      if (landmarks.includes(node.index)) continue
      const distance = distanceMeters(node.lon, node.lat, meanLon, meanLat)
      if (distance > bestDistance) {
        bestDistance = distance
        farthest = node.index
      }
    }
    addLandmark(farthest)
  }

  return landmarks
}

function shortestDistancesFrom(graph: RuntimeGraph, source: number) {
  const distances = new Float64Array(graph.nodes.length)
  distances.fill(Number.POSITIVE_INFINITY)
  distances[source] = 0

  const queue = new PriorityQueue()
  queue.push(source, 0)

  while (queue.size > 0) {
    const item = queue.pop()
    if (!item || item.priority > distances[item.node]) continue

    for (const neighbor of graph.adjacency[item.node] ?? []) {
      const nextDistance = item.priority + neighbor.meters
      if (nextDistance >= distances[neighbor.node]) continue
      distances[neighbor.node] = nextDistance
      queue.push(neighbor.node, nextDistance)
    }
  }

  return distances
}

function landmarkHeuristic(index: LandmarkIndex, node: number, goal: number) {
  let lowerBound = 0

  for (const distances of index.distances) {
    const nodeDistance = distances[node]
    const goalDistance = distances[goal]
    if (!Number.isFinite(nodeDistance) || !Number.isFinite(goalDistance)) continue
    lowerBound = Math.max(lowerBound, Math.abs(goalDistance - nodeDistance))
  }

  return lowerBound
}

function distanceMeters(sourceLon: number, sourceLat: number, targetLon: number, targetLat: number) {
  const sourcePhi = toRadians(sourceLat)
  const targetPhi = toRadians(targetLat)
  const deltaPhi = toRadians(targetLat - sourceLat)
  const deltaLambda = toRadians(targetLon - sourceLon)
  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(sourcePhi) * Math.cos(targetPhi) * Math.sin(deltaLambda / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180
}
