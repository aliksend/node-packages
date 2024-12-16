import fs from 'fs'
import path from 'path'
import { CacheStorage } from '../storage'

export class DiskStorage implements CacheStorage {
  #dir: string

  constructor(dir: string) {
    fs.mkdirSync(dir, { recursive: true })

    this.#dir = dir
  }

  #fullFileName(key: string) {
    return path.join(this.#dir, `${key}`)
  }

  async has(key: string): Promise<boolean> {
    return fs.existsSync(this.#fullFileName(key))
  }

  async get(key: string): Promise<Buffer> {
    return await fs.promises.readFile(this.#fullFileName(key));
  }

  async set(key: string, value: Buffer): Promise<void> {
    await fs.promises.writeFile(this.#fullFileName(key), value)
  }

  async unset(key: string): Promise<void> {
    await fs.promises.rm(this.#fullFileName(key))
  }
}
