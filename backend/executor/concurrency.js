const config = require("../config")
const ExecutionError = require("./ExecutionError")

/**
 * Bounds how many executions run at once.
 *
 * The per-IP rate limit stops a client sending too many requests; it does not
 * stop those requests being expensive at the same time. Thirty allowed requests
 * a minute can still be thirty concurrent containers, each holding
 * SANDBOX_MEMORY and SANDBOX_CPUS. This gate is what makes peak resource use a
 * function of `max` rather than of arrival rate.
 *
 * Requests past `max` wait in a queue. Past `maxQueue` they are refused at once
 * rather than accumulating behind a queue that cannot drain in time.
 */
class ExecutionGate {
  constructor({ max, maxQueue, queueTimeoutMs }) {
    this.max = max
    this.maxQueue = maxQueue
    this.queueTimeoutMs = queueTimeoutMs
    this.active = 0
    this.queue = []
  }

  get stats() {
    return { active: this.active, queued: this.queue.length, max: this.max }
  }

  acquire() {
    if (this.active < this.max) {
      this.active += 1
      return Promise.resolve(() => this.#release())
    }

    if (this.queue.length >= this.maxQueue) {
      return Promise.reject(
        new ExecutionError(
          "The server is at capacity. Please try again in a moment.",
          { stage: "capacity" }
        )
      )
    }

    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: null }

      waiter.timer = setTimeout(() => {
        // Drop this waiter and answer, rather than leaving the client hanging.
        const index = this.queue.indexOf(waiter)
        if (index !== -1) this.queue.splice(index, 1)
        reject(
          new ExecutionError(
            "Timed out waiting for a free execution slot. Please try again.",
            { stage: "capacity", timedOut: true }
          )
        )
      }, this.queueTimeoutMs)

      this.queue.push(waiter)
    })
  }

  #release() {
    const waiter = this.queue.shift()
    if (!waiter) {
      this.active -= 1
      return
    }
    // Hand the slot straight to the next in line; `active` does not change.
    clearTimeout(waiter.timer)
    waiter.resolve(() => this.#release())
  }
}

module.exports = {
  ExecutionGate,
  gate: new ExecutionGate(config.concurrency),
}
