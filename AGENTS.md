# Webify agent rules (read before every task)

Repo: C:\Users\ckedw\OneDrive\Desktop\app\Webify
Stack: Tauri + React/TypeScript + SQLite (@tauri-apps/plugin-sql, DB "sqlite:webify.db").
There is NO Python sidecar. All Food Budget logic is TypeScript in src\db\foodBudget*.ts.
Spec: docs\food_budget_fix_prompt.md. Re-read it when unsure. Do not work from memory of it.

## 1. Shell: old Windows PowerShell (5.x)
- Chain commands with `;` NEVER `&&` or `||`.
- Start every command with: `cd C:\Users\ckedw\OneDrive\Desktop\app\Webify;`
- NEVER use: grep, find, xargs, ls -la, cat, rm -r, head, tail, sed, awk, touch, which.
- Use instead:
  - search text:   `Select-String -Path src\db\*.ts -Pattern "word"`
  - list files:    `Get-ChildItem src\pages -Filter FoodBudget*`
  - read file:     use the view/read tool; or `Get-Content path -TotalCount 60`
  - file exists:   `Test-Path path`
  - delete file:   `Remove-Item path`
  - count lines:   `(Get-Content path).Count`
- ALWAYS give Select-String an explicit -Path. ALWAYS give Get-ChildItem an explicit folder.
- NEVER recurse from the repo root. NEVER touch node_modules, dist, target, .git.
- Cap output: end listings with `| Select-Object -First 40`.
- If a command prints more than ~100 lines, re-run it narrower. Do not continue with the flood in context.
- If a command prints nothing, say so. Do not assume it succeeded or hung. Do NOT send Ctrl-C or Ctrl-Z.
- If a command fails with a syntax error, fix the syntax ONCE using this file. Do not try the same wrong tool again.

## 2. Editing files
- Edit with str_replace on a SMALL, UNIQUE snippet. View the file right before editing.
- NEVER edit files through PowerShell string replacement or `Set-Content` on source files.
- One file at a time. Re-run the check after each edit.
- Do not rewrite a whole file to fix a small bug.

## 3. Verification (required before saying "done")
- Type check: `npx tsc --noEmit 2>&1 | Select-String "error TS" | Select-Object -First 20`
- Error count: `(npx tsc --noEmit 2>&1 | Select-String "error TS").Count`
- Tests: `npm run test:fb` (tests live in tests\foodbudget\, never delete them).
- Paste the real output line. No pasted output = not done.
- Never claim a phase or task is complete because the code "looks right".
- After 3 failed attempts on one problem: stop, paste the exact error, move on.

## 4. Honesty and scope
- Do only the task or phase you were given. Do NOT start the next phase.
- Do NOT add features not in the spec (e.g. budget summary cards).
- No mock data, no setTimeout fake loading, no console.log placeholders in src\pages\FoodBudget*.
- If you are unsure what the spec says, read it. If still unsure, ask. Do not invent a "USER_CONTEXT".
- Report PASS or FAIL per task with evidence. Do not use checkmark summaries.

## 5. Task tracker
- Valid statuses are exactly: `todo`, `in_progress`, `done`. Never `pending`.
- Only call the tracker when a status changes. Never reprint it otherwise.
- Mark `done` only after a passing pasted check.

## 6. Output style
- Do not repeat a sentence you already wrote.
- Do not announce an action without doing it in the same turn.
- Do not write READMEs or docs unless asked (except docs\FOOD_BUDGET_NOTES.md when the spec says so).

## 7. Schema facts (do not guess names)
- Homegrown value column: `homegrown_calories_per_dollar` (NOT per_cup).
- Tables: settings, dtc_history, ingredients, purchases, deals, recipes, recipe_ingredients, meal_plans, meal_plan_entries, notifications.
- Add columns to existing databases with `ensureColumn` (exported from src\db\database.ts), never only in CREATE TABLE.
- `in_collection` defaults to 0. `is_flavoring` is the single source of truth for flavorings.
- Nutrition is stored per 100 g.
- Before using a column name, confirm it with: `Select-String -Path src\db\foodBudget.ts -Pattern "column_name"`
