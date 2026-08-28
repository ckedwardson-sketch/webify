import { useTheme } from "../theme/ThemeContext";

// Renders one <input type="range"> per designer-defined slider (see
// theme/customSliders.ts) — the app-user-facing half of the "AI
// designer can define adjustable knobs" feature. Renders nothing when
// the current theme (default or imported) didn't define any, so this
// is safe to always mount.
export function CustomThemeSliders() {
  const { customSliders, setCustomSliderValue } = useTheme();

  if (customSliders.length === 0) return null;

  return (
    <div className="theme-section">
      <h2 className="theme-section-title">Theme sliders</h2>
      <p className="page-text" style={{ marginTop: 0 }}>
        Adjustable knobs this theme defined for itself (see the theme's design notes for what each one does).
      </p>
      <div className="theme-color-list">
        {customSliders.map((slider) => (
          <div key={slider.id} className="theme-color-row" title={slider.description}>
            <span className="theme-color-label" style={{ flex: "0 0 auto", minWidth: 160 }}>
              {slider.label}
            </span>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={slider.value}
              onChange={(e) => setCustomSliderValue(slider.id, Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)", minWidth: 56, textAlign: "right" }}>
              {slider.value}
              {slider.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
