import { type LockProvider, type Lock } from '../lock'
import { AsyncLocalStorage } from 'async_hooks'

export class InMemoryLockProvider implements LockProvider {
  readonly #locks = new Set<string>()
  readonly wasLocked = new AsyncLocalStorage<boolean>()

  #key (req: any): string {
    return JSON.stringify(req)
  }

  async lock (req: any): Promise<Lock>
  async lock (req: any, tryOnce: true): Promise<Lock | undefined>

  async lock (req: any, tryOnce: boolean = false): Promise<Lock | undefined> {
    const key = this.#key(req)
    while (this.#locks.has(key)) {
      if (tryOnce) {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    this.#locks.add(key)
    return {
      unlock: async () => {
        this.#locks.delete(key)
      },
    }
  }
}
