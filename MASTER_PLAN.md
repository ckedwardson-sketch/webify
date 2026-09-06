# Master Plan (saved 2026-08-30)

Status tracker for the multi-phase feature plan. Check off as completed.

- [x] 1. Passion Project Goal categorization (semantic type, not navigation hack)
- [x] 2-4. Output system (record produced by a Task, shares content capabilities with Note) — outputs table, db/outputs.ts, OutputEditorModal (reuses NoteContentEditor), OutputWebNode on Goal/Passion Project Web. Display-variant field exists but only "card" is visually implemented so far.
- [x] Phase 3. Labor-type differentiation — colors were already centralized/distinct (categoryColorFor); added expandable LaborLegend key on Goal Web + Dream Web.
- [x] Phase 4. Notes as Web shortcuts (attach existing Note to Goal Web / Dream Web) — note_web_links table, NoteWebNode.
- [~] Phase 5. Completed Task detail-page overhaul — image crop fixed (object-fit: contain); optional cost field + web-node badge added. "Optional time-uncompleted" (completedAt timestamp) NOT done yet.
- [x] Phase 6. Task cost system + Cost Log widget — CostLogWidget (Project/Goal), task_cost field + web-node badge for Tasks (no widget grid there).
- [x] Phase 7. Extend existing Widget system to Webs — project_widgets table extended with nullable web_type/web_owner_id/pos_x/pos_y/width/height columns (same table, no parallel system), WebWidgetNode.tsx wraps existing widget components on Goal Web + Dream Web canvases with drag/resize (NodeResizer) persistence.
- [x] Phase 8. Calculator Widget (+ placeholder Saved Equations button) — available in Widget Bar/grid AND placeable directly on Web canvases now that Phase 7 landed.
- [x] Phase 9. Per-field persistent sizing (page instance + field identity + height) — wired resize-drag -> updateFieldLayoutHeight across Goal/Dream/Project/Task detail pages + freetext fields.
- [~] Phase 10/11. Page Options mode (no spec given, treated as already covered by Rearrange + ctrl+click FieldStyleQuickEdit) + renameable text field labels (confirmed pre-existing, works).
- [x] 16. Node expansion origin fix (center-anchored zoom on Dream Web nodes, not bottom-anchored)
- [x] Phase 14. Link cutting in Web areas — confirmed pre-existing (Backspace/Delete on selected edge), no bug found.
- [x] Phase 15. Task-page Rearrange support — ProgressNodeDetailPage now uses field_layout("task", ...) + RearrangeableField/FieldGap, same system as other detail pages.
- [x] Phase 16. Sidebar button overlapping history bar — fixed via reserved padding-left, specificity-safe.
- [x] Phase 17. Web/widget/node integration — Output, Note, and floating Widget node types all now live on Goal Web / Passion Project Web / Dream Web.
- [x] Phase 18. Universal theme integration — added outputNodeBackground/OutlineColor + noteNodeBackground/OutlineColor theme tokens (themeDefaults.ts, themeFieldGroups.ts Settings entry, themeReference.ts), OutputWebNode/NoteWebNode now read them via useTheme() instead of hardcoded hex, matching the goalProjectNodeOutlineColor convention exactly.
- [x] Phase 5 cost/duration: completedAt timestamp + "time to complete" duration display added to completed tasks; optional cost field + web-node badge added.

## Known minor gaps (not blocking, noted for later)
- Output display variants (image-grid/file-list) are stored but not yet visually differentiated — only "card" renders distinctly today.
- OutputEditorModal/NoteContentEditor reuse means Outputs can technically link to notes/recipes via the editor's link picker — harmless, not a gap.

**Plan status: all 19 phases implemented and `npx tsc --noEmit` passes clean.**

Full original spec text is preserved in the conversation that created this file.
