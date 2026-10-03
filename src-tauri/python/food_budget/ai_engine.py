"""
AI Engine for Food Budget System
Handles ingredient matching, density estimation, and nutrition lookup
"""

import sqlite3
import json
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
import difflib

class AIEngine:
    def __init__(self, db_path: str):
        self.db_path = db_path
    
    def find_best_match(self, ingredient_name: str, max_matches: int = 5) -> List[Dict[str, Any]]:
        """
        Find the best matching ingredient from the database based on name similarity
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get all ingredients for matching
            cursor.execute("""
                SELECT id, name FROM ingredients ORDER BY name
            """)
            
            ingredients = cursor.fetchall()
            
            # Use difflib to find best matches
            matcher = difflib.SequenceMatcher(None, ingredient_name.lower())
            matches = []
            
            for ingredient_id, ingredient_name_db in ingredients:
                matcher.set_seq2(ingredient_name_db.lower())
                ratio = matcher.ratio()
                
                if ratio > 0.6:  # Threshold for good match
                    matches.append({
                        'ingredient_id': ingredient_id,
                        'ingredient_name': ingredient_name_db,
                        'match_ratio': ratio
                    })
            
            # Sort by match ratio descending
            matches.sort(key=lambda x: x['match_ratio'], reverse=True)
            
            return matches[:max_matches]
            
        finally:
            conn.close()
    
    def estimate_density(self, ingredient_name: str) -> Optional[Dict[str, Any]]:
        """
        Estimate density for an ingredient based on its name and known patterns
        """
        # This is a simplified implementation - in a real system, this would
        # use more sophisticated algorithms or external databases
        
        # Common density patterns by ingredient type
        density_patterns = {
            # Grains and cereals
            'rice': 195,  # grams per cup
            'wheat': 150,
            'oats': 120,
            'barley': 130,
            
            # Legumes
            'beans': 170,
            'lentils': 160,
            'chickpeas': 165,
            
            # Vegetables
            'potato': 200,
            'carrot': 120,
            'broccoli': 100,
            'spinach': 70,
            
            # Fruits
            'apple': 180,
            'banana': 120,
            'orange': 170,
            
            # Meats
            'beef': 300,
            'chicken': 250,
            'pork': 280,
            
            # Dairy
            'milk': 240,
            'cheese': 220,
            
            # Others
            'sugar': 200,
            'flour': 120,
            'oil': 100,
        }
        
        name_lower = ingredient_name.lower()
        
        # Check for exact matches first
        for key, density in density_patterns.items():
            if key in name_lower:
                return {
                    'ingredient_name': ingredient_name,
                    'estimated_density_g_per_cup': density,
                    'confidence': 0.9
                }
        
        # Check for partial matches
        for key, density in density_patterns.items():
            if key in name_lower:
                return {
                    'ingredient_name': ingredient_name,
                    'estimated_density_g_per_cup': density,
                    'confidence': 0.7
                }
        
        # If no pattern matched, return None
        return None
    
    def lookup_nutrition(self, ingredient_name: str) -> Optional[Dict[str, Any]]:
        """
        Lookup nutrition data for an ingredient
        In a real system, this would connect to a nutrition database like USDA FoodData Central
        """
        # This is a mock implementation with sample data
        # In a real implementation, this would connect to an actual nutrition API
        
        nutrition_samples = {
            'rice, dry': {
                'calories': 130,
                'protein': 2.7,
                'fat': 0.3,
                'carbohydrates': 28.5,
                'fiber': 0.4,
                'sugar': 0.1
            },
            'rice, cooked': {
                'calories': 130,
                'protein': 2.7,
                'fat': 0.3,
                'carbohydrates': 28.5,
                'fiber': 0.4,
                'sugar': 0.1
            },
            'chicken breast': {
                'calories': 165,
                'protein': 31,
                'fat': 3.6,
                'carbohydrates': 0,
                'fiber': 0,
                'sugar': 0
            },
            'beef, ground': {
                'calories': 250,
                'protein': 26,
                'fat': 15,
                'carbohydrates': 0,
                'fiber': 0,
                'sugar': 0
            },
            'broccoli': {
                'calories': 55,
                'protein': 3.7,
                'fat': 0.6,
                'carbohydrates': 11.3,
                'fiber': 2.6,
                'sugar': 2.6
            },
            'apple': {
                'calories': 52,
                'protein': 0.3,
                'fat': 0.2,
                'carbohydrates': 13.8,
                'fiber': 2.4,
                'sugar': 10.4
            },
            'banana': {
                'calories': 89,
                'protein': 1.1,
                'fat': 0.3,
                'carbohydrates': 22.8,
                'fiber': 2.6,
                'sugar': 12.2
            },
            'flour, all purpose': {
                'calories': 364,
                'protein': 10,
                'fat': 1,
                'carbohydrates': 76.5,
                'fiber': 2.7,
                'sugar': 0.1
            }
        }
        
        name_lower = ingredient_name.lower()
        
        # Look for exact matches or partial matches
        for sample_name, nutrition_data in nutrition_samples.items():
            if sample_name in name_lower or name_lower in sample_name:
                return {
                    'ingredient_name': ingredient_name,
                    'nutrition_data': nutrition_data,
                    'source': 'sample_database'
                }
        
        # Return None if no match found
        return None
    
    def match_and_validate_ingredient(self, ingredient_name: str, 
                                    expected_unit: str = 'grams') -> Dict[str, Any]:
        """
        Match ingredient and validate it's ready for use
        """
        # First try to find an exact match
        matches = self.find_best_match(ingredient_name, 3)
        
        if len(matches) > 0:
            # Return first match with confidence
            best_match = matches[0]
            return {
                'matched': True,
                'ingredient_id': best_match['ingredient_id'],
                'ingredient_name': best_match['ingredient_name'],
                'confidence': best_match['match_ratio'],
                'action_needed': 'use_existing'
            }
        else:
            # No match found - need to create new ingredient
            return {
                'matched': False,
                'ingredient_name': ingredient_name,
                'confidence': 0.0,
                'action_needed': 'create_new'
            }

def main():
    """Main function for testing"""
    print("Food Budget AI Engine initialized")

if __name__ == "__main__":
    main()