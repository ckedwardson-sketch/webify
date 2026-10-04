# Phase 01: Core logic and tests

Prerequisite: phase 00 is complete and its tests pass.

## Context: what the audit found
- `updateDtcValue` saves the **old** DTC with today's date into `dtc_history` and never records the new value. It skips reclassification unless the change is greater than 1.0.
- `reclassifyAllIngredients` is an empty stub: it computes a classification, discards it, and has a comment saying it is "for demonstration purposes". It creates no notifications.
- Nothing in the codebase inserts into the `notifications` table. `logPurchase` does not trigger any reclassification check.
- `classifyIngredient` returns `'Expense'` for flavorings (the plan says they are ignored), returns `'Expense'` as a fallback when there is no purchase, and decides Homegrown by whether a calories-per-dollar value exists rather than by the ingredient's category.
- `getCaloriesPerGramForIngredient` falls back to returning `homegrown_calories_per_dollar` as if it were calories per gram (wrong unit).
- `updateIngredient` numbers its placeholders by the index of the key in the input object, not by the position in the params array, so an input like `{ name: undefined, category: "x" }` or one with an unrecognized key produces mismatched `$n` and params.
- "Last purchase" queries use `ORDER BY date DESC` with no tie-breaker.
- `getLikelyToUseIngredients` is just an alias of `getNearDtcIngredients`.
- `density_user_edited` exists in the schema but nothing reads or sets it.
- No shared inflation/projection code exists anywhere (Python was deleted without porting it).

## Tasks
1. **Classification** in one place (`classifyIngredient` and a pure helper that takes data and returns the class, so it is easy to test):
   - Flavorings (`is_flavoring = 1`): return a distinct result (for example `'Flavoring'`), never ADTC/Expense. Exclude them from every count and list.
   - Homegrown: decided by `category === 'Homegrown'` only. Cost per gram = calories per gram / `homegrown_calories_per_dollar`. Remove the fallback that returns cal/$ as cal/g.
   - Otherwise ADTC if last-purchase calories per dollar >= DTC, else Expense. If there is no purchase or no nutrition data, return `'Unclassified'` rather than Expense.
   - Guard `price <= 0` and `amount_grams <= 0`.
   - Last purchase: `ORDER BY date DESC, id DESC` everywhere.
2. **`updateDtcValue(new)`**: in one transaction, (a) compute every collection ingredient's classification, (b) write the new DTC to `food_budget_settings`, (c) insert the **new** value into `dtc_history` with its effective date, (d) compute classifications again using the same connection so they see the new DTC, (e) for each ingredient whose class changed, insert a `notifications` row (`type = 'reclassified'`, ingredient id, a readable message, `warning_stage = 'event'`). Remove the `> 1.0` guard. Insert history exactly once, not once per ingredient.
3. **`logPurchase`**: after inserting, compare the ingredient's class before and after and create a notification if it changed.
4. **`updateIngredient`**: build placeholders from the params array length (`$${params.length}` after each push), skip `undefined` values, and ignore unknown keys. Add support for `density_user_edited` and `in_collection`. Add `density_user_edited` to the SELECT lists that return ingredients.
5. **`in_collection` semantics**: add `setInCollection(id, bool)`. Replace `getLikelyToUseIngredients` with a real function: ingredients with `in_collection = 1`, not flavorings, whose class is ADTC or whose calories per dollar is within 25% below the DTC. Make `getNearDtcIngredients` mean only the "within 25% below" band (not ADTC). Do not return flavorings from either.
6. **Projection** (`src/db/foodBudgetProjection.ts`, pure functions, no DB): `grow(value, fromDate, toDate, annualRate)` and `projectIngredientCostPerCalorie(...)` and `projectDtcCostPerCalorie(...)`, following the decision in the general scope (dollars per calorie; DTC as 1/DTC; the same `grow`). Add `projectedCrossingDate`, which returns the date an ingredient's line would cross the DTC line under the current settings, or `null` if it never does.
7. **Tests** (extend the phase 00 harness) covering: ADTC/Expense/Homegrown/Flavoring/Unclassified; the near-DTC boundary exactly at 25% below and just outside it; a DTC change that flips two ingredients produces exactly two notifications and exactly one new history row holding the new value; a purchase that flips an ingredient produces one notification; same-day purchases use the later id; partial and multi-field `updateIngredient`; inflation alone never makes the two projected lines cross.

## Done when
- All new and existing tests pass.
- `grep -n "demonstration" src/db/` returns nothing.
- Querying `dtc_history` after one DTC change shows the original seed row plus exactly one new row with the new value.

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
