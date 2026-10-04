/**
 * Projection functions for food budget calculations
 */

/**
 * Grow a value by an annual rate over time
 */
export function grow(value: number, fromDate: Date, toDate: Date, annualRate: number): number {
  const daysDiff = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
  const yearsDiff = daysDiff / 365.25;
  return value * Math.pow(1 + annualRate, yearsDiff);
}

/**
 * Project ingredient cost per calorie over time
 */
export function projectIngredientCostPerCalorie(
  baseCostPerCalorie: number,
  baseDate: Date,
  targetDate: Date,
  annualInflationRate: number
): number {
  return grow(baseCostPerCalorie, baseDate, targetDate, annualInflationRate);
}

/**
 * Project DTC cost per calorie over time
 */
export function projectDtcCostPerCalorie(
  baseDtc: number,
  baseDate: Date,
  targetDate: Date,
  annualInflationRate: number
): number {
  // Convert DTC to dollars per calorie (1/DTC) and then project it
  const baseCostPerCalorie = 1 / baseDtc;
  const projectedCostPerCalorie = grow(baseCostPerCalorie, baseDate, targetDate, annualInflationRate);
  return 1 / projectedCostPerCalorie; // Convert back to DTC
}

/**
 * Calculate projected crossing date when an ingredient's line would cross the DTC line
 * Returns the date when the lines would cross, or null if they never do
 */
export function projectedCrossingDate(
  ingredientCostPerCalorie: number,
  dtcCostPerCalorie: number,
  startDate: Date,
  endDate: Date,
  annualInflationRate: number
): Date | null {
  // This is a simplified implementation
  // In a real implementation, this would solve for when the two lines cross
  // For now, we'll return null to indicate this isn't fully implemented
  return null;
}