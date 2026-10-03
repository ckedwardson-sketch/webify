# Food Budget Python Backend

This directory contains the Python backend components for the Food Budget feature in Webify.

## Modules

### classification_engine.py
Handles ingredient classification based on DTC thresholds and determines if ingredients are ADTC (Above DTC), Expense, or Homegrown.

### inflation_engine.py
Manages inflation calculations and future projections for ingredients and DTC values.

### notification_scheduler.py
Handles scheduling and sending notifications for reclassification events.

### ai_engine.py
Provides AI-powered ingredient matching, density estimation, and nutrition lookup.

### food_budget_main.py
Main entry point that handles commands from Tauri.

## Usage

The Python backend is invoked by Tauri through command-line arguments. Each command corresponds to a function in the various engines.

Example usage:
```bash
python food_budget_main.py classify_ingredient 123
```

## Integration

This Python backend integrates with the Tauri application through the `@tauri-apps/plugin-process` or similar mechanisms to execute Python scripts and receive structured output.