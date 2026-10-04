import React, { useState } from 'react';
import { View } from '../types/nav';
import { useNavigate } from 'react-router-dom';
import './FoodBudgetIngredientForm.css';

interface IngredientFormData {
  name: string;
  category: string;
  density_g_per_cup: number;
  health_blurb: string;
  in_collection: boolean;
  is_flavoring: boolean;
}

interface FoodBudgetIngredientFormProps {
  ingredient?: any; // Could be undefined for new ingredient
  onSubmit: (formData: IngredientFormData) => Promise<void>;
  onCancel: () => void;
}

export const FoodBudgetIngredientForm: React.FC<FoodBudgetIngredientFormProps> = ({ 
  ingredient, 
  onSubmit, 
  onCancel 
}) => {
  const [formData, setFormData] = useState<IngredientFormData>({
    name: ingredient?.name || '',
    category: ingredient?.category || '',
    density_g_per_cup: ingredient?.density_g_per_cup || 0,
    health_blurb: ingredient?.health_blurb || '',
    in_collection: ingredient?.in_collection || false,
    is_flavoring: ingredient?.is_flavoring || false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <div className="ingredient-form-modal">
      <div className="ingredient-form-content">
        <h2>{ingredient ? 'Edit Ingredient' : 'Add New Ingredient'}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              <option value="">Select a category</option>
              <option value="Produce">Produce</option>
              <option value="Meat">Meat</option>
              <option value="Dairy">Dairy</option>
              <option value="Grains">Grains</option>
              <option value="Pantry">Pantry</option>
              <option value="Homegrown">Homegrown</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="density_g_per_cup">Density (g/cup)</label>
            <input
              type="number"
              id="density_g_per_cup"
              name="density_g_per_cup"
              value={formData.density_g_per_cup}
              onChange={handleChange}
              min="0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="health_blurb">Health Blurb</label>
            <textarea
              id="health_blurb"
              name="health_blurb"
              value={formData.health_blurb}
              onChange={handleChange}
              rows={3}
            />
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="in_collection"
                checked={formData.in_collection}
                onChange={handleChange}
              />
              In Collection
            </label>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="is_flavoring"
                checked={formData.is_flavoring}
                onChange={handleChange}
              />
              Is Flavoring
            </label>
          </div>

          <div className="form-actions">
            <button type="submit">Save Ingredient</button>
            <button type="button" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};