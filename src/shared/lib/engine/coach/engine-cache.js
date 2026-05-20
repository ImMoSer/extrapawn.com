/**
 * LRU Cache utility class.
 * Used to store and manage a fixed-size cache of engine calculations
 * (evaluations, multipv results, and best moves) using the Least Recently Used strategy.
 */
export class LRU {
  constructor(maxSize) {
    this.maxSize = maxSize
    this.map = new Map()
  }

  get(key) {
    if (!this.map.has(key)) return undefined
    const v = this.map.get(key)
    this.map.delete(key)
    this.map.set(key, v)
    return v
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.maxSize) {
      this.map.delete(this.map.keys().next().value)
    }
  }

  delete(key) {
    this.map.delete(key)
  }

  clear() {
    this.map.clear()
  }
}
