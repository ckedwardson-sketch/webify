# Phase 00: Repair blockers

An audit of the current code found these problems left over from the previous pass. This phase fixes only the blockers that crash the app or corrupt the schema. Logic changes come in phase 01.

## Context: what the audit found
- `src/db/foodBudgetUtils.ts`, `classifyIngredient`: the SQL selects `homegrown_calories_per_cup`, a column that does not exist (the real column is `homegrown_calories_per_dollar`). Every classification call throws `no such column`, which breaks the home page as soon as one ingredient exists.
- `src/db/database.ts`, `runMigrations`: `runFoodBudgetMigrations(db)` is still called **first** (comment "Run food budget migrations first"), not last. A failure in it blocks every later app migration.
- `src/db/foodBudget.ts`: three `ensureColumn` calls share one marker name (`"add_food_budget_recipe_columns"`). `ensureColumn` returns early once its marker is set, so only the first column (`cost_per_serving`) is ever added; `source_breakdown` never is. (`servings` already exists in the base `recipes` CREATE TABLE, so that one is harmless.)
- `ingredients.in_collection` defaults to 1 in the schema, and `createIngredient` hard-codes `1`.
- There is no automated test of any food budget code, and no test runner configured.

## Tasks
1. Fix the column name in `classifyIngredient`'s SELECT. Remove any other reference to a non-existent column (grep for `homegrown_calories_per_cup`).
2. Move the `runFoodBudgetMigrations(db)` call to the **end** of `runMigrations`, after every existing migration.
3. Remove the unused `cost_per_serving` and `source_breakdown` columns from the food budget migration (cost and source mix are computed on read). Do not drop them from databases that already have them. Replace the three-call block with nothing; no new recipe columns are needed.
4. Change `in_collection` so new ingredients default to **0** in the schema for fresh databases and `createIngredient` inserts `0` unless the caller passes an explicit flag. Add a small migration step that does not alter existing rows.
5. Add a test runner (Vitest) and a minimal test harness that runs the app's **real** `initDb`/`runMigrations` against a throwaway SQLite database (for example `better-sqlite3`, with a thin adapter that implements the same `select`/`execute` shape as `plugin-sql` and translates `$1`-style placeholders). Keep the harness in `src/db/__tests__/` so later phases can reuse it.
6. Write tests that: (a) run migrations on an empty database and assert every food budget table exists (`food_budget_settings`, `dtc_history`, `ingredients`, `recipe_ingredients`, `purchases`, `deals`, `meal_plans`, `meal_plan_entries`, `notifications`); (b) run migrations twice and assert it is idempotent; (c) create an ingredient and call `classifyIngredient` on it without throwing.
7. Delete the stray `test_db.py` at the repo root and `food_budget_fix_prompt.md` if they are no longer needed (confirm neither is referenced by any script first).

## Done when
- `npm run build` / `tsc` passes with no new errors.
- All tests from task 6 pass, and the test command is documented in `package.json` scripts.
- `grep -rn homegrown_calories_per_cup src/` returns nothing.
- In `runMigrations`, the food budget call is the last statement.

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
