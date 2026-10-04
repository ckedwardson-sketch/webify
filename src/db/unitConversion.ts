// src/db/unitConversion.ts
import { getDb } from "./database";
import { Ingredient } from "../types/models";

/**
 * Unit conversion factors (relative to grams as base unit)
 */
const UNIT_FACTORS: Record<string, number> = {
  // Weight units
  'g': 1,
  'gram': 1,
  'grams': 1,
  'kg': 1000,
  'kilogram': 1000,
  'kilograms': 1000,
  'oz': 28.3495,
  'ounce': 28.3495,
  'ounces': 28.3495,
  'lb': 453.592,
  'pound': 453.592,
  'pounds': 453.592,
  
  // Volume units (relative to cups)
  'cup': 1,
  'cups': 1,
  'tbsp': 0.0625,  // 1 tablespoon = 1/16 cup
  'tablespoon': 0.0625,
  'tablespoons': 0.0625,
  'tsp': 0.0208333, // 1 teaspoon = 1/48 cup
  'teaspoon': 0.0208333,
  'teaspoons': 0.0208333,
};

/**
 * Converts a quantity from one unit to grams
 * @param amount - The amount to convert
 * @param unit - The unit to convert from
 * @param ingredientId - The ingredient ID (used for density lookup)
 * @returns The amount in grams
 */
export async function convertToGrams(amount: number, unit: string, ingredientId: number | null = null): Promise<number> {
  const lowerUnit = unit.toLowerCase().trim();
  
  // Check if it's a weight unit
  if (UNIT_FACTORS[lowerUnit]) {
    return amount * UNIT_FACTORS[lowerUnit];
  }
  
  // For volume units, we need density information
  if (lowerUnit === 'cup' || lowerUnit === 'cups' || 
      lowerUnit === 'tbsp' || lowerUnit === 'tablespoon' || 
      lowerUnit === 'tablespoons' || 
      lowerUnit === 'tsp' || lowerUnit === 'teaspoon' || 
      lowerUnit === 'teaspoons') {
    
    // If we have an ingredient ID, try to get density
    if (ingredientId !== null) {
      const db = await getDb();
      const ingredient = await db.select<Ingredient[]>(
        'SELECT density_g_per_cup, density_user_edited FROM ingredients WHERE id = $1',
        [ingredientId]
      );
      
      if (ingredient.length > 0 && ingredient[0].density_g_per_cup) {
        const density = ingredient[0].density_g_per_cup;
        const cupFactor = UNIT_FACTORS['cup'] || 1;
        
        // Convert to cups first, then multiply by density
        let cups = amount;
        if (lowerUnit === 'tbsp' || lowerUnit === 'tablespoon' || lowerUnit === 'tablespoons') {
          cups = amount / 16; // 16 tablespoons per cup
        } else if (lowerUnit === 'tsp' || lowerUnit === 'teaspoon' || lowerUnit === 'teaspoons') {
          cups = amount / 48; // 48 teaspoons per cup
        }
        
        return cups * density;
      }
    }
  }
  
  // If we can't convert, return 0 or throw an error
  throw new Error(`Cannot convert unit "${unit}" to grams`);
}

/**
 * Converts grams to a target unit
 * @param grams - The amount in grams
 * @param targetUnit - The unit to convert to
 * @param ingredientId - The ingredient ID (used for density lookup)
 * @returns The amount in the target unit
 */
export async function convertFromGrams(grams: number, targetUnit: string, ingredientId: number | null = null): Promise<number> {
  const lowerUnit = targetUnit.toLowerCase().trim();
  
  // Check if it's a weight unit
  if (UNIT_FACTORS[lowerUnit]) {
    return grams / UNIT_FACTORS[lowerUnit];
  }
  
  // For volume units, we need density information
  if (lowerUnit === 'cup' || lowerUnit === 'cups' || 
      lowerUnit === 'tbsp' || lowerUnit === 'tablespoon' || 
      lowerUnit === 'tablespoons' || 
      lowerUnit === 'tsp' || lowerUnit === 'teaspoon' || 
      lowerUnit === 'teaspoons') {
    
    // If we have an ingredient ID, try to get density
    if (ingredientId !== null) {
      const db = await getDb();
      const ingredient = await db.select<Ingredient[]>(
        'SELECT density_g_per_cup, density_user_edited FROM ingredients WHERE id = $1',
        [ingredientId]
      );
      
      if (ingredient.length > 0 && ingredient[0].density_g_per_cup) {
        const density = ingredient[0].density_g_per_cup;
        const cupFactor = UNIT_FACTORS['cup'] || 1;
        
        // Convert grams to cups first
        const cups = grams / density;
        
        // Convert cups to target unit
        if (lowerUnit === 'cup' || lowerUnit === 'cups') {
          return cups;
        } else if (lowerUnit === 'tbsp' || lowerUnit === 'tablespoon' || lowerUnit === 'tablespoons') {
          return cups * 16; // 16 tablespoons per cup
        } else if (lowerUnit === 'tsp' || lowerUnit === 'teaspoon' || lowerUnit === 'teaspoons') {
          return cups * 48; // 48 teaspoons per cup
        }
      }
    }
  }
  
  // If we can't convert, return 0 or throw an error
  throw new Error(`Cannot convert grams to unit "${targetUnit}"`);
}

/**
 * Parses a unit string and returns amount and unit
 * @param unitString - The unit string (e.g., "2 cups")
 * @returns Object with amount and unit
 */
export function parseUnitString(unitString: string): { amount: number; unit: string } {
  const trimmed = unitString.trim();
  
  // Find the position of the first non-numeric character
  let i = 0;
  while (i < trimmed.length && (trimmed[i] === '.' || /\d/.test(trimmed[i]))) {
    i++;
  }
  
  if (i === 0) {
    throw new Error(`Invalid unit string: ${unitString}`);
  }
  
  const amountStr = trimmed.substring(0, i);
  const unit = trimmed.substring(i).trim();
  
  const amount = parseFloat(amountStr);
  
  if (isNaN(amount)) {
    throw new Error(`Invalid amount in unit string: ${unitString}`);
  }
  
  return { amount, unit };
}