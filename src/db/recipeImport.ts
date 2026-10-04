// src/db/recipeImport.ts
import { getDb } from "./database";
import { RecipeIngredient } from "./foodBudget";
import { convertToGrams, parseUnitString } from "./unitConversion";

// Confidence threshold for automatic matching
const CONFIDENCE_THRESHOLD = 0.8;

// Lookup table for common ingredients and their density (grams per cup)
const DENSITY_TABLE: Record<string, number> = {
  // Grains and cereals
  'rice': 180,
  'white rice': 180,
  'brown rice': 180,
  'quinoa': 180,
  'oats': 160,
  'wheat': 160,
  'flour': 120,
  'whole wheat flour': 120,
  'white flour': 120,
  
  // Vegetables
  'potatoes': 200,
  'onions': 160,
  'garlic': 160,
  'carrots': 160,
  'celery': 160,
  'broccoli': 160,
  'spinach': 160,
  'lettuce': 160,
  'tomatoes': 160,
  'bell peppers': 160,
  
  // Fruits
  'apples': 160,
  'bananas': 160,
  'oranges': 160,
  'grapes': 160,
  
  // Proteins
  'chicken': 160,
  'beef': 160,
  'pork': 160,
  'fish': 160,
  'eggs': 160,
  'beans': 160,
  'lentils': 160,
  
  // Dairy
  'milk': 240,
  'cheese': 240,
  'butter': 240,
  
  // Other common items
  'sugar': 200,
  'salt': 200,
  'oil': 200,
};

// Cache for density lookups to avoid repeated queries
const DENSITY_CACHE: Record<string, number> = {};

/**
 * Parses an ingredient line into amount, unit, and name components
 * Handles fractions, mixed numbers, ranges, parenthetical notes, and "to taste"
 */
export function parseIngredientLine(line: string): {
  amount: number;
  unit: string;
  name: string;
  isToTaste: boolean;
} {
  // Clean the line
  let cleanLine = line.trim();
  
  // Check for "to taste" at the end
  const isToTaste = cleanLine.toLowerCase().endsWith('to taste');
  if (isToTaste) {
    cleanLine = cleanLine.substring(0, cleanLine.length - 7).trim();
  }
  
  // Handle ranges like "2-3" by taking the midpoint
  const rangeMatch = cleanLine.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    const midpoint = (low + high) / 2;
    cleanLine = cleanLine.replace(rangeMatch[0], midpoint.toString());
  }
  
  // Extract amount and unit from the beginning of the line
  const amountMatch = cleanLine.match(/^(\d+(?:\.\d+)?(?:\s*\d+\/\d+)?(?:\s+\d+\/\d+)?)/);
  let amount = 1;
  let unit = '';
  let name = cleanLine;
  
  if (amountMatch) {
    const amountStr = amountMatch[1];
    
    // Handle fractions like 1/2, 1 1/2
    let processedAmount = amountStr;
    if (processedAmount.includes('/')) {
      // Handle mixed numbers like "1 1/2"
      if (processedAmount.includes(' ')) {
        const parts = processedAmount.split(' ');
        if (parts.length === 2) {
          const whole = parseFloat(parts[0]);
          const fractionParts = parts[1].split('/');
          const numerator = parseFloat(fractionParts[0]);
          const denominator = parseFloat(fractionParts[1]);
          amount = whole + (numerator / denominator);
        }
      } else {
        // Handle simple fractions like "1/2"
        const fractionParts = processedAmount.split('/');
        const numerator = parseFloat(fractionParts[0]);
        const denominator = parseFloat(fractionParts[1]);
        amount = numerator / denominator;
      }
    } else {
      amount = parseFloat(processedAmount);
    }
    
    // Extract unit and name
    const rest = cleanLine.substring(amountMatch[0].length).trim();
    const unitMatch = rest.match(/^(\w+)/);
    if (unitMatch) {
      unit = unitMatch[1];
      name = rest.substring(unitMatch[0].length).trim();
    } else {
      name = rest;
    }
  }
  
  // Remove parenthetical notes from name
  name = name.replace(/\s*\(.*?\)/g, '').trim();
  
  // Handle "to taste" case
  if (isToTaste) {
    amount = 0;
    unit = '';
    name = 'to taste';
  }
  
  return {
    amount,
    unit,
    name,
    isToTaste
  };
}

/**
 * Normalizes ingredient name for matching
 */
function normalizeName(name: string): string {
  // Convert to lowercase
  let normalized = name.toLowerCase();
  
  // Remove punctuation and extra spaces
  normalized = normalized.replace(/[^\w\s]/g, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Remove common suffixes that don't affect meaning
  const suffixes = ['raw', 'cooked', 'fresh', 'dried', 'canned', 'frozen'];
  for (const suffix of suffixes) {
    const regex = new RegExp(`\\s+${suffix}$`, 'i');
    normalized = normalized.replace(regex, '');
  }
  
  return normalized;
}

/**
 * Calculates edit distance between two strings
 */
function editDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Calculates similarity score based on whole-word overlap and edit distance
 */
function calculateSimilarityScore(name1: string, name2: string): number {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  
  // If exact match, return 1
  if (norm1 === norm2) return 1.0;
  
  // Calculate whole-word overlap
  const words1 = norm1.split(/\s+/).filter(w => w.length > 0);
  const words2 = norm2.split(/\s+/).filter(w => w.length > 0);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Count matching words
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  const wordOverlap = intersection.size / union.size;
  
  // Calculate edit distance score (0-1 scale)
  const maxLen = Math.max(norm1.length, norm2.length);
  const distance = editDistance(norm1, norm2);
  const editScore = maxLen > 0 ? 1 - (distance / maxLen) : 1;
  
  // Combine scores (weighted average)
  return (wordOverlap * 0.7) + (editScore * 0.3);
}

/**
 * Matches an ingredient line to existing ingredients with confidence
 */
export async function matchIngredient(
  ingredientLine: string,
  existingIngredients: Array<{ id: number; name: string }>
): Promise<{
  matchedIngredientId: number | null;
  confidence: number;
  suggestion?: string;
  formMismatch?: boolean;
  originalForm?: string;
  suggestedForm?: string;
}> {
  const parsed = parseIngredientLine(ingredientLine);
  
  // If it's "to taste", we don't match it
  if (parsed.isToTaste) {
    return {
      matchedIngredientId: null,
      confidence: 0,
      formMismatch: false
    };
  }
  
  // Extract form from ingredient line if present
  const lineForm = extractFormFromLine(ingredientLine);
  
  // Try to find the best match among existing ingredients
  let bestMatch: { id: number; name: string; score: number } | null = null;
  let bestFormMatch: { id: number; name: string; score: number } | null = null;
  
  for (const ingredient of existingIngredients) {
    const score = calculateSimilarityScore(parsed.name, ingredient.name);
    
    // Check if there's a form mismatch
    const ingredientForm = extractFormFromName(ingredient.name);
    
    if (lineForm && ingredientForm && lineForm !== ingredientForm) {
      // This is a form mismatch
      if (score > 0.7) { // Only consider if score is reasonably high
        if (!bestFormMatch || score > bestFormMatch.score) {
          bestFormMatch = { id: ingredient.id, name: ingredient.name, score };
        }
      }
    } else if (!bestMatch || score > bestMatch.score) {
      bestMatch = { id: ingredient.id, name: ingredient.name, score };
    }
  }
  
  // If we have a form mismatch, return it
  if (bestFormMatch) {
    return {
      matchedIngredientId: null,
      confidence: 0,
      formMismatch: true,
      originalForm: lineForm,
      suggestedForm: bestFormMatch.name,
      suggestion: `Create "${bestFormMatch.name}" instead`
    };
  }
  
  // Return the best match if confidence is high enough
  if (bestMatch && bestMatch.score >= CONFIDENCE_THRESHOLD) {
    return {
      matchedIngredientId: bestMatch.id,
      confidence: bestMatch.score
    };
  }
  
  // If no good match, return the best match anyway with low confidence
  if (bestMatch) {
    return {
      matchedIngredientId: bestMatch.id,
      confidence: bestMatch.score
    };
  }
  
  // No match found
  return {
    matchedIngredientId: null,
    confidence: 0,
    formMismatch: false
  };
}

/**
 * Extracts form from ingredient name (e.g., "Rice, cooked" -> "cooked")
 */
function extractFormFromName(name: string): string | null {
  const formPattern = /,\s*(raw|cooked|fresh|dried|canned|frozen)\b/i;
  const match = name.match(formPattern);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Extracts form from ingredient line (e.g., "cooked rice" -> "cooked")
 */
function extractFormFromLine(line: string): string | null {
  const formPattern = /\b(raw|cooked|fresh|dried|canned|frozen)\b/i;
  const match = line.match(formPattern);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Gets or estimates density for an ingredient
 */
export async function getDensityForIngredient(ingredientId: number | null, ingredientName: string): Promise<number | null> {
  // If we have an ingredient ID, check if density is already cached or user-edited
  if (ingredientId !== null) {
    const db = await getDb();
    
    // Check if density is already cached
    const cachedKey = `density_${ingredientId}`;
    if (DENSITY_CACHE[cachedKey]) {
      return DENSITY_CACHE[cachedKey];
    }
    
    // Check if density exists in database and wasn't user-edited
    const result = await db.select<Array<{ density_g_per_cup: number; density_user_edited: number }>>(
      'SELECT density_g_per_cup, density_user_edited FROM ingredients WHERE id = $1',
      [ingredientId]
    );
    
    if (result.length > 0 && result[0].density_g_per_cup && result[0].density_user_edited === 0) {
      DENSITY_CACHE[cachedKey] = result[0].density_g_per_cup;
      return result[0].density_g_per_cup;
    }
  }
  
  // Look up in our density table
  const normalized = normalizeName(ingredientName);
  const density = DENSITY_TABLE[normalized];
  
  if (density !== undefined) {
    // Cache it for future use
    if (ingredientId !== null) {
      const cachedKey = `density_${ingredientId}`;
      DENSITY_CACHE[cachedKey] = density;
    }
    return density;
  }
  
  // No density found
  return null;
}

/**
 * Converts an ingredient line to grams using its density
 */
export async function convertLineToGrams(line: string, ingredientId: number | null, ingredientName: string): Promise<number> {
  const parsed = parseIngredientLine(line);
  
  // If it's "to taste", return 0
  if (parsed.isToTaste) {
    return 0;
  }
  
  // If no unit specified, assume it's in grams or we can't convert
  if (!parsed.unit) {
    return parsed.amount;
  }
  
  // If it's already in grams, return as-is
  if (parsed.unit.toLowerCase() === 'g' || parsed.unit.toLowerCase() === 'gram' || parsed.unit.toLowerCase() === 'grams') {
    return parsed.amount;
  }
  
  // Get density for the ingredient
  const density = await getDensityForIngredient(ingredientId, ingredientName);
  
  // If we have density, convert using density
  if (density !== null) {
    // For volume units, we can convert using density
    if (parsed.unit.toLowerCase() === 'cup' || parsed.unit.toLowerCase() === 'cups') {
      return parsed.amount * density;
    } else if (parsed.unit.toLowerCase() === 'tbsp' || parsed.unit.toLowerCase() === 'tablespoon' || parsed.unit.toLowerCase() === 'tablespoons') {
      return (parsed.amount / 16) * density; // 16 tbsp = 1 cup
    } else if (parsed.unit.toLowerCase() === 'tsp' || parsed.unit.toLowerCase() === 'teaspoon' || parsed.unit.toLowerCase() === 'teaspoons') {
      return (parsed.amount / 48) * density; // 48 tsp = 1 cup
    }
  }
  
  // If we can't convert, return amount as grams (fallback)
  return parsed.amount;
}

/**
 * Imports recipe ingredients from text lines into structured format
 */
export async function importRecipeIngredients(
  recipeId: number,
  ingredientLines: string[]
): Promise<{
  recipeIngredients: RecipeIngredient[];
  suggestions: Array<{
    lineIndex: number;
    suggestion: string;
    type: 'form_mismatch' | 'no_match' | 'low_confidence';
  }>;
}> {
  const db = await getDb();
  
  // Get all existing ingredients for matching
  const allIngredients = await db.select<Array<{ id: number; name: string }>>(
    'SELECT id, name FROM ingredients'
  );
  
  const recipeIngredients: RecipeIngredient[] = [];
  const suggestions: Array<{
    lineIndex: number;
    suggestion: string;
    type: 'form_mismatch' | 'no_match' | 'low_confidence';
  }> = [];
  
  for (let i = 0; i < ingredientLines.length; i++) {
    const line = ingredientLines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Match the ingredient
    const matchResult = await matchIngredient(line, allIngredients);
    
    if (matchResult.formMismatch) {
      suggestions.push({
        lineIndex: i,
        suggestion: matchResult.suggestion || `Form mismatch: ${matchResult.originalForm} vs ${matchResult.suggestedForm}`,
        type: 'form_mismatch'
      });
      
      // For now, we'll skip form mismatches and let user handle them
      continue;
    }
    
    if (matchResult.matchedIngredientId === null) {
      // No match found
      suggestions.push({
        lineIndex: i,
        suggestion: 'No match found',
        type: 'no_match'
      });
      
      // Create a placeholder entry for unmatchable ingredients
      recipeIngredients.push({
        id: 0,
        recipe_id: recipeId,
        ingredient_id: null,
        grams: 0,
        original_unit_text: line,
        sort_order: i
      });
      
      continue;
    }
    
    // Convert to grams
    const grams = await convertLineToGrams(line, matchResult.matchedIngredientId, allIngredients.find(ing => ing.id === matchResult.matchedIngredientId)?.name || '');
    
    // Add to recipe ingredients
    recipeIngredients.push({
      id: 0,
      recipe_id: recipeId,
      ingredient_id: matchResult.matchedIngredientId,
      grams,
      original_unit_text: line,
      sort_order: i
    });
  }
  
  return {
    recipeIngredients,
    suggestions
  };
}

/**
 * Back-applies hot links to original ingredient lines
 */
export function backApplyHotLinks(originalLines: string[], recipeIngredients: RecipeIngredient[]): string[] {
  // For now, we'll just return the original lines since we don't have the full hot-link parsing logic
  // In a real implementation, this would replace matched ingredients with @ingredient ..amount hot links
  return [...originalLines]; // Placeholder implementation
}

/**
 * Creates a new ingredient with form information
 */
export async function createIngredientWithForm(
  name: string,
  form: string
): Promise<number> {
  const db = await getDb();
  
  // Construct the full name with form
  const fullName = `${name}, ${form}`;
  
  // Insert the ingredient
  const result = await db.execute(
    `INSERT INTO ingredients (name, category, is_flavoring, density_g_per_cup, density_user_edited)
     VALUES ($1, 'general', 0, NULL, 0)`,
    [fullName]
  );
  
  return result.lastInsertId as number;
}

/**
 * Processes an ingredient line with a confidence score and returns appropriate action
 */
export async function processIngredientLine(
  line: string
): Promise<{
  action: 'match' | 'suggest_create' | 'offer_options' | 'skip';
  ingredientId?: number;
  confidence?: number;
  suggestion?: string;
}> {
  const db = await getDb();
  
  // Get all existing ingredients for matching
  const allIngredients = await db.select<Array<{ id: number; name: string }>>(
    'SELECT id, name FROM ingredients'
  );
  
  const matchResult = await matchIngredient(line, allIngredients);
  
  if (matchResult.formMismatch) {
    return {
      action: 'suggest_create',
      suggestion: matchResult.suggestion || ''
    };
  }
  
  if (matchResult.matchedIngredientId !== null) {
    if (matchResult.confidence >= CONFIDENCE_THRESHOLD) {
      return {
        action: 'match',
        ingredientId: matchResult.matchedIngredientId,
        confidence: matchResult.confidence
      };
    } else {
      return {
        action: 'offer_options',
        ingredientId: matchResult.matchedIngredientId,
        confidence: matchResult.confidence
      };
    }
  }
  
  return {
    action: 'offer_options'
  };
}