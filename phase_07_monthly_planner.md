# Phase 07: Monthly planner

Prerequisite: phases 00 to 06 are complete.

## Context: what the audit found
- `FoodBudgetMonthlyPlannerPage.tsx` is mock data behind a `setTimeout`. It does not read or write `meal_plans` or `meal_plan_entries` (both tables exist).
- No planner calculations exist: no meal mix, no weighted source mix, no cost breakdown.

## Tasks
1. Data layer: create/load a meal plan for a month (meals per day), and set the count of each recipe (`meal_plan_entries`). One plan per month.
2. Planner input UI: choose the month, set meals per day, then a count for each recipe (example: 3 servings a day with 8 pork and cabbage, 8 curry rice, 6 light mac and cheese). Show a running total of planned servings against meals per day times days in the month, and warn if they do not match (do not block saving).
3. Bar 1: meal mix by percentage (by planned servings).
4. Bar 2: ingredient sources (ADTC, Expense, Homegrown) weighted by planned servings, using each recipe's ingredient count mix from phase 05; flavorings excluded; Unclassified shown separately.
5. Written cost breakdown, computed on read: total estimated cost, cost per meal, cost per day, most expensive recipe, and which expense ingredients drive the cost (top contributors by cost). If any recipe has incomplete cost data (missing purchase), say so in the text instead of silently undercounting. Label it clearly as a rough estimate.
6. Tests: weighted percentages with known inputs; cost totals with a hand-calculated example; incomplete-cost recipe is flagged; month with 28, 30, and 31 days.

## Done when
- You can build a plan matching the example above and see both bars and the written breakdown with numbers that match the hand calculation in the tests.
- Plans persist across restarts.
- Tests pass.

After this phase the planned feature set is complete. Report the full list of plan items and their final status, and stop.

## Rules for this phase
- Do **only** the tasks in this file. Do not start any other phase, and do not add features that are not in the plan.
- No mock data, fake `setTimeout` loading, or `console.log` placeholders in code you touch.
- Verify by running real code (the app, or tests against the real migrations). Reading the code is not verification.
- **Report honestly.** An earlier pass reported work as complete that was not done (for example, a migration reported as moved when it was not, and a reclassification function that was an empty stub). Your final message must follow the **Completion report** format at the bottom of this task. Anything not done or not verified must say NOT DONE or NOT VERIFIED. Do not summarize in general terms.

## Completion report (required format)
For every numbered task above, one line: `Task N: DONE | NOT DONE | NOT VERIFIED` followed by evidence (file path and function name, plus the command or test output that proves it). Then list any files created or deleted and any decisions you made where the plan was ambiguous.

## STOP
When this phase's "Done when" checks pass, post the completion report and **stop**. Do not begin the next phase. Wait for the next instruction.

---
---

# GENERAL SCOPE (context only; do not treat as a task list)

This is background for the whole Food Budget feature of Webify (Tauri, TypeScript, React, SQLite). The tasks for **this phase** are only those listed above. Use this section to understand how your piece fits.

**Purpose.** Budget food monthly and decide what to buy. Every ingredient is judged by calories per dollar. The user sets a minimum, the **DTC** (dollar-to-calorie threshold, calories per dollar, higher is better). Ingredients that meet it are food; ingredients below it are expenses. Recipes and a monthly planner build on this.

**Categories.**
- **ADTC** (above DTC): meets or beats the DTC. Shown in the main collection.
- **Expense**: below the DTC. Same detail view, but kept in a hidden dropdown.
- **Homegrown**: not auto-classified; has a manually assigned calories-per-dollar value. Own dropdown. Cost per gram = calories per gram divided by assigned calories per dollar.
- **Low-cost flavorings** (`is_flavoring = 1`): ignored in classification, source bars, and recipe cost.
- **Near DTC**: within 25% below the threshold, plus anything above it. The main collection shows ingredients the user added that are ADTC or near. Nothing auto-populates it.

**Calories per dollar** comes from the last purchase: calories in the purchased grams divided by price. Nutrition is stored per 100 g.

**Forms.** The form is part of the ingredient name ("Rice, dry", "Rice, cooked"). Amounts and nutrition always use the same form. An imported "cooked rice" must never silently match "Rice, dry"; flag it and offer to create the cooked version.

**Settings.** DTC value with dated history; one annual inflation rate; notification mode with day and week values.

**Notification modes.** Urgent: notify when a reclassification happens. Warning: also X days before a projected one. Double warn: Y weeks before, then X days before, then the event. Every mode also notifies on the actual event. A bell icon (top right) shows a red unread count. Each stage fires once.

**Inflation and projection (decision made).** One shared function grows values over time. Because prices grow, calories per dollar shrinks. So charts plot **dollars per calorie**: ingredient projected cost = last purchase price grown by inflation from the purchase date; the DTC line is the DTC converted to dollars per calorie (1/DTC) grown by the same function. Inflation alone never crosses the lines. Reclassification comes from real events: a new purchase or a DTC change.

**Screens.** Home (likely-to-use collection, dropdowns for Homegrown / Low-cost flavorings / hidden Expense, bell). Ingredient detail (cost-per-calorie chart vs DTC, last purchase with one-tap repurchase and log-purchase, saved deals display-only, health index from USDA FoodData Central plus a one or two sentence description). Recipe view (source bar by ingredient count, hot-linked ingredients, cost per serving, back-apply button on imports). Monthly planner (meals per day and recipe counts, meal-mix bar, source bar weighted by servings, written cost breakdown, rough estimate). Clicking a hot link pushes onto the app's existing page history; Back returns.

**Saved deal types (extensible):** In-store with coupon (store, aisle, product, image, coupon details); In-store (store, aisle, product); Online (link, screenshot, text coupons).

**Hot links.** `@Brown Rice ..250g` or `@White Flour ..2 cups`. Typing `@` opens autofill from the ingredient index; `..` starts the amount. Stored as ingredient id, grams, and original unit text. Grams are canonical. Density is estimated once per ingredient, cached, and user edits are never overwritten (`density_user_edited`).

**Import pipeline.** Parse lines; match to existing ingredients with confidence (low confidence prompts confirm-or-fix); no match offers scrap / add to flavorings / enter price and amount; convert to grams; cost = grams times last-purchase price per gram; "back-apply" rewrites original text with hot links.

**Architecture.** TypeScript only. The Python sidecar was removed; its logic lives (or must live) in `src/db/foodBudget*.ts`. SQLite via `@tauri-apps/plugin-sql` through `getDb()`. Notification checks run on app launch and on a daily timer. Cost and source mix are computed on read, never cached.

**Phase order.** 00 Repair blockers, 01 Core logic and tests, 02 Ingredient management UI and navigation, 03 Settings and notifications, 04 Chart, deals, health index, 05 Structured recipes and hot links, 06 Import, matching, density, 07 Monthly planner. Out of scope: per-ingredient price forecasting and per-category DTC.
