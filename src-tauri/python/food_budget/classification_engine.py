"""
Classification Engine for Food Budget System
Handles ingredient classification based on DTC thresholds
"""

import sqlite3
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
import os

class ClassificationEngine:
    def __init__(self, db_path: str):
        self.db_path = db_path
    
    def get_current_dtc(self) -> float:
        """Get current DTC (Dollar-to-Calorie) threshold"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT dtc_value FROM food_budget_settings WHERE id = 1
            """)
            result = cursor.fetchone()
            return result[0] if result else 100.0
        finally:
            conn.close()
    
    def get_ingredient_calories_per_dollar(self, ingredient_id: int) -> Optional[float]:
        """
        Calculate calories per dollar for an ingredient based on its last purchase
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get the most recent purchase for this ingredient
            cursor.execute("""
                SELECT price, amount_grams 
                FROM purchases 
                WHERE ingredient_id = ? 
                ORDER BY date DESC 
                LIMIT 1
            """, (ingredient_id,))
            
            purchase = cursor.fetchone()
            
            if not purchase:
                return None
            
            price, amount_grams = purchase
            
            if price <= 0 or amount_grams <= 0:
                return None
                
            # Get calories per gram from nutrition data
            cursor.execute("""
                SELECT nutrition_json FROM ingredients WHERE id = ?
            """, (ingredient_id,))
            
            nutrition_result = cursor.fetchone()
            calories_per_gram = 0.0
            
            if nutrition_result and nutrition_result[0]:
                try:
                    nutrition_data = json.loads(nutrition_result[0])
                    if 'calories' in nutrition_data:
                        # Assuming nutrition data gives calories per 100g
                        calories_per_gram = nutrition_data['calories'] / 100.0
                except (json.JSONDecodeError, KeyError):
                    pass
            
            # For homegrown ingredients, use their assigned calories per dollar
            cursor.execute("""
                SELECT homegrown_calories_per_dollar FROM ingredients WHERE id = ?
            """, (ingredient_id,))
            
            homegrown_result = cursor.fetchone()
            if homegrown_result and homegrown_result[0] is not None:
                # This is a homegrown ingredient with assigned value
                return homegrown_result[0]
            
            # Calculate calories per dollar
            if calories_per_gram > 0 and amount_grams > 0:
                calories_total = calories_per_gram * amount_grams
                return calories_total / price
            else:
                return None
                
        finally:
            conn.close()
    
    def classify_ingredient(self, ingredient_id: int) -> str:
        """
        Classify an ingredient as ADTC, Expense, or Homegrown
        
        Returns:
            'ADTC' - Above Dollar-To-Calorie threshold
            'Expense' - Below threshold
            'Homegrown' - Special category for homegrown items
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get ingredient info
            cursor.execute("""
                SELECT category, homegrown_calories_per_dollar 
                FROM ingredients 
                WHERE id = ?
            """, (ingredient_id,))
            
            ingredient_result = cursor.fetchone()
            
            if not ingredient_result:
                return 'Expense'  # Default fallback
            
            category, homegrown_calories = ingredient_result
            
            # Handle special categories
            if category == 'Homegrown':
                return 'Homegrown'
            
            if category == 'Low-cost flavorings':
                return 'Expense'  # Flavorings are ignored in classification
            
            # Get current DTC threshold
            dtc_threshold = self.get_current_dtc()
            
            # For homegrown ingredients, use their assigned calories per dollar
            if homegrown_calories is not None:
                return 'Homegrown'
            
            # Calculate calories per dollar from last purchase
            calories_per_dollar = self.get_ingredient_calories_per_dollar(ingredient_id)
            
            if calories_per_dollar is not None:
                if calories_per_dollar >= dtc_threshold:
                    return 'ADTC'
                else:
                    return 'Expense'
            else:
                # Fallback to expense if we can't calculate
                return 'Expense'
                
        finally:
            conn.close()
    
    def get_near_dtc_ingredients(self) -> list:
        """
        Get ingredients that are near the DTC threshold (within 25% below)
        """
        dtc_threshold = self.get_current_dtc()
        threshold = dtc_threshold * 0.75  # Within 25% below threshold
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get all ingredients in collection
            cursor.execute("""
                SELECT id, name, category, is_flavoring 
                FROM ingredients 
                WHERE in_collection = 1 
                ORDER BY name
            """)
            
            ingredients = cursor.fetchall()
            results = []
            
            for ingredient in ingredients:
                ingredient_id, name, category, is_flavoring = ingredient
                
                # Get calories per dollar
                calories_per_dollar = self.get_ingredient_calories_per_dollar(ingredient_id)
                classification = self.classify_ingredient(ingredient_id)
                
                # Include if it's near DTC or ADTC
                if calories_per_dollar is not None and calories_per_dollar >= threshold:
                    results.append({
                        'id': ingredient_id,
                        'name': name,
                        'category': category,
                        'is_flavoring': is_flavoring,
                        'calories_per_dollar': calories_per_dollar,
                        'classification': classification
                    })
                elif classification == 'ADTC':
                    # Even if we can't calculate calories per dollar, if it's ADTC, include it
                    results.append({
                        'id': ingredient_id,
                        'name': name,
                        'category': category,
                        'is_flavoring': is_flavoring,
                        'calories_per_dollar': calories_per_dollar,
                        'classification': classification
                    })
            
            return results
            
        finally:
            conn.close()
    
    def reclassify_ingredients(self, new_dtc: float) -> list:
        """
        Reclassify all ingredients when DTC value changes
        Returns list of changed ingredients with old and new classifications
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get all ingredients
            cursor.execute("""
                SELECT id FROM ingredients
            """)
            
            ingredients = cursor.fetchall()
            changes = []
            
            for (ingredient_id,) in ingredients:
                old_classification = self.classify_ingredient(ingredient_id)
                
                # Update DTC in history
                current_time = datetime.now().isoformat()
                cursor.execute("""
                    INSERT INTO dtc_history (dtc_value, effective_date) 
                    VALUES (?, ?)
                """, (self.get_current_dtc(), current_time))
                
                # Update current DTC
                cursor.execute("""
                    UPDATE food_budget_settings SET dtc_value = ? WHERE id = 1
                """, (new_dtc,))
                
                new_classification = self.classify_ingredient(ingredient_id)
                
                if old_classification != new_classification:
                    changes.append({
                        'ingredient_id': ingredient_id,
                        'old_classification': old_classification,
                        'new_classification': new_classification
                    })
            
            conn.commit()
            return changes
            
        finally:
            conn.close()

def main():
    """Main function for testing"""
    # This would be called from Tauri when needed
    print("Food Budget Classification Engine initialized")

if __name__ == "__main__":
    main()