#!/usr/bin/env python3
"""
Main entry point for the Food Budget Python backend
This script is called by Tauri to handle food budget operations
"""

import sys
import os
import json
from pathlib import Path

# Add the current directory to Python path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent))

try:
    from food_budget.classification_engine import ClassificationEngine
    from food_budget.inflation_engine import InflationEngine
    from food_budget.notification_scheduler import NotificationScheduler
    from food_budget.ai_engine import AIEngine
except ImportError as e:
    print(f"Failed to import food budget modules: {e}")
    sys.exit(1)

def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: python food_budget_main.py <command> [arguments]")
        return
    
    command = sys.argv[1]
    db_path = os.environ.get('WEBIFY_DB_PATH', 'webify.db')
    
    # Initialize engines
    classification_engine = ClassificationEngine(db_path)
    inflation_engine = InflationEngine(db_path)
    notification_scheduler = NotificationScheduler(db_path)
    ai_engine = AIEngine(db_path)
    
    try:
        if command == "classify_ingredient":
            ingredient_id = int(sys.argv[2])
            result = classification_engine.classify_ingredient(ingredient_id)
            print(json.dumps({"result": result}))
            
        elif command == "get_near_dtc_ingredients":
            result = classification_engine.get_near_dtc_ingredients()
            print(json.dumps({"result": result}))
            
        elif command == "get_ingredient_calories_per_dollar":
            ingredient_id = int(sys.argv[2])
            result = classification_engine.get_ingredient_calories_per_dollar(ingredient_id)
            print(json.dumps({"result": result}))
            
        elif command == "reclassify_ingredients":
            new_dtc = float(sys.argv[2])
            result = classification_engine.reclassify_ingredients(new_dtc)
            print(json.dumps({"result": result}))
            
        elif command == "get_ingredient_projection":
            ingredient_id = int(sys.argv[2])
            target_date = sys.argv[3]
            result = inflation_engine.get_ingredient_projection(ingredient_id, target_date)
            print(json.dumps({"result": result}))
            
        elif command == "get_dtc_projection":
            target_date = sys.argv[2]
            result = inflation_engine.get_dtc_projection(target_date)
            print(json.dumps({"result": result}))
            
        elif command == "find_best_match":
            ingredient_name = sys.argv[2]
            result = ai_engine.find_best_match(ingredient_name)
            print(json.dumps({"result": result}))
            
        elif command == "estimate_density":
            ingredient_name = sys.argv[2]
            result = ai_engine.estimate_density(ingredient_name)
            print(json.dumps({"result": result}))
            
        elif command == "lookup_nutrition":
            ingredient_name = sys.argv[2]
            result = ai_engine.lookup_nutrition(ingredient_name)
            print(json.dumps({"result": result}))
            
        elif command == "check_notifications":
            result = notification_scheduler.check_for_notifications()
            print(json.dumps({"result": result}))
            
        elif command == "get_unread_notifications_count":
            result = notification_scheduler.get_unread_notifications_count()
            print(json.dumps({"result": result}))
            
        else:
            print(f"Unknown command: {command}")
            
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()