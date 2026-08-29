import { useState } from "react";
import { FieldLayoutRow, FieldStylePatch, FIELD_TYPE_LABELS, isWebDisplayable, webFieldKind } from "../db/fieldLayout";
import "./FieldStyleFields.css";

// The actual "style this field" controls (font/color/background/border/
// header + the "On the web" visibility toggles) — bare content, no
// trigger button or popover chrome of its own. Rendered inside the
// Dynamic Settings panel by overlay/FieldStyleQuickEdit.tsx, opened via
// ctrl+click on the field itself (see RearrangeableField.tsx) rather
// than a permanently-visible on-page icon, to keep detail pages
// uncluttered. Every control is instant-apply (no Save button), matching
// the ThemeQuickEdit/ButtonQuickEdit convention already used elsewhere
// in the panel — `onSave` is expected to optimistically merge the patch
// into the caller's local field list (see rearrange/fieldStyle.ts's
// mergeFieldStylePatch) rather than a full page reload per keystroke.
export function FieldStyleFields({
  field,
  onSave,
}: {
  field: FieldLayoutRow;
  onSave: (patch: FieldStylePatch) => void;
}) {
  const hasContentOverride =
    field.contentFontSize != null ||
    field.contentColor != null ||
    field.contentBackgroundColor != null ||
    field.contentRadius != null ||
    field.contentBorderColor != null ||
    field.contentBorderWidth != null;
  const hasHeaderOverride =
    field.headerFontSize != null || field.headerColor != null || field.headerBold || field.headerUnderline;

  const numberOrNull = (raw: string): number | null => (raw === "" ? null : Number(raw));

  return (
    <div className="field-style-fields">
      <div className="field-style-section">
        <div className="field-style-section-title">Text &amp; box</div>
        <label className="field-style-row">
          <span>Font size</span>
          <input
            type="number"
            min={8}
            max={48}
            placeholder="default"
            value={field.contentFontSize ?? ""}
            onChange={(e) => onSave({ contentFontSize: numberOrNull(e.target.value) })}
          />
        </label>
        <label className="field-style-row">
          <span>Text color</span>
          <input
            type="color"
            value={field.contentColor ?? "#1f2937"}
            onChange={(e) => onSave({ contentColor: e.target.value })}
          />
        </label>
        <label className="field-style-row">
          <span>Background color</span>
          <input
            type="color"
            value={field.contentBackgroundColor ?? "#ffffff"}
            onChange={(e) => onSave({ contentBackgroundColor: e.target.value })}
          />
        </label>
        <label className="field-style-row">
          <span>Corner radius</span>
          <input
            type="number"
            min={0}
            max={40}
            placeholder="default"
            value={field.contentRadius ?? ""}
            onChange={(e) => onSave({ contentRadius: numberOrNull(e.target.value) })}
          />
        </label>
        <label className="field-style-row">
          <span>Border color</span>
          <input
            type="color"
            value={field.contentBorderColor ?? "#94a3b8"}
            onChange={(e) => onSave({ contentBorderColor: e.target.value })}
          />
        </label>
        <label className="field-style-row">
          <span>Border width</span>
          <input
            type="number"
            min={0}
            max={10}
            placeholder="default"
            value={field.contentBorderWidth ?? ""}
            onChange={(e) => onSave({ contentBorderWidth: numberOrNull(e.target.value) })}
          />
        </label>
        {hasContentOverride && (
          <button
            type="button"
            className="add-button danger field-style-reset"
            onClick={() =>
              onSave({
                contentFontSize: null,
                contentColor: null,
                contentBackgroundColor: null,
                contentRadius: null,
                contentBorderColor: null,
                contentBorderWidth: null,
              })
            }
          >
            Reset
          </button>
        )}
      </div>

      <div className="field-style-section">
        <div className="field-style-section-title">Header</div>
        <label className="field-style-row">
          <span>Font size</span>
          <input
            type="number"
            min={8}
            max={40}
            placeholder="default"
            value={field.headerFontSize ?? ""}
            onChange={(e) => onSave({ headerFontSize: numberOrNull(e.target.value) })}
          />
        </label>
        <label className="field-style-row">
          <span>Color</span>
          <input
            type="color"
            value={field.headerColor ?? "#1f2937"}
            onChange={(e) => onSave({ headerColor: e.target.value })}
          />
        </label>
        <div className="field-style-toggle-row">
          <button
            type="button"
            className={`field-style-toggle${field.headerBold ? " active" : ""}`}
            title="Bold"
            onClick={() => onSave({ headerBold: !field.headerBold })}
          >
            B
          </button>
          <button
            type="button"
            className={`field-style-toggle${field.headerUnderline ? " active" : ""}`}
            title="Underline"
            onClick={() => onSave({ headerUnderline: !field.headerUnderline })}
          >
            U
          </button>
        </div>
        {hasHeaderOverride && (
          <button
            type="button"
            className="add-button danger field-style-reset"
            onClick={() =>
              onSave({
                headerFontSize: null,
                headerColor: null,
                headerBold: null,
                headerUnderline: null,
              })
            }
          >
            Reset
          </button>
        )}
      </div>

      {isWebDisplayable(field.fieldType) && (
        <div className="field-style-section field-style-section-full">
          <div className="field-style-section-title">On the web</div>
          <label className="field-style-checkbox-row">
            <input
              type="checkbox"
              checked={field.showOnWeb}
              onChange={(e) => onSave({ showOnWeb: e.target.checked })}
            />
            Show on Dream/Goal/Project Web
          </label>
          {webFieldKind(field.fieldType) !== "widgets" && (
            <label className="field-style-checkbox-row">
              <input
                type="checkbox"
                checked={field.webHeader}
                disabled={!field.showOnWeb}
                onChange={(e) => onSave({ webHeader: e.target.checked })}
              />
              Show header too
            </label>
          )}
        </div>
      )}
    </div>
  );
}
