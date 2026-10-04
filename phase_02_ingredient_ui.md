# Phase 02: Ingredient management UI and navigation

Prerequisite: phases 00 and 01 are complete.

## Context: what the audit found
- `FoodBudgetHomePage.tsx` reads real data but its `handleNavigate` only calls `console.log`, so nothing navigates. Its "Near DTC" and "Likely to use" sections currently show the same list.
- The page has no Homegrown, Low-cost flavorings, or Expense dropdowns.
- No UI exists to create an ingredient, edit one, add one to the collection, or log a purchase. Nothing in the codebase calls `createIngredient` or `logPurchase`, so the feature cannot be used end to end.
- `FoodBudgetIngredientDetailPage.tsx`: "Edit Ingredient" and "Add Purchase" buttons have no handlers; the Calories/Dollar column in the purchase table shows the literal text "Calculating..."; `getCaloriesPerDollarForIngredient` is imported but unused; the density line prints "undefined g/cup" when density is empty.
- The only places `food-budget-home` appears outside the page files are the view type, the title map, and the `App.tsx` switch. I found no menu item or button that opens the Food Budget section, so it may be unreachable from the UI.

## Tasks
1. Add an entry point so the user can open Food Budget from the app's existing navigation (follow how other sections are registered). Add links between home, settings, and detail using the app's existing view/history mechanism. Use `{ type: "food-budget-ingredient-detail", ingredientId }` for ingredient links and make Back return to the previous page.
2. Home page: show the DTC value and the "likely to use" collection from `getLikelyToUseIngredients`. Remove the duplicate "near DTC" section (or show it only if it is a distinct, clearly labeled list). Add dropdowns for Homegrown, Low-cost flavorings, and Expense (Expense hidden/collapsed by default). Each row is a link to the ingredient detail view.
3. Ingredient create/edit form (modal or page): name (with a hint to include the form, "Rice, dry"), category (Homegrown or not), flavoring checkbox, homegrown calories per dollar (only when Homegrown), density (grams per cup, optional), and an "add to collection" checkbox that sets `in_collection`. Editing density sets `density_user_edited = 1`.
4. Log-purchase form on the detail page: date (default today), price, amount with unit (grams primary; also oz and lb), store (free text). Calls `logPurchase` and refreshes the page, including the classification badge.
5. Detail page: show the current classification and calories per dollar; show the last purchase and a **one-tap repurchase** button that logs a new purchase with the same price, amount, and store dated today; compute and display a real calories-per-dollar value for **every** row of the purchase table (that purchase's grams and price with the ingredient's calories per gram); hide the density line when empty. If nutrition data is missing, show "No nutrition data" instead of a number.
6. Add/remove-from-collection control on the detail page.
7. Tests for the data helpers you add (unit conversion for the purchase form, repurchase creating the right row). Add at least one component-level test or a documented manual check for the navigation flow.

## Done when
- From a fresh database you can: open Food Budget from normal navigation, create an ingredient with nutrition entered by hand, add it to the collection, log a purchase, see it appear in the correct list on the home page, click it, and use Back to return.
- No `console.log` navigation stubs and no `Calculating...` text remain in `src/pages/FoodBudget*`.
- Tests pass.

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
