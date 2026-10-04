import React, { useState, useEffect } from 'react';
import './Page.css';
import './FoodBudgetRecipeViewPage.css';
import { fetchRecipe } from '../db/recipes';
import { getRecipeIngredients } from '../db/foodBudget';
import { fetchIngredientById } from '../db/foodBudgetUtils';

export const FoodBudgetRecipeViewPage: React.FC<{ view: { type: 'food-budget-recipe-view'; recipeId: number } }> = ({ view }) => {
  const [recipe, setRecipe] = useState<any>(null);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch the recipe details
        const fetchedRecipe = await fetchRecipe(view.recipeId);
        if (!fetchedRecipe) {
          setError('Recipe not found');
          setLoading(false);
          return;
        }
        
        // Fetch recipe ingredients
        const recipeIngredients = await getRecipeIngredients(view.recipeId);
        
        // Get ingredient details for each ingredient
        const ingredientDetails = await Promise.all(
          recipeIngredients.map(async (ri) => {
            if (ri.ingredient_id) {
              const ingredient = await fetchIngredientById(ri.ingredient_id);
              return {
                id: ri.ingredient_id,
                name: ingredient?.name || 'Unknown Ingredient',
                amount: ri.original_unit_text,
                grams: ri.grams
              };
            } else {
              // Handle case where ingredient_id is null (might be a plain text ingredient)
              return {
                id: null,
                name: 'Unknown Ingredient',
                amount: ri.original_unit_text,
                grams: ri.grams
              };
            }
          })
        );
        
        setRecipe(fetchedRecipe);
        setIngredients(ingredientDetails);
        setLoading(false);
      } catch (err) {
        setError('Failed to load recipe data');
        setLoading(false);
      }
    };

    fetchData();
  }, [view.recipeId]);

  if (loading) {
    return (
      <div className="page food-budget-recipe-view">
        <h1>Recipe View</h1>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page food-budget-recipe-view">
        <h1>Recipe View</h1>
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="page food-budget-recipe-view">
        <h1>Recipe View</h1>
        <div className="error">Recipe not found</div>
      </div>
    );
  }

  return (
    <div className="page food-budget-recipe-view">
      <h1>{recipe.name}</h1>
      
      <div className="recipe-header">
        <div className="recipe-stats">
          <div className="stat-card">
            <h3>Estimated Cost</h3>
            <p>$0.00</p>
          </div>
          <div className="stat-card">
            <h3>Calories</h3>
            <p>0</p>
          </div>
          <div className="stat-card">
            <h3>Classification</h3>
            <span className={`classification-badge ${recipe.isHomegrown ? 'homegrown' : 'adtc'}`}>
              {recipe.isHomegrown ? 'Homegrown' : 'ADTC'}
            </span>
          </div>
        </div>
      </div>

      <div className="recipe-section">
        <h2>Ingredients</h2>
        <div className="ingredients-list">
          {ingredients.map((ingredient) => (
            <div key={ingredient.id || ingredient.name} className="ingredient-item">
              <span className="ingredient-name">{ingredient.name}</span>
              <span className="ingredient-amount">{ingredient.amount}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="recipe-section">
        <h2>Instructions</h2>
        <div className="instructions-content">
          <pre>{recipe.instructions}</pre>
        </div>
      </div>

      <div className="recipe-actions">
        <button>Add to Meal Plan</button>
        <button>Save Recipe</button>
      </div>
    </div>
  );
};

export default FoodBudgetRecipeViewPage;