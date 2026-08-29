import { CSSProperties } from "react";
import { FieldLayoutRow, FieldStylePatch } from "../db/fieldLayout";

// Translates a field_layout row's per-page style overrides into inline
// style objects — the one place this mapping lives, reused by every
// Dream/Project/Goal detail page plus FreetextFieldEditor and the date
// field components, instead of four copies of the same ternaries. Every
// key is independently nullable, so a field with nothing customized
// yet resolves to `{}` (i.e. no visual change from before this existed).

export function contentStyle(f: FieldLayoutRow): CSSProperties {
  const style: CSSProperties = {};
  if (f.contentFontSize != null) style.fontSize = `${f.contentFontSize}px`;
  if (f.contentColor) style.color = f.contentColor;
  if (f.contentBackgroundColor) style.backgroundColor = f.contentBackgroundColor;
  if (f.contentRadius != null) style.borderRadius = `${f.contentRadius}px`;
  if (f.contentBorderColor) {
    style.borderColor = f.contentBorderColor;
    style.borderStyle = "solid";
  }
  if (f.contentBorderWidth != null) {
    style.borderWidth = `${f.contentBorderWidth}px`;
    style.borderStyle = style.borderStyle ?? "solid";
  }
  return style;
}

export function headerStyle(f: FieldLayoutRow): CSSProperties {
  const style: CSSProperties = {};
  if (f.headerFontSize != null) style.fontSize = `${f.headerFontSize}px`;
  if (f.headerColor) style.color = f.headerColor;
  if (f.headerBold) style.fontWeight = 700;
  if (f.headerUnderline) style.textDecoration = "underline";
  return style;
}

// Optimistically folds a FieldStyleControls patch into a field row for
// local state, so the popover reflects the change immediately instead
// of waiting on a full page reload — the actual persistence
// (updateFieldStyle) runs independently, same fire-and-forget convention
// as every other autosaving field in these pages.
export function mergeFieldStylePatch(f: FieldLayoutRow, patch: FieldStylePatch): FieldLayoutRow {
  const next: FieldLayoutRow = { ...f };
  if (patch.contentFontSize !== undefined) next.contentFontSize = patch.contentFontSize;
  if (patch.contentColor !== undefined) next.contentColor = patch.contentColor;
  if (patch.contentBackgroundColor !== undefined) next.contentBackgroundColor = patch.contentBackgroundColor;
  if (patch.contentRadius !== undefined) next.contentRadius = patch.contentRadius;
  if (patch.contentBorderColor !== undefined) next.contentBorderColor = patch.contentBorderColor;
  if (patch.contentBorderWidth !== undefined) next.contentBorderWidth = patch.contentBorderWidth;
  if (patch.headerFontSize !== undefined) next.headerFontSize = patch.headerFontSize;
  if (patch.headerColor !== undefined) next.headerColor = patch.headerColor;
  if (patch.headerBold !== undefined) next.headerBold = !!patch.headerBold;
  if (patch.headerUnderline !== undefined) next.headerUnderline = !!patch.headerUnderline;
  if (patch.showOnWeb !== undefined) next.showOnWeb = !!patch.showOnWeb;
  if (patch.webHeader !== undefined) next.webHeader = !!patch.webHeader;
  return next;
}
