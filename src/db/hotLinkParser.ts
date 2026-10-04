// src/db/hotLinkParser.ts
import { getDb } from "./database";
import { convertToGrams, parseUnitString } from "./unitConversion";

/**
 * Parses a hot-link string like "@White Flour ..2 cups" 
 * @param hotLink - The hot-link string to parse
 * @returns Object with ingredientId, grams, and originalUnitText
 */
export async function parseHotLink(hotLink: string): Promise<{
  ingredientId: number | null;
  grams: number;
  originalUnitText: string;
}> {
  // Remove leading @ if present
  const cleanLink = hotLink.trim().startsWith('@') ? hotLink.trim().substring(1) : hotLink.trim();
  
  // Split by ".." to separate ingredient name from amount
  const parts = cleanLink.split('..');
  if (parts.length < 2) {
    throw new Error(`Invalid hot-link format: ${hotLink}. Must contain both ingredient name and amount.`);
  }
  
  const ingredientName = parts[0].trim();
  const amountPart = parts.slice(1).join('..').trim(); // Handle cases where amount contains ".."
  
  // Find ingredient by name (case insensitive)
  const db = await getDb();
  const ingredients = await db.select<Array<{ id: number; name: string }>>(
    'SELECT id, name FROM ingredients WHERE LOWER(name) = LOWER($1)',
    [ingredientName]
  );
  
  let ingredientId: number | null = null;
  if (ingredients.length > 0) {
    ingredientId = ingredients[0].id;
  }
  
  // Parse the amount part
  const { amount, unit } = parseUnitString(amountPart);
  
  // Convert to grams
  const grams = await convertToGrams(amount, unit, ingredientId);
  
  return {
    ingredientId,
    grams,
    originalUnitText: amountPart
  };
}

/**
 * Parses a text string looking for hot-links and returns the parsed ingredients
 * @param text - The text to parse
 * @returns Array of parsed hot-links
 */
export async function parseHotLinks(text: string): Promise<Array<{
  ingredientId: number | null;
  grams: number;
  originalUnitText: string;
  fullMatch: string;
}>> {
  // Regular expression to match hot-links like @Name ..amount
  const hotLinkRegex = /@([^@]+?)\s*\.{2}\s*([^\n]+)/g;
  
  const matches: Array<{
    ingredientId: number | null;
    grams: number;
    originalUnitText: string;
    fullMatch: string;
  }> = [];
  
  let match;
  while ((match = hotLinkRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const ingredientName = match[1].trim();
    const amountPart = match[2].trim();
    
    // Find ingredient by name (case insensitive)
    const db = await getDb();
    const ingredients = await db.select<Array<{ id: number; name: string }>>(
      'SELECT id, name FROM ingredients WHERE LOWER(name) = LOWER($1)',
      [ingredientName]
    );
    
    let ingredientId: number | null = null;
    if (ingredients.length > 0) {
      ingredientId = ingredients[0].id;
    }
    
    // Parse the amount part
    const { amount, unit } = parseUnitString(amountPart);
    
    // Convert to grams
    const grams = await convertToGrams(amount, unit, ingredientId);
    
    matches.push({
      ingredientId,
      grams,
      originalUnitText: amountPart,
      fullMatch
    });
  }
  
  return matches;
}