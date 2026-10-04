# Phase 06: Recipe import, matching, density estimation

Prerequisite: phases 00 to 05 are complete.

## Context: what the audit found
- No import pipeline exists in the food budget code. The Python AI engine (fuzzy matching, density table, mock nutrition) was deleted in the previous pass **without being ported**. Do not try to recover it; it also had bugs (substring matching, identical exact/partial loops, ignored the user-edited lock, matched "cooked" to "dry").
- There is already a recipe text extraction feature in `src-tauri/src/recipe_extract.rs` and the existing recipes UI. Read how recipes are currently created or imported and hook into that instead of duplicating it.
- No density table, no confidence scoring, and no "back-apply" exist.

## Tasks
1. Line parser: split an ingredient line into amount, unit, and name (handle fractions like 1/2, mixed numbers like 1 1/2, ranges like 2-3 (use the midpoint), parenthetical notes, and "to taste" lines).
2. Matcher with confidence: normalize names (lowercase, strip punctuation, split into whole words, drop plural endings), then score by whole-word overlap and edit distance. **No substring matching** (it matched "rice" inside "price"). Return the best match and a score from 0 to 1.
3. Form check (hard rule): if the line contains a form word (cooked, dry, raw, canned, frozen) that differs from the matched ingredient's form, do not match. Return a "form mismatch" result carrying the suggested new name (for example "Rice, cooked") and offer to create it.
4. Confirm-or-fix prompt UI for matches below a confidence threshold (default 0.8, a named constant), and for form mismatches. For no match, offer: scrap it, add it to Low-cost flavorings, or enter DTC inputs (price and amount, which creates a purchase).
5. Density estimation: one real lookup table of common ingredients (grams per cup) with whole-word keys, used once per ingredient and then cached in `density_g_per_cup`. Never overwrite when `density_user_edited = 1`. If no table entry exists, leave density empty and ask the user.
6. Conversion and save: convert every amount to grams (phase 05 module), then save as structured `recipe_ingredients` rows with the original unit text, and compute cost by the phase 05 function.
7. Back-apply button: for an imported recipe, rewrite its original ingredient text so each matched ingredient becomes a hot link (`@Name ..amount`), keeping the original unit text. Leave unmatched lines unchanged. The operation must be undoable (store the original text before rewriting).
8. Tests with fixtures: at least 20 realistic ingredient lines including fractions, ranges, and parentheticals; "cooked rice" with only "Rice, dry" present returns form mismatch; "price" never matches "rice"; density lock is respected; back-apply output re-parses to the same grams.

## Done when
- Importing a recipe with a cooked-rice line stops and offers to create "Rice, cooked" instead of matching dry rice.
- A full import results in a saved structured recipe with a cost per serving.
- Back-apply rewrites the text and the result parses back to the same ingredient ids and grams.
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
