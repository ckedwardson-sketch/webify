import React, { useState, useEffect } from 'react';
import { getIngredientById, getIngredientPurchases, getCaloriesPerDollarForIngredient } from '../db/foodBudgetUtils';
import './Page.css';
import './FoodBudgetIngredientDetailPage.css';

export const FoodBudgetIngredientDetailPage: React.FC<{ view: { type: 'food-budget-ingredient-detail'; ingredientId: number } }> = ({ view }) => {
  const [ingredient, setIngredient] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch ingredient data
        const fetchedIngredient = await getIngredientById(view.ingredientId);
        if (!fetchedIngredient) {
          throw new Error('Ingredient not found');
        }
        setIngredient(fetchedIngredient);
        
        // Fetch purchase history
        const fetchedPurchases = await getIngredientPurchases(view.ingredientId);
        setPurchases(fetchedPurchases);
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load ingredient data');
        setLoading(false);
        console.error('Error loading ingredient data:', err);
      }
    };

    fetchData();
  }, [view.ingredientId]);

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
                  <td>
                    {(() => {
                      // For now, we'll just show a placeholder - in a real app we'd calculate this
                      // The actual calculation would require a separate function to compute calories per dollar for each purchase
                      return 'Calculating...';
                    })()}
                  </td>
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