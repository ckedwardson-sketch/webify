# Webify — Master Bug & Feature Implementation Plan

Status tracker for the full plan. Check items off as they land. See conversation
history / commits for rationale on each phase.

## Philosophy
Fix the underlying object model first (Goal vs Passion Project Goal, Task vs
Output, Note vs Output, page fields vs layout config, detail-page widgets vs
Web widgets, node appearance vs node data, task completion data vs
presentation). Extend existing systems (theme registry, widget/rearrange
infra, page config) rather than building parallel ones.

## Explicitly out of scope
- Expanding/rebuilding global search
- Contextual-action/triple-dot/right-click redesign
- The "Passion Project" UI item from the original screenshot (unrelated)
- Saved equations for Calculator (placeholder button only)
- Adaptive/automatic widget placement based on usage frequency
- Unrelated navigation redesign
- Future Output ideas beyond what's specified here

## Phases
- [ ] Phase 1 — Passion Project Goal classification (object model + nav/history)
- [ ] Phase 2 — Output system (Task -> Output, editor, node, detail page)
- [ ] Phase 3 — Labor-type visual differentiation + legend
- [ ] Phase 4 — Notes as Web shortcuts (Goal Web / Dream Web references)
- [ ] Phase 5 — Completed Task detail-page overhaul (name, image containment, cost/time)
- [ ] Phase 6 — Task cost system + Cost Log widget
- [ ] Phase 7 — Extend existing Widget system to Webs (standalone Web widgets)
- [ ] Phase 8 — Calculator widget
- [ ] Phase 9 — Per-field persistent sizing (per page instance + field id)
- [ ] Phase 10 — Page Options mode (columns, layout, card sizing, section visibility)
- [ ] Phase 11 — Renameable text field labels (custom_label over field_id)
- [ ] Phase 12 — AI-assisted field autofill (reusable suggestion interface)
- [ ] Phase 13 — Graph zoom/node expansion transform-origin bug
- [ ] Phase 14 — Web edge/link deletion without deleting nodes
- [ ] Phase 15 — Rearrange support for Task pages
- [ ] Phase 16 — Sidebar/history responsive layout overlap fix
- [ ] Phase 17 — Integrate Outputs/Notes/Widgets into Goal/Passion Project/Dream Webs
- [ ] Phase 18 — Universal theme integration pass (Outputs, labor types, widgets, page options)

## Recommended order (from plan)
Stage 1 Audit -> Stage 2 Semantic corrections (Phase 1, 14, 4) -> Stage 3 Output
architecture (Phase 2) -> Stage 4 Labor visualization (Phase 3) -> Stage 5 Task
overhaul (Phase 5, 15) -> Stage 6 Cost system (Phase 6) -> Stage 7 Calculator
(Phase 8) -> Stage 8 Generic Web-widget extension (Phase 7) -> Stage 9 Page
customization (Phase 10) -> Stage 10 Field customization (Phase 9, 11) ->
Stage 11 AI autofill (Phase 12) -> Stage 12 Graph/layout fixes (Phase 13) ->
Stage 13 Navigation/layout polish (Phase 16) -> Final integration (Phase 17, 18).

## Definition of done
- **Data layer**: DB distinguishes Goal / Passion Project Goal / Project / Task /
  Output / Note / Cost / Widget instance / Web relationship.
- **Application layer**: navigation, relationships, persistence, history,
  editing, Web behavior all respect those distinctions.
- **Presentation layer**: node appearance, icons, colors, layout, Output
  presentation, widgets, page/field customization make the distinctions legible.
