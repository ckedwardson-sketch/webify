import React, { useState, useEffect } from 'react';
import './Page.css';
import './FoodBudgetHomePage.css';

export const FoodBudgetHomePage: React.FC<{ view: { type: 'food-budget-home' } }> = (_) => {
  const [nearDtcIngredients, setNearDtcIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading data
    const fetchData = async () => {
      try {
        setLoading(true);
        // In a real implementation, this would call the backend API
        // const response = await fetch('/api/food-budget/near-dtc');
        // const data = await response.json();
        // setNearDtcIngredients(data);
        
        // Mock data for now
        setTimeout(() => {
          setNearDtcIngredients([
            { id: 1, name: 'Rice', category: 'Grains', calories_per_dollar: 120, classification: 'ADTC' },
            { id: 2, name: 'Chicken Breast', category: 'Meat', calories_per_dollar: 95, classification: 'ADTC' },
            { id: 3, name: 'Broccoli', category: 'Vegetables', calories_per_dollar: 85, classification: 'Expense' },
          ]);
          setLoading(false);
        }, 500);
      } catch (err) {
        setError('Failed to load food budget data');
        setLoading(false);
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
            <h3>Total Budget</h3>
            <p>$1,200.00</p>
          </div>
          <div className="summary-card">
            <h3>Spent This Month</h3>
            <p>$850.00</p>
          </div>
          <div className="summary-card">
            <h3>Remaining</h3>
            <p>$350.00</p>
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
              <p className="calories-per-dollar">Calories/Dollar: {ingredient.calories_per_dollar}</p>
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