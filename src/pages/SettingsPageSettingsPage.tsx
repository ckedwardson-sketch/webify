import { useState } from "react";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import { useSettingsFocus } from "./useSettingsFocus";
import { useNodeScaleSettings } from "../webGraph/useNodeScaleSettings";
import { ColumnMode, NodeScaleMode } from "../webGraph/nodeScale";
import "./Page.css";
import "./SettingsShared.css";
import "./SettingsMobilePage.css"; // reusing .mobile-spacing-field* row layout

// Which web/page types currently have layout controls implemented —
// grows as node scaling (and later column count / field layout /
// section visibility) gets built out for each one. Only list a web here
// once its settings actually do something.
const WEB_OPTIONS: { scopeKey: string; label: string }[] = [
  { scopeKey: "section:recipes-graph", label: "Recipe Web" },
];

export function SettingsPageSettingsPage({
  onNavigate,
  focusKey,
}: {
  onNavigate: (view: View) => void;
  focusKey?: string;
}) {
  useSettingsFocus(focusKey);
  const [selectedScope, setSelectedScope] = useState(WEB_OPTIONS[0].scopeKey);
  const { settings, updateSettings, resetSettings } = useNodeScaleSettings(selectedScope);

  const num = (v: string) => Number(v);

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Settings", onClick: () => onNavigate({ type: "settings-home" }) },
          { label: "Page Settings" },
        ]}
      />
      <h1 className="page-title">Page Settings</h1>
      <p className="page-text">
        Layout controls scoped to one web at a time — pick which one below. More controls (column
        count, field layout, section visibility) land here as they're built.
      </p>

      <div className="settings-groups">
        <section>
          <label className="mobile-spacing-field" data-settings-key="pageSettings.target">
            <span>Web</span>
            <select value={selectedScope} onChange={(e) => setSelectedScope(e.target.value)}>
              {WEB_OPTIONS.map((w) => (
                <option key={w.scopeKey} value={w.scopeKey}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section>
          <h2 className="settings-group-title">Node Scaling</h2>
          <div className="mobile-spacing-fields">
            <label className="mobile-spacing-field" data-settings-key="nodeScale.mode">
              <span>Mode</span>
              <select
                value={settings.mode}
                onChange={(e) => updateSettings({ mode: e.target.value as NodeScaleMode })}
              >
                <option value="auto-per-category">Auto — each category scales to its own item count</option>
                <option value="auto-global">Auto — whole web shares one size</option>
                <option value="manual">Manual — fixed size everywhere</option>
              </select>
            </label>

            {settings.mode !== "manual" && (
              <>
                <label className="mobile-spacing-field" data-settings-key="nodeScale.referenceCount">
                  <span>Reference item count (this many items = 100% size)</span>
                  <input
                    type="number"
                    min={1}
                    value={settings.referenceCount}
                    onChange={(e) => updateSettings({ referenceCount: Math.max(1, num(e.target.value)) })}
                  />
                </label>
                <label className="mobile-spacing-field" data-settings-key="nodeScale.sensitivity">
                  <span>Scaling strength ({settings.sensitivity.toFixed(2)})</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1.5}
                    step={0.05}
                    value={settings.sensitivity}
                    onChange={(e) => updateSettings({ sensitivity: num(e.target.value) })}
                  />
                </label>
                <label className="mobile-spacing-field" data-settings-key="nodeScale.minScale">
                  <span>Minimum scale ({Math.round(settings.minScale * 100)}%)</span>
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.05}
                    value={settings.minScale}
                    onChange={(e) => updateSettings({ minScale: num(e.target.value) })}
                  />
                </label>
                <label className="mobile-spacing-field" data-settings-key="nodeScale.maxScale">
                  <span>
                    Maximum scale ({Math.round(settings.maxScale * 100)}%) — 100% means sparse
                    categories never grow bigger than normal, only raise this if you want them to
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={2.5}
                    step={0.05}
                    value={settings.maxScale}
                    onChange={(e) => updateSettings({ maxScale: num(e.target.value) })}
                  />
                </label>
                <label className="mobile-spacing-field" data-settings-key="nodeScale.fontBoost">
                  <span>
                    Font size ({Math.round(settings.fontBoost * 100)}%) — text always tracks the
                    card's own scale; this nudges it bigger or smaller on top of that
                  </span>
                  <input
                    type="range"
                    min={0.6}
                    max={1.6}
                    step={0.05}
                    value={settings.fontBoost}
                    onChange={(e) => updateSettings({ fontBoost: num(e.target.value) })}
                  />
                </label>
              </>
            )}

            {settings.mode === "auto-global" && (
              <label className="mobile-spacing-field" data-settings-key="nodeScale.globalPercentile">
                <span>Reference percentile ({settings.globalPercentile}, 50 = median)</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={settings.globalPercentile}
                  onChange={(e) => updateSettings({ globalPercentile: num(e.target.value) })}
                />
              </label>
            )}

            {settings.mode === "manual" && (
              <>
                <label className="mobile-spacing-field" data-settings-key="nodeScale.manualWidth">
                  <span>Card width (px)</span>
                  <input
                    type="number"
                    min={80}
                    value={settings.manualWidth}
                    onChange={(e) => updateSettings({ manualWidth: Math.max(80, num(e.target.value)) })}
                  />
                </label>
                <label className="mobile-spacing-field" data-settings-key="nodeScale.manualHeight">
                  <span>Card height (px)</span>
                  <input
                    type="number"
                    min={40}
                    value={settings.manualHeight}
                    onChange={(e) => updateSettings({ manualHeight: Math.max(40, num(e.target.value)) })}
                  />
                </label>
                <label className="mobile-spacing-field" data-settings-key="nodeScale.manualFontScale">
                  <span>Font scale ({Math.round(settings.manualFontScale * 100)}%)</span>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={settings.manualFontScale}
                    onChange={(e) => updateSettings({ manualFontScale: num(e.target.value) })}
                  />
                </label>
              </>
            )}

            <label className="mobile-spacing-field" data-settings-key="nodeScale.aspectRatio">
              <span>Height : width ratio ({settings.aspectRatio.toFixed(2)})</span>
              <input
                type="range"
                min={0.3}
                max={2}
                step={0.05}
                value={settings.aspectRatio}
                onChange={(e) => updateSettings({ aspectRatio: num(e.target.value) })}
              />
            </label>
          </div>
        </section>

        <section>
          <h2 className="settings-group-title">Columns</h2>
          <div className="mobile-spacing-fields">
            <label className="mobile-spacing-field" data-settings-key="nodeScale.columnMode">
              <span>Columns per category</span>
              <select
                value={settings.columnMode}
                onChange={(e) => updateSettings({ columnMode: e.target.value as ColumnMode })}
              >
                <option value="auto">Auto — fits the category's item count</option>
                <option value="fixed">Fixed</option>
              </select>
            </label>
            {settings.columnMode === "fixed" && (
              <label className="mobile-spacing-field" data-settings-key="nodeScale.fixedColumns">
                <span>Columns</span>
                <input
                  type="number"
                  min={1}
                  value={settings.fixedColumns}
                  onChange={(e) => updateSettings({ fixedColumns: Math.max(1, num(e.target.value)) })}
                />
              </label>
            )}
          </div>
        </section>

        <section>
          <button className="add-button danger" onClick={resetSettings}>
            Reset to defaults
          </button>
        </section>
      </div>
    </div>
  );
}
