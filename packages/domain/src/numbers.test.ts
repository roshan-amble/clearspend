import { describe, expect, it } from "vitest";
import { parseDecimalScaled } from "./decimal.js";
import { add, compare, div, exactText, formatFixed, frac, parseExactText, roundHalfEven, sub } from "./fraction.js";

describe("Fraction", () => {
  it("reduces and keeps the denominator positive", () => {
    expect(frac(6n, -8n)).toEqual({ num: -3n, den: 4n });
    expect(frac(0n, 5n)).toEqual({ num: 0n, den: 1n });
  });

  it("does exact arithmetic where floating point fails: 0.1 + 0.2 is exactly 0.3", () => {
    expect(add(frac(1n, 10n), frac(2n, 10n))).toEqual(frac(3n, 10n));
    expect(sub(frac(1n, 3n), frac(1n, 3n))).toEqual(frac(0n));
    expect(compare(frac(1n, 3n), frac(333n, 1000n))).toBe(1);
  });

  it("rejects a zero denominator and a division by zero", () => {
    expect(() => frac(1n, 0n)).toThrowError(/zero denominator/);
    expect(() => div(frac(1n), frac(0n))).toThrowError(/divide by zero/);
  });

  it("rounds half to even, also for negative values", () => {
    expect(roundHalfEven(frac(5n, 2n))).toBe(2n);
    expect(roundHalfEven(frac(7n, 2n))).toBe(4n);
    expect(roundHalfEven(frac(-5n, 2n))).toBe(-2n);
    expect(roundHalfEven(frac(26n, 10n))).toBe(3n);
  });

  it("formats with a fixed number of decimals, rounded half-even only at display", () => {
    expect(formatFixed(frac(1045n, 100n), 1)).toBe("10.4");
    expect(formatFixed(frac(1035n, 100n), 1)).toBe("10.4");
    expect(formatFixed(frac(1025n, 100n), 1)).toBe("10.2");
    expect(formatFixed(frac(8n), 1)).toBe("8.0");
    expect(formatFixed(frac(-1n, 20n), 1)).toBe("0.0");
    expect(formatFixed(frac(-3n, 20n), 1)).toBe("-0.2");
  });
});

describe("parseDecimalScaled", () => {
  it("parses published price text into exact micro-dollars", () => {
    expect(parseDecimalScaled("0.27", 6)).toBe(270_000n);
    expect(parseDecimalScaled("12", 6)).toBe(12_000_000n);
    expect(parseDecimalScaled(" 0.654321 ", 6)).toBe(654_321n);
  });

  it("refuses to round: more decimal places than allowed is an error", () => {
    expect(() => parseDecimalScaled("0.1234567", 6)).toThrowError(/decimal places/);
  });

  it("rejects text that is not a plain non-negative decimal", () => {
    for (const text of ["", "-1", "1e3", "0x10", "1,5", "."]) {
      expect(() => parseDecimalScaled(text, 6)).toThrowError(/not a non-negative decimal/);
    }
  });
});

describe("exact text for storage", () => {
  it("writes numerator/denominator and reads back the same reduced value", () => {
    expect(exactText(frac(44n, 1000n))).toBe("11/250");
    expect(parseExactText("11/250")).toEqual(frac(11n, 250n));
    expect(() => parseExactText("0.044")).toThrowError(/not an exact fraction/);
  });
});
