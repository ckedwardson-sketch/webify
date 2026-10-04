import React, { useState } from 'react';
import './FoodBudgetLogPurchaseForm.css';

interface LogPurchaseFormData {
  date: string;
  price: number;
  amount_grams: number;
  store: string;
}

interface FoodBudgetLogPurchaseFormProps {
  ingredientId: number;
  onSubmit: (formData: LogPurchaseFormData) => Promise<void>;
  onCancel: () => void;
}

export const FoodBudgetLogPurchaseForm: React.FC<FoodBudgetLogPurchaseFormProps> = ({ 
  ingredientId,
  onSubmit, 
  onCancel 
}) => {
  const [formData, setFormData] = useState<LogPurchaseFormData>({
    date: new Date().toISOString().split('T')[0],
    price: 0,
    amount_grams: 0,
    store: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <div className="purchase-form-modal">
      <div className="purchase-form-content">
        <h2>Log Purchase for Ingredient</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="date">Date *</label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="price">Price ($) *</label>
            <input
              type="number"
              id="price"
              name="price"
              value={formData.price}
              onChange={handleChange}
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="amount_grams">Amount (grams) *</label>
            <input
              type="number"
              id="amount_grams"
              name="amount_grams"
              value={formData.amount_grams}
              onChange={handleChange}
              min="0"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="store">Store *</label>
            <input
              type="text"
              id="store"
              name="store"
              value={formData.store}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-actions">
            <button type="submit">Log Purchase</button>
            <button type="button" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};