# Phase 03: Settings and notifications

Prerequisite: phases 00 to 02 are complete.

## Context: what the audit found
- `FoodBudgetSettingsPage.tsx` loads and saves only the DTC. Inflation rate, notification mode, warning days, and warning weeks are local state with hard-coded defaults and are never read from or saved to the database (the page comment says "we'll use defaults").
- The DTC history is not displayed anywhere (`getDtcHistory` has no caller).
- There is no notification bell, no notification list, no unread count, and no read/unread handling. Nothing reads the `notifications` table.
- There is no scheduler: no check on app launch and no daily timer.
- Warning and Double-warn modes have no implementation.

## Tasks
1. Add `getFoodBudgetSettings()` and `saveFoodBudgetSettings()` in the data layer for inflation rate, notification mode, warning days, and warning weeks. Validate (rate between 0 and 1, days and weeks non-negative integers; Warning needs days > 0; Double warn needs days > 0 and weeks > 0).
2. Settings page: load and save all fields from the database. Saving a changed DTC must go through `updateDtcValue` (phase 01). Show the DTC history list (value and effective date). Show validation errors inline and a clear saved confirmation.
3. Notification data layer: `getNotifications()`, `getUnreadCount()`, `markRead(id)`, `markAllRead()`.
4. Bell icon in the top right of the Food Budget section, with a red unread count badge when greater than zero. Clicking opens a list (newest first); clicking an item marks it read and opens that ingredient's detail view.
5. Scheduler (`runNotificationCheck()`): for each collection ingredient (not flavoring, not homegrown), use `projectedCrossingDate` (phase 01) to get the projected reclassification date, then by mode:
   - Urgent: only real reclassification notifications (already created in phase 01).
   - Warning: also a notice when the date is within `warning_days`.
   - Double warn: a notice at `warning_weeks` before, then at `warning_days` before.
   Use `warning_stage` (`'weeks'`, `'days'`, `'event'`) so each stage fires once per ingredient and projected event; do not repeat on later runs. If the projected date moves (for example after a new purchase), allow the stages to fire again for the new date.
6. Run `runNotificationCheck()` on Food Budget launch and on a daily timer while the app is open. Clean up the timer on unmount.
7. Tests: settings validation; a Warning-mode ingredient close to its projected crossing produces one days notice and no duplicate on a second run; Double warn produces weeks, then days, then event in that order; Urgent mode produces no advance notices; marking read updates the unread count.

## Done when
- Changing the DTC in settings moves an affected ingredient between lists, raises the bell count by the right number, and running the check twice creates no duplicates.
- Every settings field persists across an app restart.
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
