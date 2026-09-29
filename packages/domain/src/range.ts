import { add, compare, equals, frac, max, min, mul, sub, type Fraction } from "./fraction.js";

/** An exact interval. While a cause is unconfirmed, a cost is a range, never a single guess (C5). */
export interface Range {
  readonly low: Fraction;
  readonly high: Fraction;
}

export function point(value: Fraction): Range {
  return { low: value, high: value };
}

export function between(a: Fraction, b: Fraction): Range {
  return { low: min(a, b), high: max(a, b) };
}

export function addRange(a: Range, b: Range): Range {
  return { low: add(a.low, b.low), high: add(a.high, b.high) };
}

/** Subtracts a lower bound range, for example "supplier minus nominal". The result keeps low ≤ high. */
export function subRange(a: Range, b: Range): Range {
  return between(sub(a.low, b.low), sub(a.high, b.high));
}

export function scaleRange(range: Range, factor: Fraction): Range {
  if (factor.num < 0n) {
    throw new RangeError("A range can only be scaled by a non-negative factor.");
  }
  return { low: mul(range.low, factor), high: mul(range.high, factor) };
}

export function isPoint(range: Range): boolean {
  return equals(range.low, range.high);
}

export function rangeEquals(a: Range, b: Range): boolean {
  return equals(a.low, b.low) && equals(a.high, b.high);
}

export const ZERO_RANGE: Range = point(frac(0n));

export function assertOrdered(range: Range): Range {
  if (compare(range.low, range.high) > 0) {
    throw new RangeError("A range must have low ≤ high.");
  }
  return range;
}
