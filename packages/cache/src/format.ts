/**
 * Allows to implement different formats to store cache in
 */
export interface Format<I, O> {
  /**
   * Convert value to Buffer
   */
  serialize(value: I): Buffer

  /**
   * Convert Buffer to value
   */
  deserialize(value: Buffer): O
}
