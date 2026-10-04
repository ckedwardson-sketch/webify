import React, { useState, useEffect } from 'react';
import { getNearDtcIngredients, getLikelyToUseIngredients, getCurrentDtcValue } from '../db/foodBudgetUtils';
import './Page.css';
import './FoodBudgetHomePage.css';

export const FoodBudgetHomePage: React.FC<{ view: { type: 'food-budget-home' } }> = (_) => {
  const [nearDtcIngredients, setNearDtcIngredients] = useState<any[]>([]);
  const [likelyToUseIngredients, setLikelyToUseIngredients] = useState<any[]>([]);
  const [dtcValue, setDtcValue] = useState<number>(100.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch DTC value
        const currentDtc = await getCurrentDtcValue();
        setDtcValue(currentDtc);
        
        // Fetch near DTC ingredients
        const nearDtc = await getNearDtcIngredients();
        setNearDtcIngredients(nearDtc);
        
        // Fetch likely to use ingredients
        const likelyToUse = await getLikelyToUseIngredients();
        setLikelyToUseIngredients(likelyToUse);
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load food budget data');
        setLoading(false);
        console.error('Error loading food budget data:', err);
      }
    };

    fetchData();
  }, []);

  const handleNavigate = (page: string) => {
    // Navigation logic would go here
    console.log(`Navigating to ${page}`);
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
        <h2>Ingredients Near DTC Threshold</h2>
        <div className="ingredients-grid">
          {nearDtcIngredients.map((ingredient) => (
            <div 
              key={ingredient.id} 
              className={`ingredient-card ${ingredient.classification.toLowerCase()}`}
              onClick={() => handleNavigate(`ingredient/${ingredient.id}`)}
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
        <h2>Likely To Use Ingredients</h2>
        <div className="ingredients-grid">
          {likelyToUseIngredients.map((ingredient) => (
            <div 
              key={ingredient.id} 
              className={`ingredient-card ${ingredient.classification.toLowerCase()}`}
              onClick={() => handleNavigate(`ingredient/${ingredient.id}`)}
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

      <div className="food-budget-actions">
        <button onClick={() => handleNavigate('ingredients')}>
          Manage Ingredients
        </button>
        <button onClick={() => handleNavigate('recipes')}>
          View Recipes
        </button>
        <button onClick={() => handleNavigate('planner')}>
          Monthly Planner
        </button>
        <button onClick={() => handleNavigate('settings')}>
          Settings
        </button>
      </div>
    </div>
  );
};

export default FoodBudgetHomePage;