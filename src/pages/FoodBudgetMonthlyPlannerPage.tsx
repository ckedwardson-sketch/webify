import React, { useState, useEffect } from 'react';
import './Page.css';
import './FoodBudgetMonthlyPlannerPage.css';
import { getOrCreateMealPlan, getMealPlanEntries, setMealPlanEntries, calculateMealMixPercentages, calculateIngredientSources, calculateMealPlanCostBreakdown, calculateTotalPlannedServings } from '../db/foodBudget';
import { getAllRecipes } from '../db/recipes';

export const FoodBudgetMonthlyPlannerPage: React.FC<{ view: { type: 'food-budget-monthly-planner'; year?: number; month?: number } }> = ({ view }) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [mealPlanId, setMealPlanId] = useState<number | null>(null);
  const [mealsPerDay, setMealsPerDay] = useState<number>(3);
  const [recipes, setRecipes] = useState<Array<{ id: number; name: string }>>([]);
  const [mealPlanEntries, setMealPlanEntriesState] = useState<Array<{ recipe_id: number; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [mealMixData, setMealMixData] = useState<Array<{
    recipe_id: number;
    recipe_name: string;
    percentage: number;
    total_servings: number;
  }>>([]);
  const [sourceMixData, setSourceMixData] = useState<{
    adtcPercentage: number;
    homegrownPercentage: number;
    expensePercentage: number;
    unclassifiedPercentage: number;
  }>({ adtcPercentage: 0, homegrownPercentage: 0, expensePercentage: 0, unclassifiedPercentage: 0 });
  const [costBreakdown, setCostBreakdown] = useState<{
    totalEstimatedCost: number;
    costPerMeal: number;
    costPerDay: number;
    mostExpensiveRecipe: { name: string; cost: number } | null;
    expenseIngredients: Array<{ name: string; cost: number }>;
    incompleteCostRecipes: Array<{ name: string }>;
  } | null>(null);
  const [totalServings, setTotalServings] = useState<number>(0);
  const [expectedServings, setExpectedServings] = useState<number>(0);

  // Load data for the current month
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Get current month/year for the plan
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1; // JS months are 0-indexed
        const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
        
        // Get or create meal plan
        const mealPlan = await getOrCreateMealPlan(monthStr, mealsPerDay);
        setMealPlanId(mealPlan.id);
        
        // Load recipes
        const allRecipes = await getAllRecipes();
        setRecipes(allRecipes);
        
        // Load meal plan entries
        const entries = await getMealPlanEntries(mealPlan.id);
        setMealPlanEntriesState(entries);
        
        // Calculate derived data
        const mealMix = await calculateMealMixPercentages(mealPlan.id);
        setMealMixData(mealMix);
        
        const sourceMix = await calculateIngredientSourceMix(mealPlan.id);
        setSourceMixData(sourceMix);
        
        const costBreakdownResult = await calculateMealPlanCostBreakdown(mealPlan.id);
        setCostBreakdown(costBreakdownResult);
        
        const totalServingsResult = await calculateTotalPlannedServings(mealPlan.id);
        setTotalServings(totalServingsResult);
        
        // Calculate expected servings (meals per day * days in month)
        const daysInMonth = new Date(year, month, 0).getDate();
        setExpectedServings(mealsPerDay * daysInMonth);
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load meal plan data');
        setLoading(false);
      }
    };

    loadData();
  }, [currentDate, mealsPerDay]);

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const handleMealsPerDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setMealsPerDay(value);
    }
  };

  const handleRecipeCountChange = (recipeId: number, count: number) => {
    if (count < 0) count = 0;
    
    setMealPlanEntriesState(prev => {
      const existingEntryIndex = prev.findIndex(entry => entry.recipe_id === recipeId);
      if (existingEntryIndex >= 0) {
        // Update existing entry
        const updated = [...prev];
        updated[existingEntryIndex] = { ...updated[existingEntryIndex], count };
        return updated;
      } else {
        // Add new entry
        return [...prev, { recipe_id: recipeId, count }];
      }
    });
  };

  const saveMealPlan = async () => {
    if (mealPlanId === null) return;
    
    try {
      setSaving(true);
      await setMealPlanEntries(mealPlanId, mealPlanEntries);
      
      // Recalculate derived data after save
      const mealMix = await calculateMealMixPercentages(mealPlanId);
      setMealMixData(mealMix);
      
      const sourceMix = await calculateIngredientSourceMix(mealPlanId);
      setSourceMixData(sourceMix);
      
      const costBreakdownResult = await calculateMealPlanCostBreakdown(mealPlanId);
      setCostBreakdown(costBreakdownResult);
      
      const totalServingsResult = await calculateTotalPlannedServings(mealPlanId);
      setTotalServings(totalServingsResult);
      
      // Calculate expected servings (meals per day * days in month)
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const daysInMonth = new Date(year, month, 0).getDate();
      setExpectedServings(mealsPerDay * daysInMonth);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save meal plan');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getDayNames = (): string[] => {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  };

  const getCalendarDays = (): { day: number; isEmpty: boolean }[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    const days = [];
    
    // Previous month's days
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, isEmpty: true });
    }
    
    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isEmpty: false });
    }
    
    // Next month's days
    const totalCells = 42; // 6 rows * 7 days
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isEmpty: true });
    }
    
    return days;
  };

  if (loading) {
    return (
      <div className="page food-budget-monthly-planner">
        <h1>Monthly Planner</h1>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page food-budget-monthly-planner">
        <h1>Monthly Planner</h1>
        <div className="error">{error}</div>
      </div>
    );
  }

  const days = getCalendarDays();
  const dayNames = getDayNames();

  return (
    <div className="page food-budget-monthly-planner">
      <h1>Monthly Planner</h1>
      
      <div className="planner-header">
        <button onClick={handlePrevMonth}>&lt; Prev</button>
        <h2>{formatDate(currentDate)}</h2>
        <button onClick={handleNextMonth}>Next &gt;</button>
      </div>

      <div className="input-section">
        <div className="meals-per-day-input">
          <label htmlFor="mealsPerDay">Meals per day:</label>
          <input 
            id="mealsPerDay"
            type="number" 
            value={mealsPerDay}
            onChange={handleMealsPerDayChange}
            min="0"
            max="10"
          />
        </div>
        
        <button onClick={saveMealPlan} disabled={saving}>
          {saving ? 'Saving...' : 'Save Plan'}
        </button>
        {saveSuccess && <span className="save-success">Plan saved successfully!</span>}
      </div>

      <div className="calendar-grid">
        {/* Calendar header */}
        <div className="calendar-row calendar-header">
          {dayNames.map((day, index) => (
            <div key={index} className="calendar-cell">{day}</div>
          ))}
        </div>
        
        {/* Calendar days */}
        {Array.from({ length: 6 }).map((_, rowIndex) => (
          <div key={rowIndex} className="calendar-row">
            {days.slice(rowIndex * 7, rowIndex * 7 + 7).map((day, colIndex) => (
              <div 
                key={colIndex} 
                className={`calendar-cell ${day.isEmpty ? 'empty' : ''}`}
              >
                {day.day}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="planner-section">
        <h2>Meal Plan Configuration</h2>
        
        <div className="servings-summary">
          <p>Total Planned Servings: <strong>{totalServings}</strong></p>
          <p>Expected Servings: <strong>{expectedServings}</strong></p>
          {totalServings !== expectedServings && (
            <p className="warning">Warning: Planned servings ({totalServings}) do not match expected servings ({expectedServings})</p>
          )}
        </div>
        
        <div className="recipe-list">
          {recipes.map(recipe => {
            const entry = mealPlanEntries.find(e => e.recipe_id === recipe.id);
            const count = entry ? entry.count : 0;
            
            return (
              <div key={recipe.id} className="recipe-entry">
                <label htmlFor={`recipe-${recipe.id}`}>{recipe.name}</label>
                <input
                  id={`recipe-${recipe.id}`}
                  type="number"
                  value={count}
                  onChange={(e) => handleRecipeCountChange(recipe.id, parseInt(e.target.value) || 0)}
                  min="0"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="charts-section">
        <div className="chart-container">
          <h2>Meal Mix by Percentage</h2>
          <div className="bar-chart">
            {mealMixData.map((item, index) => (
              <div key={index} className="bar-item">
                <div className="bar-label">{item.recipe_name}</div>
                <div className="bar">
                  <div 
                    className="bar-fill" 
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
                <div className="bar-percentage">{item.percentage.toFixed(1)}%</div>
                <div className="bar-servings">{item.total_servings} servings</div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-container">
          <h2>Ingredient Sources (Weighted by Servings)</h2>
          <div className="source-bar-chart">
            <div className="source-bar-item">
              <div className="source-label">ADTC</div>
              <div className="source-bar">
                <div 
                  className="source-bar-fill adtc" 
                  style={{ width: `${sourceMixData.adtcPercentage}%` }}
                ></div>
              </div>
              <div className="source-percentage">{sourceMixData.adtcPercentage.toFixed(1)}%</div>
            </div>
            <div className="source-bar-item">
              <div className="source-label">Homegrown</div>
              <div className="source-bar">
                <div 
                  className="source-bar-fill homegrown" 
                  style={{ width: `${sourceMixData.homegrownPercentage}%` }}
                ></div>
              </div>
              <div className="source-percentage">{sourceMixData.homegrownPercentage.toFixed(1)}%</div>
            </div>
            <div className="source-bar-item">
              <div className="source-label">Expense</div>
              <div className="source-bar">
                <div 
                  className="source-bar-fill expense" 
                  style={{ width: `${sourceMixData.expensePercentage}%` }}
                ></div>
              </div>
              <div className="source-percentage">{sourceMixData.expensePercentage.toFixed(1)}%</div>
            </div>
            <div className="source-bar-item">
              <div className="source-label">Unclassified</div>
              <div className="source-bar">
                <div 
                  className="source-bar-fill unclassified" 
                  style={{ width: `${sourceMixData.unclassifiedPercentage}%` }}
                ></div>
              </div>
              <div className="source-percentage">{sourceMixData.unclassifiedPercentage.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {costBreakdown && (
        <div className="cost-breakdown-section">
          <h2>Cost Breakdown (Rough Estimate)</h2>
          <div className="cost-details">
            <p><strong>Total Estimated Cost:</strong> ${costBreakdown.totalEstimatedCost.toFixed(2)}</p>
            <p><strong>Cost Per Meal:</strong> ${costBreakdown.costPerMeal.toFixed(2)}</p>
            <p><strong>Most Expensive Recipe:</strong> {costBreakdown.mostExpensiveRecipe ? `${costBreakdown.mostExpensiveRecipe.name}: $${costBreakdown.mostExpensiveRecipe.cost.toFixed(2)}` : 'None'}</p>
            
            {costBreakdown.incompleteCostRecipes.length > 0 && (
              <div className="incomplete-cost-warning">
                <p><strong>Warning:</strong> The following recipes have incomplete cost data:</p>
                <ul>
                  {costBreakdown.incompleteCostRecipes.map((recipe, index) => (
                    <li key={index}>{recipe.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="planner-actions">
        <button>Add Meal</button>
        <button>Generate Weekly Plan</button>
        <button>Export Plan</button>
      </div>
    </div>
  );
};

export default FoodBudgetMonthlyPlannerPage;