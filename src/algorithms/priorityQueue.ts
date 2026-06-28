export type QueueItem = {
  node: number
  priority: number
}

export class PriorityQueue {
  private readonly heap: QueueItem[] = []

  get size() {
    return this.heap.length
  }

  push(node: number, priority: number) {
    this.heap.push({ node, priority })
    this.bubbleUp(this.heap.length - 1)
  }

  pop() {
    if (this.heap.length === 0) return null
    const first = this.heap[0]
    const last = this.heap.pop()
    if (last && this.heap.length > 0) {
      this.heap[0] = last
      this.sinkDown(0)
    }
    return first
  }

  peek() {
    return this.heap[0] ?? null
  }

  private bubbleUp(index: number) {
    let child = index
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2)
      if (this.heap[parent].priority <= this.heap[child].priority) break
      this.swap(parent, child)
      child = parent
    }
  }

  private sinkDown(index: number) {
    let parent = index

    while (true) {
      const left = parent * 2 + 1
      const right = parent * 2 + 2
      let smallest = parent

      if (
        left < this.heap.length &&
        this.heap[left].priority < this.heap[smallest].priority
      ) {
        smallest = left
      }

      if (
        right < this.heap.length &&
        this.heap[right].priority < this.heap[smallest].priority
      ) {
        smallest = right
      }

      if (smallest === parent) break
      this.swap(parent, smallest)
      parent = smallest
    }
  }

  private swap(a: number, b: number) {
    const next = this.heap[a]
    this.heap[a] = this.heap[b]
    this.heap[b] = next
  }
}
