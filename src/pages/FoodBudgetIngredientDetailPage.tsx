import React, { useState, useEffect } from 'react';
import './Page.css';
import './FoodBudgetIngredientDetailPage.css';

export const FoodBudgetIngredientDetailPage: React.FC<{ view: { type: 'food-budget-ingredient-detail'; ingredientId: number } }> = (_) => {
  const [ingredient, setIngredient] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading data
    const fetchData = async () => {
      try {
        setLoading(true);
        // In a real implementation, this would call the backend API
        // const response = await fetch(`/api/food-budget/ingredients/${view.ingredientId}`);
        // const data = await response.json();
        // setIngredient(data.ingredient);
        // setPurchases(data.purchases);
        
        // Mock data for now
        setTimeout(() => {
          setIngredient({
            id: 1,
            name: 'Rice, White, Long Grain',
            category: 'Grains',
            is_flavoring: 0,
            density_g_per_cup: 195,
            health_blurb: 'Rich in carbohydrates and low in fat.',
            homegrown_calories_per_dollar: null,
            in_collection: 1
          });
          
          setPurchases([
            { id: 1, date: '2026-09-01', price: 2.99, amount_grams: 500, store: 'Walmart' },
            { id: 2, date: '2026-08-15', price: 3.49, amount_grams: 500, store: 'Target' },
            { id: 3, date: '2026-07-22', price: 2.79, amount_grams: 500, store: 'Whole Foods' },
          ]);
          
          setLoading(false);
        }, 500);
      } catch (err) {
        setError('Failed to load ingredient data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="page food-budget-ingredient-detail">
        <h1>Ingredient Detail</h1>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page food-budget-ingredient-detail">
        <h1>Ingredient Detail</h1>
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!ingredient) {
    return (
      <div className="page food-budget-ingredient-detail">
        <h1>Ingredient Detail</h1>
        <div className="error">Ingredient not found</div>
      </div>
    );
  }

  return (
    <div className="page food-budget-ingredient-detail">
      <h1>{ingredient.name}</h1>
      
      <div className="ingredient-header">
        <div className="ingredient-info">
          <p><strong>Category:</strong> {ingredient.category}</p>
          <p><strong>Density:</strong> {ingredient.density_g_per_cup} g/cup</p>
          <p><strong>Health Info:</strong> {ingredient.health_blurb}</p>
        </div>
        
        <div className="ingredient-actions">
          <button>Edit Ingredient</button>
          <button>Add Purchase</button>
        </div>
      </div>

      <div className="ingredient-section">
        <h2>Purchase History</h2>
        <div className="purchases-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Price</th>
                <th>Amount</th>
                <th>Store</th>
                <th>Calories/Dollar</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td>{purchase.date}</td>
                  <td>${purchase.price.toFixed(2)}</td>
                  <td>{purchase.amount_grams}g</td>
                  <td>{purchase.store}</td>
                  <td>120</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FoodBudgetIngredientDetailPage;