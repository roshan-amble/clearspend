import { DomainError } from "./errors.js";

/**
 * An exact rational number. D11 requires exact arithmetic: no floating point anywhere
 * in a cost calculation. The denominator is always positive, and the fraction is always reduced.
 */
export interface Fraction {
  readonly num: bigint;
  readonly den: bigint;
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = abs(a);
  let y = abs(b);
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

export function frac(num: bigint, den: bigint = 1n): Fraction {
  if (den === 0n) {
    throw new DomainError("ZERO_DENOMINATOR", "A fraction cannot have a zero denominator.");
  }
  const sign = den < 0n ? -1n : 1n;
  const divisor = gcd(num, den);
  return { num: (sign * num) / divisor, den: (sign * den) / divisor };
}

/** Converts a JavaScript number that must be a safe integer, for example a quantity or an amount in cents. */
export function fromSafeInteger(value: number, label: string): Fraction {
  if (!Number.isSafeInteger(value)) {
    throw new DomainError("NOT_SAFE_INTEGER", `${label} must be a safe integer, but it is ${value}.`);
  }
  return frac(BigInt(value));
}

export const ZERO: Fraction = frac(0n);

export function add(a: Fraction, b: Fraction): Fraction {
  return frac(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function sub(a: Fraction, b: Fraction): Fraction {
  return frac(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function mul(a: Fraction, b: Fraction): Fraction {
  return frac(a.num * b.num, a.den * b.den);
}

export function div(a: Fraction, b: Fraction): Fraction {
  if (b.num === 0n) {
    throw new DomainError("DIVISION_BY_ZERO", "Cannot divide by zero.");
  }
  return frac(a.num * b.den, a.den * b.num);
}

export function sum(values: readonly Fraction[]): Fraction {
  return values.reduce(add, ZERO);
}

/** Returns -1, 0, or 1. */
export function compare(a: Fraction, b: Fraction): -1 | 0 | 1 {
  const left = a.num * b.den;
  const right = b.num * a.den;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function equals(a: Fraction, b: Fraction): boolean {
  return a.num === b.num && a.den === b.den;
}

export function min(a: Fraction, b: Fraction): Fraction {
  return compare(a, b) <= 0 ? a : b;
}

export function max(a: Fraction, b: Fraction): Fraction {
  return compare(a, b) >= 0 ? a : b;
}

/** Rounds to the nearest integer. A value exactly halfway goes to the even neighbour. */
export function roundHalfEven(value: Fraction): bigint {
  let quotient = value.num / value.den;
  let remainder = value.num - quotient * value.den;
  if (remainder < 0n) {
    quotient -= 1n;
    remainder += value.den;
  }
  const twice = 2n * remainder;
  if (twice < value.den) return quotient;
  if (twice > value.den) return quotient + 1n;
  return quotient % 2n === 0n ? quotient : quotient + 1n;
}

/**
 * Formats a value with a fixed number of decimals, rounded half-even.
 * D11: rounding happens only here, at display.
 */
export function formatFixed(value: Fraction, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const scaled = roundHalfEven(mul(value, frac(scale)));
  const negative = scaled < 0n;
  const magnitude = negative ? -scaled : scaled;
  const whole = magnitude / scale;
  const fractionPart = (magnitude % scale).toString().padStart(decimals, "0");
  const text = decimals === 0 ? whole.toString() : `${whole}.${fractionPart}`;
  return negative ? `-${text}` : text;
}

/** Exact text "numerator/denominator" for storage (D3: never a floating-point double). Example: "11/2000". */
export function exactText(value: Fraction): string {
  return `${value.num}/${value.den}`;
}

/** Reads text written by `exactText`. */
export function parseExactText(text: string): Fraction {
  const match = /^(-?\d+)\/(\d+)$/.exec(text);
  if (match === null) {
    throw new DomainError("INVALID_EXACT_TEXT", `"${text}" is not an exact fraction like 11/2000.`);
  }
  return frac(BigInt(match[1] as string), BigInt(match[2] as string));
}
