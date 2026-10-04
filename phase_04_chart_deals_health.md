# Phase 04: Chart, saved deals, health index

Prerequisite: phases 00 to 03 are complete.

## Context: what the audit found
- No chart exists on the ingredient detail page, and no charting dependency is used for it.
- The `deals` table exists but has no data helpers and no UI.
- The ingredient detail page prints `health_blurb` as raw text. There is no USDA lookup anywhere in the code: no API call, no cache, no key setting. An earlier mock "sample database" with fake numbers (dry and cooked rice both 130 kcal) was deleted; do not reintroduce fake values.
- `nutrition_json` is only ever filled by hand (and only once phase 02's form exists).

## Tasks
1. Chart on the ingredient detail page: dollars per calorie over time for the ingredient (projected from its last purchase price) against the DTC line (phase 01 projection functions). Use the app's existing charting approach if there is one; otherwise a small inline SVG chart is fine. Label axes and units. If there is no purchase or no nutrition data, show a message instead of an empty chart.
2. Deals data layer: `getDeals(ingredientId)`, `addDeal`, `deleteDeal`. Deal types are defined in one registry object (type id, label, field definitions) so a new type is added by adding one entry. Include the three plan types: In-store with coupon (store, aisle, product name, product image, coupon details), In-store (store, aisle, product name), Online (link, screenshot, text coupon area). Store type-specific fields in `type_specific_json` and image paths in `image_paths`.
3. Deals UI on the detail page: list, add (form generated from the registry), delete. Display only. **Deals must never feed into any cost or classification calculation**; add a test that proves adding a deal changes no classification or calories-per-dollar value.
4. USDA FoodData Central lookup: add a `usdaApiKey` field to the settings (and settings page), a function that searches by ingredient name, lets the user pick a result, and stores calories (per 100 g) and the nutrient facts in `nutrition_json`. If no key is set or the request fails, show a clear message and leave manual entry available. Never fall back to invented numbers. Network access is through the app's normal fetch mechanism; confirm it is permitted by the Tauri capabilities/CSP config and update it if needed.
5. Health index section: show the nutrition facts and a one or two sentence plain description in `health_blurb` (no numbers required). The description is entered or edited by the user; do not auto-generate it without a clearly labeled generate action.
6. Tests: the registry produces forms for all three deal types; deals do not affect cost math; the USDA response parser maps a saved sample response (stored as a fixture) to the expected `nutrition_json`.

## Done when
- A detail page for an ingredient with a purchase shows a real chart whose two lines do not cross under inflation alone.
- You can add, view, and delete one deal of each type.
- Nutrition can be filled from a USDA search (or, without a key, entered by hand) and then drives classification.
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
