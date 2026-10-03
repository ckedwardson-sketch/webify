"""
Inflation and Projection Engine for Food Budget System
Handles inflation calculations and future projections
"""

import sqlite3
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import math

class InflationEngine:
    def __init__(self, db_path: str):
        self.db_path = db_path
    
    def get_annual_inflation_rate(self) -> float:
        """Get current annual inflation rate"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT inflation_rate FROM food_budget_settings WHERE id = 1
            """)
            result = cursor.fetchone()
            return result[0] if result else 0.02  # Default 2%
        finally:
            conn.close()
    
    def calculate_projected_price(self, current_price: float, current_date: str, 
                                projected_date: str, inflation_rate: Optional[float] = None) -> float:
        """
        Calculate projected price based on inflation
        """
        if inflation_rate is None:
            inflation_rate = self.get_annual_inflation_rate()
        
        # Parse dates
        current_dt = datetime.fromisoformat(current_date.replace('Z', '+00:00'))
        projected_dt = datetime.fromisoformat(projected_date.replace('Z', '+00:00'))
        
        # Calculate time difference in years
        time_diff = (projected_dt - current_dt).days / 365.25
        
        # Apply compound inflation
        projected_price = current_price * ((1 + inflation_rate) ** time_diff)
        
        return round(projected_price, 2)
    
    def get_ingredient_projection(self, ingredient_id: int, 
                                target_date: str) -> Dict[str, Any]:
        """
        Get projected cost for an ingredient at a target date
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get the most recent purchase for this ingredient
            cursor.execute("""
                SELECT price, amount_grams, date 
                FROM purchases 
                WHERE ingredient_id = ? 
                ORDER BY date DESC 
                LIMIT 1
            """, (ingredient_id,))
            
            purchase = cursor.fetchone()
            
            if not purchase:
                return {
                    'ingredient_id': ingredient_id,
                    'projected_price': None,
                    'error': 'No purchase data available'
                }
            
            price, amount_grams, purchase_date = purchase
            
            # Get inflation rate
            inflation_rate = self.get_annual_inflation_rate()
            
            # Calculate projected price
            projected_price = self.calculate_projected_price(
                price, purchase_date, target_date, inflation_rate
            )
            
            # Calculate projected calories per dollar
            calories_per_dollar = None
            if amount_grams > 0 and price > 0:
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
                            calories_per_gram = nutrition_data['calories'] / 100.0
                    except (json.JSONDecodeError, KeyError):
                        pass
                
                if calories_per_gram > 0:
                    calories_total = calories_per_gram * amount_grams
                    calories_per_dollar = calories_total / projected_price
            
            return {
                'ingredient_id': ingredient_id,
                'current_price': price,
                'projected_price': projected_price,
                'projected_date': target_date,
                'inflation_rate': inflation_rate,
                'calories_per_dollar': calories_per_dollar
            }
            
        finally:
            conn.close()
    
    def get_dtc_projection(self, target_date: str) -> Dict[str, Any]:
        """
        Get projected DTC value at target date
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get current DTC
            cursor.execute("""
                SELECT dtc_value FROM food_budget_settings WHERE id = 1
            """)
            
            dtc_result = cursor.fetchone()
            current_dtc = dtc_result[0] if dtc_result else 100.0
            
            # Get inflation rate
            inflation_rate = self.get_annual_inflation_rate()
            
            # For now, we'll assume DTC follows the same inflation pattern
            # This is a simplification - in reality, this would be more complex
            current_time = datetime.now()
            target_time = datetime.fromisoformat(target_date.replace('Z', '+00:00'))
            
            time_diff = (target_time - current_time).days / 365.25
            
            # Apply inflation to DTC
            projected_dtc = current_dtc * ((1 + inflation_rate) ** time_diff)
            
            return {
                'current_dtc': current_dtc,
                'projected_dtc': round(projected_dtc, 2),
                'projected_date': target_date,
                'inflation_rate': inflation_rate
            }
            
        finally:
            conn.close()

def main():
    """Main function for testing"""
    print("Food Budget Inflation Engine initialized")

if __name__ == "__main__":
    main()