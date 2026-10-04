import React, { useState, useEffect } from 'react';
import { getCurrentDtcValue, updateDtcValue, getFoodBudgetSettings, saveFoodBudgetSettings, getDtcHistory } from '../db/foodBudgetUtils';
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
  const [dtcHistory, setDtcHistory] = useState<Array<{id: number, dtc_value: number, effective_date: string}>>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Load current settings from database
        const currentDtcValue = await getCurrentDtcValue();
        setDtcValue(currentDtcValue);
        
        // Load all settings
        const settings = await getFoodBudgetSettings();
        setInflationRate(settings.inflation_rate);
        setNotificationMode(settings.notification_mode);
        setWarningDays(settings.warning_days);
        setWarningWeeks(settings.warning_weeks);
        
        // Load DTC history
        const history = await getDtcHistory();
        setDtcHistory(history);
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load settings data');
        setLoading(false);
        console.error('Error loading settings:', err);
      }
    };

    fetchData();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);
      
      // Save all settings to database
      await saveFoodBudgetSettings({
        dtc_value: dtcValue,
        inflation_rate: inflationRate,
        notification_mode: notificationMode,
        warning_days: warningDays,
        warning_weeks: warningWeeks
      });
      
      // Save DTC value to database (keep existing behavior)
      await updateDtcValue(dtcValue);
      
      setSaveSuccess(true);
      setSaving(false);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save settings');
      setSaving(false);
      console.error('Error saving settings:', err);
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

      <div className="settings-section">
        <h2>DTC History</h2>
        <div className="dtc-history">
          {dtcHistory.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>DTC Value</th>
                  <th>Effective Date</th>
                </tr>
              </thead>
              <tbody>
                {dtcHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.dtc_value.toFixed(2)}</td>
                    <td>{new Date(entry.effective_date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No history available</p>
          )}
        </div>
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