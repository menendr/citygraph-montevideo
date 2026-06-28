import { create } from "zustand"
import type { AlgorithmId, RuntimeGraph, SearchResult } from "../types/graph"

type DragTarget = "start" | "end" | null

type CityGraphState = {
  algorithm: AlgorithmId
  graph: RuntimeGraph | null
  startNode: number | null
  endNode: number | null
  result: SearchResult | null
  animationKey: number
  dragTarget: DragTarget
  setAlgorithm: (algorithm: AlgorithmId) => void
  setGraph: (graph: RuntimeGraph, startNode: number, endNode: number) => void
  setEndpoints: (endpoints: { startNode?: number; endNode?: number }) => void
  setResult: (result: SearchResult | null) => void
  restartAnimation: () => void
  setDragTarget: (target: DragTarget) => void
}

export const useCityGraphStore = create<CityGraphState>((set) => ({
  algorithm: "dijkstra",
  graph: null,
  startNode: null,
  endNode: null,
  result: null,
  animationKey: 0,
  dragTarget: null,
  setAlgorithm: (algorithm) =>
    set((state) => ({ algorithm, animationKey: state.animationKey + 1 })),
  setGraph: (graph, startNode, endNode) =>
    set((state) => ({
      graph,
      startNode,
      endNode,
      result: null,
      animationKey: state.animationKey + 1,
    })),
  setEndpoints: (endpoints) =>
    set((state) => ({
      startNode: endpoints.startNode ?? state.startNode,
      endNode: endpoints.endNode ?? state.endNode,
      animationKey: state.dragTarget ? state.animationKey : state.animationKey + 1,
    })),
  setResult: (result) => set({ result }),
  restartAnimation: () => set((state) => ({ animationKey: state.animationKey + 1 })),
  setDragTarget: (dragTarget) => set({ dragTarget }),
}))
