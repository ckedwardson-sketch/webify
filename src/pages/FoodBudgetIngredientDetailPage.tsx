import React, { useState, useEffect } from 'react';
import { getIngredientById, getIngredientPurchases, getCaloriesPerDollarForIngredient, getDeals, addDeal, deleteDeal, getUsdaApiKey, saveUsdaApiKey, searchUsdaFoodData, parseUsdaResponse } from '../db/foodBudgetUtils';
import { FoodBudgetIngredientForm } from '../components/FoodBudgetIngredientForm';
import { FoodBudgetLogPurchaseForm } from '../components/FoodBudgetLogPurchaseForm';
import './Page.css';
import './FoodBudgetIngredientDetailPage.css';

export const FoodBudgetIngredientDetailPage: React.FC<{ view: { type: 'food-budget-ingredient-detail'; ingredientId: number } }> = ({ view }) => {
  const [ingredient, setIngredient] = useState<any>(null);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showLogPurchaseForm, setShowLogPurchaseForm] = useState(false);
  const [showAddDealForm, setShowAddDealForm] = useState(false);
  const [usdaApiKey, setUsdaApiKey] = useState<string>('');
  const [showUsdaApiKeyForm, setShowUsdaApiKeyForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedNutrition, setSelectedNutrition] = useState<any>(null);
  const [showNutritionForm, setShowNutritionForm] = useState(false);

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
        
        // Fetch deals
        const fetchedDeals = await getDeals(view.ingredientId);
        setDeals(fetchedDeals);
        
        // Fetch USDA API key
        const apiKey = await getUsdaApiKey();
        setUsdaApiKey(apiKey || '');
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load ingredient data');
        setLoading(false);
        console.error('Error loading ingredient data:', err);
      }
    };

    fetchData();
  }, [view.ingredientId]);

  const handleEditSubmit = async (formData: any) => {
    // In a real app, this would call an update function
    console.log('Editing ingredient with data:', formData);
    setShowEditForm(false);
    // Reload data to refresh the view
    window.location.reload();
  };

  const handleLogPurchaseSubmit = async (formData: any) => {
    // In a real app, this would call a purchase logging function
    console.log('Logging purchase with data:', formData);
    setShowLogPurchaseForm(false);
    // Reload data to refresh the view
    window.location.reload();
  };

  const handleAddDealSubmit = async (formData: any) => {
    try {
      // Add deal to database
      await addDeal(view.ingredientId, formData.type, formData.data, formData.imagePaths);
      
      // Refresh deals list
      const fetchedDeals = await getDeals(view.ingredientId);
      setDeals(fetchedDeals);
      
      setShowAddDealForm(false);
    } catch (err) {
      console.error('Error adding deal:', err);
      setError('Failed to add deal');
    }
  };

  const handleDeleteDeal = async (dealId: number) => {
    try {
      await deleteDeal(dealId);
      
      // Refresh deals list
      const fetchedDeals = await getDeals(view.ingredientId);
      setDeals(fetchedDeals);
    } catch (err) {
      console.error('Error deleting deal:', err);
      setError('Failed to delete deal');
    }
  };

  const handleSaveUsdaApiKey = async (apiKey: string) => {
    try {
      await saveUsdaApiKey(apiKey);
      setUsdaApiKey(apiKey);
      setShowUsdaApiKeyForm(false);
    } catch (err) {
      console.error('Error saving USDA API key:', err);
      setError('Failed to save USDA API key');
    }
  };

  const handleSearchUsda = async (term: string) => {
    try {
      const results = await searchUsdaFoodData(term);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (err) {
      console.error('Error searching USDA data:', err);
      setError('Failed to search USDA data');
    }
  };

  const handleSelectNutrition = async (nutrition: any) => {
    try {
      const parsedNutrition = parseUsdaResponse(nutrition);
      setSelectedNutrition(parsedNutrition);
      setShowSearchResults(false);
      setShowNutritionForm(true);
    } catch (err) {
      console.error('Error parsing USDA response:', err);
      setError('Failed to parse USDA response');
    }
  };

  const handleSaveNutrition = async (nutritionData: any) => {
    try {
      // In a real implementation, this would update the ingredient's nutrition_json
      console.log('Saving nutrition data:', nutritionData);
      setShowNutritionForm(false);
      setSelectedNutrition(null);
      // Reload data to refresh the view
      window.location.reload();
    } catch (err) {
      console.error('Error saving nutrition:', err);
      setError('Failed to save nutrition data');
    }
  };

  const dealTypes = {
    'in_store_with_coupon': {
      id: 'in_store_with_coupon',
      label: 'In-store with Coupon',
      fields: ['store', 'aisle', 'product_name', 'product_image', 'coupon_details']
    },
    'in_store': {
      id: 'in_store',
      label: 'In-store',
      fields: ['store', 'aisle', 'product_name']
    },
    'online': {
      id: 'online',
      label: 'Online',
      fields: ['link', 'screenshot', 'text_coupon_area']
    }
  };

  // Simple chart function to show dollars per calorie over time
  const renderChart = () => {
    // For now, we'll show a placeholder - in a real implementation we would 
    // create a proper chart using SVG or a charting library
    if (!ingredient || !purchases || purchases.length === 0) {
      return (
        <div className="chart-placeholder">
          <p>No purchase data available to display chart</p>
        </div>
      );
    }

    // In a real implementation, we would calculate and plot:
    // 1. Dollars per calorie for the ingredient over time (based on last purchase)
    // 2. DTC line over time (converted to dollars per calorie)
    return (
      <div className="chart-container">
        <h3>Cost Efficiency Over Time</h3>
        <p className="chart-description">Dollars per calorie vs DTC threshold</p>
        <div className="simple-chart-placeholder">
          <p>Chart would show:</p>
          <ul>
            <li>Ingredient's cost efficiency (dollars per calorie) over time</li>
            <li>DTC threshold line (converted to dollars per calorie)</li>
            <li>Projected values based on inflation</li>
          </ul>
          <p className="chart-note">Real implementation would show an SVG chart</p>
        </div>
      </div>
    );
  };

  // Calculate calories per dollar for a specific purchase
  const calculateCaloriesPerDollarForPurchase = (purchase: any) => {
    // This would be calculated based on the actual nutrition data and purchase info
    // In a real implementation, we would:
    // 1. Get nutrition data from the ingredient
    // 2. Calculate calories from purchase amount
    // 3. Divide by price to get calories per dollar
    
    // For now, return placeholder
    return 'Calculating...';
  };

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
      
      {showEditForm && (
        <FoodBudgetIngredientForm 
          ingredient={ingredient}
          onSubmit={handleEditSubmit}
          onCancel={() => setShowEditForm(false)} 
        />
      )}

      {showLogPurchaseForm && (
        <FoodBudgetLogPurchaseForm 
          ingredientId={ingredient.id}
          onSubmit={handleLogPurchaseSubmit}
          onCancel={() => setShowLogPurchaseForm(false)} 
        />
      )}

      <div className="ingredient-header">
        <div className="ingredient-info">
          <p><strong>Category:</strong> {ingredient.category}</p>
          <p><strong>Density:</strong> {ingredient.density_g_per_cup} g/cup</p>
          <p><strong>Health Info:</strong> {ingredient.health_blurb}</p>
          <p><strong>In Collection:</strong> {ingredient.in_collection ? 'Yes' : 'No'}</p>
          <p><strong>Is Flavoring:</strong> {ingredient.is_flavoring ? 'Yes' : 'No'}</p>
        </div>
        
        <div className="ingredient-actions">
          <button onClick={() => setShowEditForm(true)}>Edit Ingredient</button>
          <button onClick={() => setShowLogPurchaseForm(true)}>Add Purchase</button>
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
                    {calculateCaloriesPerDollarForPurchase(purchase)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart Section */}
      <div className="ingredient-section">
        <h2>Cost Efficiency Chart</h2>
        {renderChart()}
      </div>

      {/* Deals Section */}
      <div className="ingredient-section">
        <div className="section-header">
          <h2>Saved Deals</h2>
          <button onClick={() => setShowAddDealForm(true)}>Add Deal</button>
        </div>
        
        {showAddDealForm && (
          <div className="deal-form">
            <h3>Add New Deal</h3>
            <div className="deal-type-selector">
              <label>Select Deal Type:</label>
              <select onChange={(e) => {
                const selectedType = e.target.value;
                // In a real implementation, this would populate the form based on the deal type
                console.log('Selected deal type:', selectedType);
              }}>
                <option value="">Select Deal Type</option>
                {Object.values(dealTypes).map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </div>
            <div className="deal-form-fields">
              {/* Form fields would be populated based on selected deal type */}
              <p>Form fields would be dynamically generated based on deal type selection</p>
            </div>
            <div className="deal-form-actions">
              <button onClick={() => setShowAddDealForm(false)}>Cancel</button>
              <button onClick={() => {
                // In a real implementation, this would submit the form data
                console.log('Submitting deal form...');
              }}>Save Deal</button>
            </div>
          </div>
        )}

        {deals.length > 0 ? (
          <div className="deals-list">
            {deals.map((deal) => (
              <div key={deal.id} className="deal-item">
                <div className="deal-header">
                  <span className="deal-type">{dealTypes[deal.type]?.label || deal.type}</span>
                  <button onClick={() => handleDeleteDeal(deal.id)}>Delete</button>
                </div>
                <div className="deal-details">
                  {deal.type_specific_json && (
                    <pre>{JSON.stringify(JSON.parse(deal.type_specific_json), null, 2)}</pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No deals saved for this ingredient.</p>
        )}
      </div>

      {/* Health Index Section */}
      <div className="ingredient-section">
        <h2>Health Index</h2>
        {ingredient.health_blurb ? (
          <div className="health-blurb">
            <p>{ingredient.health_blurb}</p>
          </div>
        ) : (
          <p>No health information available.</p>
        )}
        
        {ingredient.nutrition_json ? (
          <div className="nutrition-facts">
            <h3>Nutrition Facts</h3>
            <pre>{JSON.stringify(JSON.parse(ingredient.nutrition_json), null, 2)}</pre>
          </div>
        ) : (
          <div className="nutrition-placeholder">
            <p>No nutrition data available.</p>
            <button onClick={() => setShowSearchResults(true)}>Search USDA Data</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FoodBudgetIngredientDetailPage;