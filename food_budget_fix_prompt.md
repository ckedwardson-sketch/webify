# Food Budget: fix pass (follow in order, one phase at a time)

You previously built the Food Budget feature from "Food Budget Plan v4". An audit found the app fails to start and most of the feature is mock data or unwired. Fix it in the phases below. Do not move to the next phase until the current one's **Done when** checks pass. Do not add features that are not in the plan (for example the "Total Budget / Spent / Remaining" cards on the home page).

Rules for the whole task:
- The plan is the source of truth. If something is ambiguous, pick the simplest reading and note it in a short `docs/FOOD_BUDGET_NOTES.md`.
- No mock data, no `setTimeout` fake loading, no `console.log` placeholders in shipped pages.
- Every phase must be verified by running the app (or a real test against the real migrations), not by reading the code.
- After each phase, report what you changed and how you verified it.

---

## Phase 0: Make the app start (blocker)

**Error:** `DATABASE INITIALIZATION FAILED: no such table: recipe_ingredients` (App.tsx:383).

Cause: `src/db/foodBudget.ts` runs `ALTER TABLE recipe_ingredients ADD COLUMN ...`, but no migration ever creates that table.

1. Remove the `add_food_budget_columns_to_recipe_ingredients` block entirely (the `is_homegrown` / `is_expense` columns are derived from classification and must not be stored).
2. Add a migration that creates the table from the plan:
   ```sql
   CREATE TABLE IF NOT EXISTS recipe_ingredients (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
     ingredient_id INTEGER REFERENCES ingredients(id) ON DELETE SET NULL,
     grams REAL,
     original_unit_text TEXT,
     sort_order INTEGER NOT NULL DEFAULT 0
   )
   ```
3. Add `servings INTEGER` to `recipes` (plan: recipe has original text and servings).
4. Add `density_user_edited INTEGER NOT NULL DEFAULT 0` to `ingredients` (plan: density with a user-edited flag, never overwritten once set).
5. In `database.ts`, move the `runFoodBudgetMigrations(db)` call to the **end** of `runMigrations`, so a food-budget failure can never block the app's other migrations.
6. Seed `dtc_history` with the initial DTC value when the settings row is first seeded.
7. Remove the now-unused `cost_per_serving` and `source_breakdown` columns from the plan of record. Cost and source mix are computed on read, never cached (they go stale when prices change). Leave the columns alone if they already exist in someone's database, just stop using them.

**Done when:** a fresh database and an existing database both start with no errors, and `SELECT name FROM sqlite_master` shows `recipe_ingredients`. Add a test that runs the real migrations against an empty database and against a copy of an existing one.

---

## Phase 1: One backend, not two

Classification exists twice (TypeScript in `foodBudgetUtils.ts`, Python in `src-tauri/python/food_budget/`) and the two disagree. The Python code is also never run: there is no shell plugin, no `externalBin`, no Rust command, no capability entry.

**Default decision: consolidate into TypeScript.** The rest of the app already talks to SQLite from the frontend, so port the needed Python logic (classification, inflation/projection, notification checks, ingredient matching, density estimation) into `src/db/foodBudget*.ts` modules, then delete `src-tauri/python/` and the stray `hello_world.py` and `test_db.py`. (If the owner instead wants the Python sidecar, say so in your report and wire it fully before continuing; do not keep both.)

Do not copy the bugs below when porting. Fix them.

### 1a. Classification rules (single implementation)
- Flavorings (`is_flavoring = 1`) are **ignored**: not classified, not in the home list's main collection, excluded from source bars and recipe cost. Make `is_flavoring` the single source of truth and drop the `'Low-cost flavorings'` category string.
- Homegrown is decided by the ingredient being marked homegrown, not by a purchase existing. Its cost per gram = calories per gram ÷ its assigned calories per dollar (plan, assumption 3). The old code returned the cal/$ value from a calories-per-gram function, which is a unit error.
- ADTC if calories per dollar from the **last purchase** is at or above the DTC. Otherwise Expense. No purchase yet means "unclassified", not Expense.
- Near DTC = within 25% below the threshold, plus anything above it (plan, assumption 4).
- Guard against `price <= 0` and `amount_grams <= 0`.
- Last purchase ordering: `ORDER BY date DESC, id DESC`.

### 1b. DTC changes and reclassification
- `updateDtcValue(new)` must, in one transaction: record the **new** value in `dtc_history` with its effective date, update the settings row, then compute reclassifications.
- Compute each ingredient's classification **before** the change and **after** it, using the same transaction/connection so the "after" sees the new DTC. (The old Python version used separate connections, so old and new were always identical and no change was ever detected.)
- Insert history **once**, not once per ingredient.
- For every ingredient whose classification changed, create a `notifications` row (type, ingredient_id, message, created date, stage). This also applies when a new purchase changes an ingredient's class. Hook it into `logPurchase`.

### 1c. `updateIngredient` bug
It hardcodes placeholders (`category = $2`, `density = $4`, ...) while pushing params sequentially, so any partial update breaks. Build placeholders from the running params length (`$${params.length}`) so every field combination works. Add tests for single-field and multi-field updates.

### 1d. Inflation and projection
- One shared function: `project(value, fromDate, toDate, annualRate)`.
- Ingredient projected cost = last purchase price grown by inflation from the **purchase date**. The DTC line must use the same function. **Direction matters:** prices grow, so calories per dollar shrinks over time. If the chart plots calories per dollar, the DTC line must be *deflated* by the same factor (DTC / (1+r)^t), not grown. Simplest correct approach: plot **dollars per calorie** (ingredient price growth vs. DTC converted to dollars per calorie and grown by the same function) so both lines rise together and inflation alone never crosses them. State which you chose in the notes file.

### 1e. Nutrition, forms and matching
- Replace the hardcoded 8-item "sample_database" with a real USDA FoodData Central lookup (API key stored in settings; cache the result in `nutrition_json`). If the lookup is unavailable, leave nutrition empty and let the user type it. Never fall back to fake numbers. In the old sample data, dry and cooked rice were both 130 kcal, which is wrong.
- Store nutrition **per 100 g** and say so in one place; calories per gram = value / 100.
- Matching: use whole-word / normalized comparison, not substring checks (`'rice'` matched `'price'`, `'oil'` matched `'boil'`). **Respect the form** in the name: if an imported line says "cooked" and only "dry" exists, do **not** match. Flag it and offer to create "X, cooked" (plan section 3).
- Density: one lookup table with real entries, one pass (the old "exact" and "partial" loops were identical). Cache per ingredient and **never overwrite** when `density_user_edited = 1`.

### 1f. Collection behavior
- `in_collection` defaults to **0**. Only ingredients the user explicitly adds appear in the home "likely to use" list. Ingredients created by recipe import must not auto-populate it.
- Remove the `getLikelyToUseIngredients` alias. It returns the collection filtered to ADTC or near, excluding flavorings.

**Done when:** automated tests cover: ADTC/Expense/Homegrown/flavoring classification, near-DTC boundary (exactly 25% below), DTC change producing exactly one history row and the right notifications, partial `updateIngredient`, cooked-vs-dry matching refusal, and the projection lines not crossing under inflation alone.

---

## Phase 2: Settings, home page, notifications UI (plan phase 2)

Replace mock data with the Phase 1 data layer.

- **Settings page:** load and save DTC (with history list), annual inflation rate, notification mode (Urgent / Warning / Double warn), warning days, warning weeks. Saving DTC goes through `updateDtcValue`.
- **Home page:** top "likely to use" collection (user-added only). Dropdowns below: Homegrown, Low-cost flavorings, and a hidden-away Expense dropdown. Clicking an ingredient pushes onto the app's existing page history to the ingredient detail view. Remove the budget summary cards and the dummy buttons.
- **Bell icon**, top right, with a red unread count. Opens the notification list, marks as read. Notification check runs on app launch and on a daily timer.
- **Notification modes:** every mode notifies on the actual reclassification. Warning adds "X days before a projected reclassification". Double warn adds "Y weeks before", then "X days before", then the event. Use the `warning_stage` column so nothing repeats. Implement the real projection-based checks, not `return []` stubs.

**Done when:** changing the DTC in settings visibly moves ingredients between the main list and Expense and raises the bell count; a repeat check does not duplicate notifications.

---

## Phase 3: Ingredient detail, deals, health index (plan phases 2 and 3)

- Add/edit ingredient, log purchase (store entered manually), one-tap repurchase of the last item.
- Chart: cost per calorie against the DTC line (Phase 1d approach), last purchase plus the shared inflation function.
- Purchase history table with the **real** calories per dollar per row (the old page hard-coded "120" in every row).
- Saved deals, display only, never used in cost math. Types: In-store with coupon, In-store, Online. Store type-specific fields as JSON; the type list must be extensible (add a type by adding one entry).
- Health index: nutrition facts from USDA plus a one or two sentence description of whether the food is healthy.

**Done when:** every number on this page traces to the database.

---

## Phase 4: Structured recipes and hot links (plan phase 4)

- Hot link syntax: `@Brown Rice ..250g`, `@White Flour ..2 cups`. Typing `@` opens autofill from the ingredient index; `..` starts the amount.
- Store as structured rows in `recipe_ingredients` (ingredient id, grams, original unit text). Grams are canonical; the original text is kept so "2 cups" still displays.
- Cups and tablespoons convert through the cached density. Gram input is the primary path.
- Recipe view: ingredients as hot links with amounts; cost per serving (grams × last-purchase price per gram; homegrown uses the assigned value); source bar showing the percentage **by ingredient count** from ADTC, Homegrown and Expense, excluding flavorings. Computed on read.
- Clicking a hot link opens the ingredient detail view via the existing history stack, and Back returns to the recipe.
- Plain-text ingredients remain allowed.

---

## Phase 5: Recipe import (plan phase 5)

Parse each line into name, amount and unit; match with confidence; low-confidence matches get a confirm-or-fix prompt; no match offers: scrap it, add to Low-cost flavorings, or enter DTC inputs (price and amount). Convert to grams, compute cost, save the structured recipe. The "back-apply hot links" button rewrites the original text.

## Phase 6: Monthly planner (plan phase 6)

Inputs: meals per day, then a count for each recipe. Bar 1: meal mix by percentage. Bar 2: ingredient sources (ADTC, Expense, Homegrown) weighted by planned servings. Written breakdown: total estimated cost, cost per meal, cost per day, most expensive recipe, and which expense ingredients drive the cost. Label it a rough estimate.

Phase 7 (per-ingredient forecasting, per-category DTC) is out of scope.

---

## Final checklist
- App starts clean on a new and an existing database.
- No mock data, `setTimeout` loaders or `console.log` stubs remain in `src/pages/FoodBudget*`.
- One implementation of classification, one of inflation.
- Tests exist for every item listed under "Done when".
- `docs/FOOD_BUDGET_NOTES.md` records each decision where the plan was ambiguous.
