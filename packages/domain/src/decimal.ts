import { DomainError } from "./errors.js";

const DECIMAL_TEXT = /^(\d+)(?:\.(\d+))?$/;

/**
 * Parses a non-negative decimal text into an exact integer with `decimals` implied places.
 * Example: parseDecimalScaled("0.27", 6) is 270000n (micro-dollars).
 * It never uses floating point, and it never rounds: more places than `decimals` is an error.
 */
export function parseDecimalScaled(text: string, decimals: number): bigint {
  const match = DECIMAL_TEXT.exec(text.trim());
  if (match === null) {
    throw new DomainError("INVALID_DECIMAL", `"${text}" is not a non-negative decimal number.`);
  }
  const whole = match[1] ?? "0";
  const fractionPart = match[2] ?? "";
  if (fractionPart.length > decimals) {
    throw new DomainError(
      "TOO_MANY_DECIMALS",
      `"${text}" has ${fractionPart.length} decimal places, but at most ${decimals} are allowed.`,
    );
  }
  const scale = 10n ** BigInt(decimals);
  const fractionValue = fractionPart === "" ? 0n : BigInt(fractionPart.padEnd(decimals, "0"));
  return BigInt(whole) * scale + fractionValue;
}
