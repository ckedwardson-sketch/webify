import React, { useState, useEffect } from 'react';
import './Page.css';
import './FoodBudgetRecipeViewPage.css';

export const FoodBudgetRecipeViewPage: React.FC<{ view: { type: 'food-budget-recipe-view'; recipeId: number } }> = (_) => {
  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading data
    const fetchData = async () => {
      try {
        setLoading(true);
        // In a real implementation, this would call the backend API
        // const response = await fetch(`/api/food-budget/recipes/${view.recipeId}`);
        // const data = await response.json();
        // setRecipe(data);
        
        // Mock data for now
        setTimeout(() => {
          setRecipe({
            id: 1,
            name: 'Chicken and Rice Bowl',
            ingredients: [
              { id: 1, name: 'Chicken Breast', amount: '200g', category: 'Meat' },
              { id: 2, name: 'White Rice', amount: '1 cup', category: 'Grains' },
              { id: 3, name: 'Broccoli', amount: '1 cup', category: 'Vegetables' },
            ],
            instructions: '1. Cook rice according to package directions.\n2. Grill chicken until fully cooked.\n3. Steam broccoli.\n4. Assemble ingredients in bowl.',
            estimated_cost: 8.50,
            estimated_calories: 450,
            classification: 'ADTC'
          });
          setLoading(false);
        }, 500);
      } catch (err) {
        setError('Failed to load recipe data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
            <p>${recipe.estimated_cost.toFixed(2)}</p>
          </div>
          <div className="stat-card">
            <h3>Calories</h3>
            <p>{recipe.estimated_calories}</p>
          </div>
          <div className="stat-card">
            <h3>Classification</h3>
            <span className={`classification-badge ${recipe.classification.toLowerCase()}`}>
              {recipe.classification}
            </span>
          </div>
        </div>
      </div>

      <div className="recipe-section">
        <h2>Ingredients</h2>
        <div className="ingredients-list">
          {recipe.ingredients.map((ingredient: any) => (
            <div key={ingredient.id} className="ingredient-item">
              <span className="ingredient-name">{ingredient.name}</span>
              <span className="ingredient-amount">{ingredient.amount}</span>
              <span className="ingredient-category">{ingredient.category}</span>
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