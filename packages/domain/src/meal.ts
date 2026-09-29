import { DomainError } from "./errors.js";
import { fromSafeInteger } from "./fraction.js";
import { addRange, scaleRange, ZERO_RANGE, type Range } from "./range.js";
import type { BaseUnit } from "./types.js";

/** 1 ingredient of the ration (D11). The quantity is for 1 meal, in grams or millilitres. */
export interface RationItem {
  readonly commodity: string;
  readonly unit: BaseUnit;
  readonly quantityPerMeal: number;
}

/** The cost of 1 base unit of an ingredient, from 1 view: nominal, supplier, route, or quoted. */
export interface IngredientPrice {
  readonly unit: BaseUnit;
  readonly centsPerUnit: Range;
}

export interface MealCost {
  /** Cents for 1 meal. */
  readonly total: Range;
  /** D1 breakdown by ingredient: each term of the sum. */
  readonly byIngredient: readonly { readonly commodity: string; readonly cents: Range }[];
}

/**
 * D11: cost for each meal = Σ (quantity for each meal × cost for each unit).
 * A missing price or a unit mismatch is an error. It is never a silent zero.
 */
export function mealCost(ration: readonly RationItem[], prices: ReadonlyMap<string, IngredientPrice>): MealCost {
  const byIngredient = ration.map((item) => {
    const price = prices.get(item.commodity);
    if (price === undefined) {
      throw new DomainError("MISSING_INGREDIENT_PRICE", `No price for ${item.commodity}.`);
    }
    if (price.unit !== item.unit) {
      throw new DomainError(
        "UNIT_MISMATCH",
        `${item.commodity} is measured in ${item.unit}, but its price is for ${price.unit}.`,
      );
    }
    const quantity = fromSafeInteger(item.quantityPerMeal, `${item.commodity} quantityPerMeal`);
    return { commodity: item.commodity, cents: scaleRange(price.centsPerUnit, quantity) };
  });
  const total = byIngredient.reduce((sum, ingredient) => addRange(sum, ingredient.cents), ZERO_RANGE);
  return { total, byIngredient };
}
