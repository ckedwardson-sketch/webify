import React, { useState, useEffect } from 'react';
import './Page.css';
import './FoodBudgetSettingsPage.css';

export const FoodBudgetSettingsPage: React.FC<{ view: { type: 'food-budget-settings' } }> = (_) => {
  const [dtcValue, setDtcValue] = useState<number>(100.0);
  const [inflationRate, setInflationRate] = useState<number>(0.02);
  const [notificationMode, setNotificationMode] = useState<string>('urgent');
  const [warningDays, setWarningDays] = useState<number>(0);
  const [warningWeeks, setWarningWeeks] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading data
    const fetchData = async () => {
      try {
        setLoading(true);
        // In a real implementation, this would call the backend API
        // const response = await fetch('/api/food-budget/settings');
        // const data = await response.json();
        // setDtcValue(data.dtcValue);
        // setInflationRate(data.inflationRate);
        // setNotificationMode(data.notificationMode);
        // setWarningDays(data.warningDays);
        // setWarningWeeks(data.warningWeeks);
        
        // Mock data for now
        setTimeout(() => {
          setDtcValue(100.0);
          setInflationRate(0.02);
          setNotificationMode('urgent');
          setWarningDays(0);
          setWarningWeeks(0);
          setLoading(false);
        }, 500);
      } catch (err) {
        setError('Failed to load settings data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      
      // In a real implementation, this would call the backend API
      // const response = await fetch('/api/food-budget/settings', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     dtcValue,
      //     inflationRate,
      //     notificationMode,
      //     warningDays,
      //     warningWeeks
      //   })
      // });
      
      // Mock save for now
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setSaveSuccess(true);
      setSaving(false);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save settings');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page food-budget-settings">
        <h1>Food Budget Settings</h1>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page food-budget-settings">
        <h1>Food Budget Settings</h1>
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="page food-budget-settings">
      <h1>Food Budget Settings</h1>
      
      <div className="settings-section">
        <h2>Budget Configuration</h2>
        <div className="setting-group">
          <label htmlFor="dtcValue">Dollar-to-Calorie Threshold (DTC)</label>
          <input
            type="number"
            id="dtcValue"
            value={dtcValue}
            onChange={(e) => setDtcValue(parseFloat(e.target.value))}
            step="0.1"
          />
          <p className="help-text">Set the threshold above which ingredients are considered ADTC (Above Dollar-to-Calorie)</p>
        </div>
        
        <div className="setting-group">
          <label htmlFor="inflationRate">Annual Inflation Rate</label>
          <input
            type="number"
            id="inflationRate"
            value={inflationRate}
            onChange={(e) => setInflationRate(parseFloat(e.target.value))}
            step="0.001"
            min="0"
            max="1"
          />
          <p className="help-text">Percentage increase in food prices per year</p>
        </div>
      </div>

      <div className="settings-section">
        <h2>Notifications</h2>
        <div className="setting-group">
          <label htmlFor="notificationMode">Notification Mode</label>
          <select
            id="notificationMode"
            value={notificationMode}
            onChange={(e) => setNotificationMode(e.target.value)}
          >
            <option value="urgent">Urgent</option>
            <option value="warning">Warning</option>
            <option value="double_warn">Double Warning</option>
          </select>
          <p className="help-text">How notifications are triggered for reclassification events</p>
        </div>
        
        {notificationMode !== 'urgent' && (
          <>
            <div className="setting-group">
              <label htmlFor="warningDays">Days Before Warning</label>
              <input
                type="number"
                id="warningDays"
                value={warningDays}
                onChange={(e) => setWarningDays(parseInt(e.target.value) || 0)}
                min="0"
              />
              <p className="help-text">Number of days before projected reclassification to warn</p>
            </div>
            
            <div className="setting-group">
              <label htmlFor="warningWeeks">Weeks Before Warning</label>
              <input
                type="number"
                id="warningWeeks"
                value={warningWeeks}
                onChange={(e) => setWarningWeeks(parseInt(e.target.value) || 0)}
                min="0"
              />
              <p className="help-text">Number of weeks before projected reclassification to warn</p>
            </div>
          </>
        )}
      </div>

      <div className="settings-actions">
        <button 
          onClick={handleSave} 
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saveSuccess && <div className="success-message">Settings saved successfully!</div>}
      </div>
    </div>
  );
};

export default FoodBudgetSettingsPage;