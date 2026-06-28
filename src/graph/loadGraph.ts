import { createDevelopmentGraph } from "../data/developmentGraph"
import { buildRuntimeGraph } from "./buildGraph"
import type { RuntimeGraph, SerializedCityGraph } from "../types/graph"

export async function loadGraph(): Promise<RuntimeGraph> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/montevideo-driving.json`)
    if (!response.ok) throw new Error(`Graph response ${response.status}`)
    const serialized = (await response.json()) as SerializedCityGraph
    return buildRuntimeGraph(serialized)
  } catch {
    return buildRuntimeGraph(createDevelopmentGraph())
  }
}
