// Ctrl+click a Dream/Goal/Project node on its Web canvas (see
// DreamWebPage.tsx / GoalWebPage.tsx's onNodeClick) to open this — a
// convenient checklist of that owner's fields, each with a switch for
// "show on web" and (except the widget bay) a small extra checkbox for
// "show its header too" — same underlying show_on_web/web_header columns
// FieldStyleFields edits, just presented as one list instead of jumping
// into each field individually. Also carries the global "fit to size"
// switch (theme.nodeCardGrowToFit) since it's the other half of "what
// does this web card actually show."
//
// The "Show on web" section only appears when `fields` is passed
// (omit it — e.g. task nodes — for a Looks-only popup). The "Looks"
// section (percentage-scale size, optional accent color, optional
// favorite/glow) only appears when a `looks` prop is passed — project
// nodes get size+color, task nodes get size+favorite (see
// GoalWebPage.tsx). Both sections are collapsed by default, matching
// each other via <details>.
import { FieldLayoutRow, FieldStylePatch, FIELD_TYPE_LABELS, isWebDisplayable, webFieldKind } from "../db/fieldLayout";
import { useTheme } from "../theme/ThemeContext";
import "./ManagedListRow.css"; // .menu-backdrop
import "../overlay/DynamicOverlayPanel.css"; // .dyn-overlay-close
import "./NodeWidgetOverlay.css";
import "./NodeFieldVisibilityPopover.css";

export interface NodeLooksFavoriteSettings {
  value: boolean;
  onToggle: (value: boolean) => void;
  // Glow amount is a plain intensity number (px-ish blur/spread), not a
  // percent — null = the built-in default amount.
  glowAmount: number | null;
  onGlowAmountChange: (amount: number | null) => void;
  glowColor: string | null;
  onGlowColorChange: (color: string | null) => void;
}

export interface NodeLooksSettings {
  // Percentage-scale card size — null/100 = the card's normal size.
  scalePercent: number | null;
  onScaleChange: (percent: number | null) => void;
  // Set for node types (Panes) that are resized by dragging their own
  // handles rather than a percent scale — hides the Size row, since a
  // percent multiplier doesn't mean anything for a directly-resizable box.
  hideSize?: boolean;
  // Accent color override for the card — omit entirely for node types
  // (tasks) that don't have their own card color to override.
  color?: {
    value: string | null;
    onChange: (color: string | null) => void;
  };
  // Background fill opacity (0-100%) — Panes only, since every other
  // node type has an opaque card background.
  opacity?: {
    valuePercent: number;
    onChange: (percent: number) => void;
  };
  // The top-left label's own font size/color — Panes only.
  headerStyle?: {
    fontSize: number;
    onFontSizeChange: (px: number) => void;
    textColor: string | null;
    onTextColorChange: (color: string | null) => void;
  };
  // Favorite toggle + the glow settings it reveals — omit for node
  // types that don't support favoriting.
  favorite?: NodeLooksFavoriteSettings;
}

export function NodeFieldVisibilityPopover({
  title,
  fields,
  onUpdate,
  onClose,
  looks,
}: {
  title: string;
  fields?: FieldLayoutRow[];
  onUpdate?: (fieldId: number, patch: FieldStylePatch) => void;
  onClose: () => void;
  looks?: NodeLooksSettings;
}) {
  const { theme, setThemeValue } = useTheme();
  const displayable = (fields ?? []).filter((f) => isWebDisplayable(f.fieldType));
  const growToFit = theme.nodeCardGrowToFit === "1";

  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="node-widget-overlay node-field-visibility-popover" onClick={(e) => e.stopPropagation()}>
        <div className="node-widget-overlay-header">
          <span className="node-widget-overlay-title">{title}</span>
          <button type="button" className="dyn-overlay-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {fields && (
          <details className="node-field-visibility-section">
            <summary>Show on web</summary>

            {displayable.length === 0 ? (
              <p className="page-text">This page has no fields that can show on the web.</p>
            ) : (
              <div className="node-field-visibility-list">
                {displayable.map((f) => {
                  const label = f.customLabel ?? FIELD_TYPE_LABELS[f.fieldType];
                  const kind = webFieldKind(f.fieldType);
                  return (
                    <div key={f.id} className="node-field-visibility-row">
                      <label className="node-field-visibility-switch">
                        <input
                          type="checkbox"
                          checked={f.showOnWeb}
                          onChange={(e) => onUpdate?.(f.id, { showOnWeb: e.target.checked })}
                        />
                        <span>{label}</span>
                      </label>
                      {kind !== "widgets" && (
                        <label className="node-field-visibility-header-check">
                          <input
                            type="checkbox"
                            checked={f.webHeader}
                            disabled={!f.showOnWeb}
                            onChange={(e) => onUpdate?.(f.id, { webHeader: e.target.checked })}
                          />
                          header
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="node-field-visibility-divider" />

            <label className="node-field-visibility-switch">
              <input
                type="checkbox"
                checked={growToFit}
                onChange={(e) => setThemeValue("nodeCardGrowToFit", e.target.checked ? "1" : "0")}
              />
              <span>Fit to size — cards grow to show everything</span>
            </label>
          </details>
        )}

        {looks && (
          <details className="node-field-visibility-section">
            <summary>Looks</summary>

            {!looks.hideSize && (
              <div className="node-field-visibility-looks-row">
                <label htmlFor="node-looks-scale">Size</label>
                <input
                  id="node-looks-scale"
                  type="number"
                  min={25}
                  max={400}
                  step={5}
                  value={looks.scalePercent ?? 100}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (!Number.isFinite(value) || value <= 0) return;
                    looks.onScaleChange(value === 100 ? null : value);
                  }}
                />
                <span>%</span>
              </div>
            )}

            {looks.opacity && (
              <div className="node-field-visibility-looks-row">
                <label htmlFor="node-looks-opacity">Fill opacity</label>
                <input
                  id="node-looks-opacity"
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={looks.opacity.valuePercent}
                  onChange={(e) => looks.opacity!.onChange(Number(e.target.value))}
                />
                <span>{looks.opacity.valuePercent}%</span>
              </div>
            )}

            {looks.headerStyle && (
              <>
                <div className="node-field-visibility-looks-row">
                  <label htmlFor="node-looks-header-font-size">Header text size</label>
                  <input
                    id="node-looks-header-font-size"
                    type="number"
                    min={8}
                    max={32}
                    step={1}
                    value={looks.headerStyle.fontSize}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (!Number.isFinite(value) || value <= 0) return;
                      looks.headerStyle!.onFontSizeChange(value);
                    }}
                  />
                  <span>px</span>
                </div>

                <div className="node-field-visibility-looks-row">
                  <label htmlFor="node-looks-header-color">Header text color</label>
                  <input
                    id="node-looks-header-color"
                    type="color"
                    value={looks.headerStyle.textColor ?? "#ffffff"}
                    onChange={(e) => looks.headerStyle!.onTextColorChange(e.target.value)}
                  />
                  {looks.headerStyle.textColor && (
                    <button
                      type="button"
                      className="node-field-visibility-looks-reset"
                      onClick={() => looks.headerStyle!.onTextColorChange(null)}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </>
            )}

            {looks.color && (
              <div className="node-field-visibility-looks-row">
                <label htmlFor="node-looks-color">Color</label>
                <input
                  id="node-looks-color"
                  type="color"
                  value={looks.color.value ?? "#1f2937"}
                  onChange={(e) => looks.color!.onChange(e.target.value)}
                />
                {looks.color.value && (
                  <button
                    type="button"
                    className="node-field-visibility-looks-reset"
                    onClick={() => looks.color!.onChange(null)}
                  >
                    Reset
                  </button>
                )}
              </div>
            )}

            {looks.favorite && (
              <>
                <label className="node-field-visibility-switch">
                  <input
                    type="checkbox"
                    checked={looks.favorite.value}
                    onChange={(e) => looks.favorite!.onToggle(e.target.checked)}
                  />
                  <span>Favorite — glowing outline</span>
                </label>

                {looks.favorite.value && (
                  <>
                    <div className="node-field-visibility-looks-row">
                      <label htmlFor="node-looks-glow-amount">Glow amount</label>
                      <input
                        id="node-looks-glow-amount"
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={looks.favorite.glowAmount ?? 50}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (!Number.isFinite(value) || value < 0) return;
                          looks.favorite!.onGlowAmountChange(value === 50 ? null : value);
                        }}
                      />
                    </div>

                    <div className="node-field-visibility-looks-row">
                      <label htmlFor="node-looks-glow-color">Glow color</label>
                      <input
                        id="node-looks-glow-color"
                        type="color"
                        value={looks.favorite.glowColor ?? "#facc15"}
                        onChange={(e) => looks.favorite!.onGlowColorChange(e.target.value)}
                      />
                      {looks.favorite.glowColor && (
                        <button
                          type="button"
                          className="node-field-visibility-looks-reset"
                          onClick={() => looks.favorite!.onGlowColorChange(null)}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </details>
        )}
      </div>
    </>
  );
}
