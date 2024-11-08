/**
 * Ticker allows to specify tick source and call callback on every tick
 */
export class Ticker<Data, TeardownHandle = void> {
  readonly #start: (tick: (data: Data) => void) => TeardownHandle;
  readonly #teardown: (r: TeardownHandle) => void;

  /**
   * Combine tickers with same data
   */
  static combined<Data>(tickers: Ticker<Data, any>[]): Ticker<Data, unknown[]> {
    return new Ticker<Data, Array<unknown>>(
      tick => {
        return tickers.map(t => {
          return t.#start(data => {
            tick(data);
          });
        });
      },
      teardowns => {
        tickers.forEach((t, index) => {
          t.#teardown(teardowns[index]);
        });
      }
    );
  }

  /**
   * Create new ticker
   * @param start ticks source. Allow to subscribe to ticks. Can return TeardownHandle to unsubscribe from ticks on stop
   * @param teardown unsubscribe from ticks using TeardownHandle returned by `start`
   *
   * @example
   * ```typescript
   *     const every100ms = new Ticker((tick) => {
   *       return setInterval(tick, 100)
   *     }, (interval) => clearInterval(interval))
   * ```
   *
   * Ticker **can't** stop itself.
   * But it can tick with specific result that will show that there is no more data
   * and the consumer will stop the ticker.
   *
   * @example
   * ```typescript
   *     // ticker setup
   *     const ticker = new Ticker((tick) => {
   *       for (let i = 0; i < 5; i++) {
   *         tick(i);
   *       }
   *
   *       setTimeout(() => tick('stopme'), 1000)
   *     }, () => console.log('ticker stopped'))
   *
   *     // ticks consumer
   *     const promise = ticker.start((data) => {
   *       if (data === 'stopme') {
   *         return 'ok'
   *       }
   *
   *       console.log(data)
   *     })
   *
   *     // promise will only be resolved when consumer receives 'stopme' signal and returns something from callback
   * ```
   */
  constructor(
    start: (tick: (data: Data) => void) => TeardownHandle,
    teardown?: (r: TeardownHandle) => void
  ) {
    this.#start = start;
    this.#teardown = teardown ?? (() => {});
  }

  /**
   * Start ticker:
   * - subscribe to ticks
   * - call callback on every tick
   * - stop ticker if callback returned non-nullable value
   * - return value, returned by callback
   *
   * @example
   * ```typescript
   *     // ticker setup
   *     const ticker = new Ticker((tick) => {
   *       for (let i = 0; i < 5; i++) {
   *         tick(i);
   *       }
   *     })
   *
   *     // ticks consumer
   *     ticker.start((data) => console.log(data))
   *     // -> 0, 1, 2, 3, 4
   * ```
   *
   * In this example promise, returned by `ticker.start` will never be resolved.
   * See example in constructor to find out how to stop ticker in similar situation
   */
  async start<Result>(
    callback: (data: Data) => Result | undefined
  ): Promise<Result> {
    const result = await new Promise<Result>((resolve) => {
      const started = this.#start(data => {
        const value = callback(data);
        if (value != null) {
          resolve(value);
          this.#teardown(started);
          return;
        }
      });
    });

    return result;
  }

  /**
   * Map ticker's value:
   * - call callback on every tick with tick's data
   * - if needed callback can call `tick` with mapped data
   *
   * @example
   * ```typescript
   *     const ticker = new Ticker((tick) => {
   *       for (let i = 0; i < 10; i++) {
   *         tick(i);
   *       }
   *     }).map((i, tick) => {
   *       if (i % 2) {
   *         tick(`${i}`)
   *       }
   *     })
   *     // -> "1", "3", "5", "7", "9"
   * ```
   */
  map<Mapped>(
    callback: (data: Data, tick: (mappedData: Mapped) => void) => void
  ): Ticker<Mapped, TeardownHandle> {
    return new Ticker<Mapped, TeardownHandle>(
      tick =>
        this.#start(data => callback(data, mappedData => tick(mappedData))),
      v => this.#teardown(v)
    );
  }
}
