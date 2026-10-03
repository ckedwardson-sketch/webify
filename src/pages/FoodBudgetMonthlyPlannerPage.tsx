import React, { useState, useEffect } from 'react';
import './Page.css';
import './FoodBudgetMonthlyPlannerPage.css';

export const FoodBudgetMonthlyPlannerPage: React.FC<{ view: { type: 'food-budget-monthly-planner'; year?: number; month?: number } }> = (_) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [mealPlan, setMealPlan] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading data
    const fetchData = async () => {
      try {
        setLoading(true);
        // In a real implementation, this would call the backend API
        // const response = await fetch(`/api/food-budget/planner/${year}-${month}`);
        // const data = await response.json();
        // setMealPlan(data);
        
        // Mock data for now
        setTimeout(() => {
          setMealPlan([
            { day: 1, meals: ['Breakfast: Oatmeal', 'Lunch: Chicken Salad', 'Dinner: Beef Stir Fry'] },
            { day: 5, meals: ['Breakfast: Pancakes', 'Lunch: Sandwich', 'Dinner: Pasta'] },
            { day: 10, meals: ['Breakfast: Yogurt', 'Lunch: Soup', 'Dinner: Fish'] },
            { day: 15, meals: ['Breakfast: Smoothie', 'Lunch: Wrap', 'Dinner: Pork Chops'] },
            { day: 20, meals: ['Breakfast: Toast', 'Lunch: Salad', 'Dinner: Chicken Curry'] },
            { day: 25, meals: ['Breakfast: Scrambled Eggs', 'Lunch: Burrito', 'Dinner: Steak'] },
            { day: 30, meals: ['Breakfast: Cereal', 'Lunch: Pizza', 'Dinner: Tacos'] },
          ]);
          setLoading(false);
        }, 500);
      } catch (err) {
        setError('Failed to load meal plan data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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

  return (
    <div className="page food-budget-monthly-planner">
      <h1>Monthly Planner</h1>
      
      <div className="planner-header">
        <button onClick={handlePrevMonth}>&lt; Prev</button>
        <h2>{formatDate(currentDate)}</h2>
        <button onClick={handleNextMonth}>Next &gt;</button>
      </div>

      <div className="calendar-grid">
        {/* Calendar header */}
        <div className="calendar-row calendar-header">
          <div className="calendar-cell">Sun</div>
          <div className="calendar-cell">Mon</div>
          <div className="calendar-cell">Tue</div>
          <div className="calendar-cell">Wed</div>
          <div className="calendar-cell">Thu</div>
          <div className="calendar-cell">Fri</div>
          <div className="calendar-cell">Sat</div>
        </div>
        
        {/* Calendar days - simplified for demo */}
        <div className="calendar-row">
          <div className="calendar-cell empty"></div>
          <div className="calendar-cell empty"></div>
          <div className="calendar-cell empty"></div>
          <div className="calendar-cell empty"></div>
          <div className="calendar-cell empty"></div>
          <div className="calendar-cell empty"></div>
          <div className="calendar-cell">1</div>
        </div>
        <div className="calendar-row">
          <div className="calendar-cell">2</div>
          <div className="calendar-cell">3</div>
          <div className="calendar-cell">4</div>
          <div className="calendar-cell">5</div>
          <div className="calendar-cell">6</div>
          <div className="calendar-cell">7</div>
          <div className="calendar-cell">8</div>
        </div>
        <div className="calendar-row">
          <div className="calendar-cell">9</div>
          <div className="calendar-cell">10</div>
          <div className="calendar-cell">11</div>
          <div className="calendar-cell">12</div>
          <div className="calendar-cell">13</div>
          <div className="calendar-cell">14</div>
          <div className="calendar-cell">15</div>
        </div>
        <div className="calendar-row">
          <div className="calendar-cell">16</div>
          <div className="calendar-cell">17</div>
          <div className="calendar-cell">18</div>
          <div className="calendar-cell">19</div>
          <div className="calendar-cell">20</div>
          <div className="calendar-cell">21</div>
          <div className="calendar-cell">22</div>
        </div>
        <div className="calendar-row">
          <div className="calendar-cell">23</div>
          <div className="calendar-cell">24</div>
          <div className="calendar-cell">25</div>
          <div className="calendar-cell">26</div>
          <div className="calendar-cell">27</div>
          <div className="calendar-cell">28</div>
          <div className="calendar-cell">29</div>
        </div>
        <div className="calendar-row">
          <div className="calendar-cell">30</div>
          <div className="calendar-cell">31</div>
          <div className="calendar-cell empty"></div>
          <div className="calendar-cell empty"></div>
          <div className="calendar-cell empty"></div>
          <div className="calendar-cell empty"></div>
          <div className="calendar-cell empty"></div>
        </div>
      </div>

      <div className="meal-plan-section">
        <h2>Meal Plan</h2>
        <div className="meal-plan-list">
          {mealPlan.map((dayPlan) => (
            <div key={dayPlan.day} className="meal-plan-day">
              <h3>Day {dayPlan.day}</h3>
              <ul>
                {dayPlan.meals.map((meal: string, index: number) => (
                  <li key={index}>{meal}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="planner-actions">
        <button>Add Meal</button>
        <button>Generate Weekly Plan</button>
        <button>Export Plan</button>
      </div>
    </div>
  );
};

export default FoodBudgetMonthlyPlannerPage;