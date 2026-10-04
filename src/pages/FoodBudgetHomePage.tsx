import React, { useState, useEffect } from 'react';
import { getNearDtcIngredients, getLikelyToUseIngredients, getCurrentDtcValue, getHomegrownIngredients, getLowCostFlavorings, getExpenseIngredients } from '../db/foodBudgetUtils';
import { View } from '../types/nav';
import { useNavigate } from 'react-router-dom';
import './Page.css';
import './FoodBudgetHomePage.css';

export const FoodBudgetHomePage: React.FC<{ view: { type: 'food-budget-home' } }> = (_) => {
  const [nearDtcIngredients, setNearDtcIngredients] = useState<any[]>([]);
  const [likelyToUseIngredients, setLikelyToUseIngredients] = useState<any[]>([]);
  const [homegrownIngredients, setHomegrownIngredients] = useState<any[]>([]);
  const [lowCostFlavorings, setLowCostFlavorings] = useState<any[]>([]);
  const [expenseIngredients, setExpenseIngredients] = useState<any[]>([]);
  const [dtcValue, setDtcValue] = useState<number>(100.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExpenseDropdown, setShowExpenseDropdown] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch DTC value
        const currentDtc = await getCurrentDtcValue();
        setDtcValue(currentDtc);
        
        // Fetch ingredients
        const [nearDtc, likelyToUse, homegrown, lowCostFlavorings, expense] = await Promise.all([
          getNearDtcIngredients(),
          getLikelyToUseIngredients(),
          getHomegrownIngredients(),
          getLowCostFlavorings(),
          getExpenseIngredients()
        ]);
        
        setNearDtcIngredients(nearDtc);
        setLikelyToUseIngredients(likelyToUse);
        setHomegrownIngredients(homegrown);
        setLowCostFlavorings(lowCostFlavorings);
        setExpenseIngredients(expense);
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load food budget data');
        setLoading(false);
        console.error('Error loading food budget data:', err);
      }
    };

    fetchData();
  }, []);

  const handleNavigate = (view: View) => {
    navigate(view);
  };

  const handleIngredientClick = (ingredientId: number) => {
    handleNavigate({ type: 'food-budget-ingredient-detail', ingredientId });
  };

  if (loading) {
    return (
      <div className="page food-budget-home">
        <h1>Food Budget</h1>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page food-budget-home">
        <h1>Food Budget</h1>
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page food-budget-home">
      <h1>Food Budget</h1>
      
      <div className="food-budget-header">
        <div className="budget-summary">
          <div className="summary-card">
            <h3>DTC Threshold</h3>
            <p>{dtcValue.toFixed(2)}</p>
          </div>
          <div className="summary-card">
            <h3>Ingredients Near Threshold</h3>
            <p>{nearDtcIngredients.length}</p>
          </div>
          <div className="summary-card">
            <h3>Likely To Use</h3>
            <p>{likelyToUseIngredients.length}</p>
          </div>
        </div>
      </div>

      <div className="food-budget-section">
        <h2>Likely To Use Ingredients</h2>
        <div className="ingredients-grid">
          {likelyToUseIngredients.map((ingredient) => (
            <div 
              key={ingredient.id} 
              className={`ingredient-card ${ingredient.classification.toLowerCase()}`}
              onClick={() => handleIngredientClick(ingredient.id)}
            >
              <h3>{ingredient.name}</h3>
              <p className="category">{ingredient.category}</p>
              {ingredient.calories_per_dollar !== undefined && (
                <p className="calories-per-dollar">Calories/Dollar: {ingredient.calories_per_dollar.toFixed(2)}</p>
              )}
              <span className={`classification-badge ${ingredient.classification.toLowerCase()}`}>
                {ingredient.classification}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="food-budget-section">
        <h2>Homegrown Ingredients</h2>
        <div className="ingredients-grid">
          {homegrownIngredients.map((ingredient) => (
            <div 
              key={ingredient.id} 
              className={`ingredient-card ${ingredient.classification.toLowerCase()}`}
              onClick={() => handleIngredientClick(ingredient.id)}
            >
              <h3>{ingredient.name}</h3>
              <p className="category">{ingredient.category}</p>
              {ingredient.calories_per_dollar !== undefined && (
                <p className="calories-per-dollar">Calories/Dollar: {ingredient.calories_per_dollar.toFixed(2)}</p>
              )}
              <span className={`classification-badge ${ingredient.classification.toLowerCase()}`}>
                {ingredient.classification}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="food-budget-section">
        <h2>Low-cost Flavorings</h2>
        <div className="ingredients-grid">
          {lowCostFlavorings.map((ingredient) => (
            <div 
              key={ingredient.id} 
              className={`ingredient-card ${ingredient.classification.toLowerCase()}`}
              onClick={() => handleIngredientClick(ingredient.id)}
            >
              <h3>{ingredient.name}</h3>
              <p className="category">{ingredient.category}</p>
              {ingredient.calories_per_dollar !== undefined && (
                <p className="calories-per-dollar">Calories/Dollar: {ingredient.calories_per_dollar.toFixed(2)}</p>
              )}
              <span className={`classification-badge ${ingredient.classification.toLowerCase()}`}>
                {ingredient.classification}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="food-budget-section">
        <h2 onClick={() => setShowExpenseDropdown(!showExpenseDropdown)}>
          Expense Ingredients {showExpenseDropdown ? '▲' : '▼'}
        </h2>
        {showExpenseDropdown && (
          <div className="ingredients-grid">
            {expenseIngredients.map((ingredient) => (
              <div 
                key={ingredient.id} 
                className={`ingredient-card ${ingredient.classification.toLowerCase()}`}
                onClick={() => handleIngredientClick(ingredient.id)}
              >
                <h3>{ingredient.name}</h3>
                <p className="category">{ingredient.category}</p>
                {ingredient.calories_per_dollar !== undefined && (
                  <p className="calories-per-dollar">Calories/Dollar: {ingredient.calories_per_dollar.toFixed(2)}</p>
                )}
                <span className={`classification-badge ${ingredient.classification.toLowerCase()}`}>
                  {ingredient.classification}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="food-budget-actions">
        <button onClick={() => handleNavigate({ type: 'food-budget-home' })}>
          Refresh
        </button>
        <button onClick={() => handleNavigate({ type: 'food-budget-settings' })}>
          Settings
        </button>
        <button onClick={() => handleNavigate({ type: 'food-budget-monthly-planner' })}>
          Monthly Planner
        </button>
        <button onClick={() => handleNavigate({ type: 'food-budget-recipe-view', recipeId: 1 })}>
          Recipes
        </button>
      </div>
    </div>
  );
};

export default FoodBudgetHomePage;