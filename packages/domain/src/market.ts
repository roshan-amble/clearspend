import { DomainError } from "./errors.js";
import { compare, div, frac, fromSafeInteger, sub, type Fraction } from "./fraction.js";

/** 1 public price row (D3 `CsMarketPrice`), in exact micro-dollars for each kilogram or litre. */
export interface MarketPrice {
  readonly market: string;
  readonly series: string;
  /** "YYYY-MM". */
  readonly month: string;
  readonly usdMicros: bigint;
}

/** C8: the declared policy threshold for the review flag, 10%. */
export const DEFAULT_PRESSURE_THRESHOLD: Fraction = frac(1n, 10n);

/** The exact median. With an even count, it is the mean of the 2 middle values. */
export function median(values: readonly bigint[]): Fraction {
  if (values.length === 0) {
    throw new DomainError("EMPTY_MEDIAN", "The median of no values is not defined.");
  }
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] as bigint;
  if (sorted.length % 2 === 1) return frac(upper);
  const lower = sorted[middle - 1] as bigint;
  return frac(lower + upper, 2n);
}

/** The median price across markets for each month of 1 series, in micro-dollars. Months are sorted. */
export function monthlyMedians(prices: readonly MarketPrice[], series: string): ReadonlyMap<string, Fraction> {
  const byMonth = new Map<string, bigint[]>();
  for (const price of prices.filter((candidate) => candidate.series === series)) {
    byMonth.set(price.month, [...(byMonth.get(price.month) ?? []), price.usdMicros]);
  }
  const months = [...byMonth.keys()].sort();
  return new Map(months.map((month) => [month, median(byMonth.get(month) ?? [])] as const));
}

/** The relative change from `first` to `last`, for example 0.14 for +14%. */
export function relativeChange(first: Fraction, last: Fraction): Fraction {
  return div(sub(last, first), first);
}

export interface MarketPressure {
  /** Planned monthly purchase ÷ the declared monthly market volume. */
  readonly share: Fraction;
  readonly flagged: boolean;
}

/** C8: an indicator, not a forecast. The volume estimate is synthetic and labelled so (D1, brief section 2). */
export function marketPressure(input: {
  readonly plannedPerMonth: number;
  readonly marketVolumeEstimatePerMonth: number;
  readonly threshold?: Fraction;
}): MarketPressure {
  const volume = fromSafeInteger(input.marketVolumeEstimatePerMonth, "marketVolumeEstimatePerMonth");
  if (volume.num <= 0n) {
    throw new DomainError("NO_MARKET_VOLUME", "The market volume estimate must be positive.");
  }
  const share = div(fromSafeInteger(input.plannedPerMonth, "plannedPerMonth"), volume);
  const threshold = input.threshold ?? DEFAULT_PRESSURE_THRESHOLD;
  return { share, flagged: compare(share, threshold) >= 0 };
}
