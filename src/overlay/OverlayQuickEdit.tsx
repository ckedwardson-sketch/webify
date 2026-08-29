import { useEffect, useRef, useState } from "react";
import { SettingsSearchItem } from "../pages/settingsSearchIndex";
import { Icon } from "../icons/Icon";
import { useIcons } from "../icons/IconContext";
import { ICON_REGISTRY } from "../icons/registry";
import { TextElement } from "../icons/TextElement";
import { useTextElements } from "../icons/TextElementContext";
import { TEXT_ELEMENT_REGISTRY } from "../icons/textRegistry";
import { StyledButton, resolveButtonStyle } from "../icons/StyledButton";
import { useButtonStyles } from "../icons/ButtonStyleContext";
import { BUTTON_STYLE_REGISTRY } from "../icons/buttonRegistry";
import { StyledHeader } from "../components/StyledHeader";
import { useHeaderStyles } from "../icons/HeaderStyleContext";
import { HEADER_STYLE_REGISTRY } from "../icons/headerRegistry";
import { useTheme } from "../theme/ThemeContext";
import { defaultsForMode } from "../theme/themeDefaults";
import { THEME_COLOR_GROUPS, ThemeColorField } from "../theme/themeFieldGroups";
import { useEditorSettings } from "../editor/EditorSettingsContext";
import { EditorToolSettings } from "../db/editorSettings";
import "./OverlayQuickEdit.css";
import "../components/FieldStyleFields.css"; // reusing .field-style-toggle for Bold/Underline

// Given a search result clicked in the overlay panel, renders a small
// inline control for that one setting reusing the same context/DB write
// path its real settings page uses — so overlay edits "just work" and
// stay consistent instead of being a parallel, disconnected mechanism.
// Falls back to onFallback (navigate to the real page) only if the item's
// key can't be resolved against its own registry, which shouldn't happen
// in practice since the search index is built from the same registries.

interface QuickEditProps {
  item: SettingsSearchItem;
  onFallback: () => void;
}

export function OverlayQuickEdit({ item, onFallback }: QuickEditProps) {
  switch (item.view.type) {
    case "settings-icons":
      return <IconQuickEdit item={item} onFallback={onFallback} />;
    case "settings-text":
      return <TextQuickEdit item={item} onFallback={onFallback} />;
    case "settings-buttons":
      return <ButtonQuickEdit item={item} onFallback={onFallback} />;
    case "settings-headers":
      return <HeaderQuickEdit item={item} onFallback={onFallback} />;
    case "settings-theme":
      return <ThemeQuickEdit item={item} onFallback={onFallback} />;
    case "settings-editor":
      return <EditorQuickEdit item={item} onFallback={onFallback} />;
    default:
      return <Fallback onFallback={onFallback} />;
  }
}

function Fallback({ onFallback }: { onFallback: () => void }) {
  useEffect(() => onFallback(), [onFallback]);
  return null;
}

function IconQuickEdit({ item, onFallback }: QuickEditProps) {
  const { overrides, setOverride, clearOverride } = useIcons();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const def = ICON_REGISTRY.find((d) => d.key === item.key);
  if (!def) return <Fallback onFallback={onFallback} />;

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setOverride(def.key, reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="quick-edit-row">
      <div className="quick-edit-preview">
        <Icon iconKey={def.key} size={26} />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />
      <div className="quick-edit-actions">
        <button className="add-button secondary" onClick={() => fileInputRef.current?.click()}>
          Change
        </button>
        {overrides[def.key] && (
          <button className="add-button danger" onClick={() => clearOverride(def.key)}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

function TextQuickEdit({ item, onFallback }: QuickEditProps) {
  const { overrides, setOverride, clearOverride } = useTextElements();
  const def = TEXT_ELEMENT_REGISTRY.find((d) => d.key === item.key);
  const override = def ? overrides[def.key] : undefined;
  const [draft, setDraft] = useState(() =>
    def
      ? { text: override?.text ?? def.defaultText, size: override?.size ?? def.defaultSize, color: override?.color ?? def.defaultColor }
      : { text: "", size: 16, color: "#000000" }
  );
  // Resync when the underlying override changes elsewhere (in
  // particular, when Reset below clears it) — otherwise the inputs keep
  // showing whatever was last typed even after the override is gone.
  useEffect(() => {
    if (def) setDraft({ text: override?.text ?? def.defaultText, size: override?.size ?? def.defaultSize, color: override?.color ?? def.defaultColor });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [override, def?.key]);
  if (!def) return <Fallback onFallback={onFallback} />;

  return (
    <div className="quick-edit-row">
      <div className="quick-edit-preview">
        <TextElement elementKey={def.key} />
      </div>
      <div className="text-settings-fields">
        <input
          className="text-settings-text"
          value={draft.text}
          maxLength={4}
          onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
        />
        <input
          className="text-settings-size"
          type="number"
          min={8}
          max={48}
          value={draft.size}
          onChange={(e) => setDraft((d) => ({ ...d, size: Number(e.target.value) }))}
        />
        <input
          className="text-settings-color"
          type="color"
          value={draft.color}
          onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
        />
      </div>
      <div className="quick-edit-actions">
        <button className="add-button secondary" onClick={() => setOverride(def.key, draft)}>
          Save
        </button>
        {overrides[def.key] && (
          <button className="add-button danger" onClick={() => clearOverride(def.key)}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

function ButtonQuickEdit({ item, onFallback }: QuickEditProps) {
  const { overrides, setOverride, clearOverride } = useButtonStyles();
  const def = BUTTON_STYLE_REGISTRY.find((d) => d.key === item.key);
  const [draft, setDraft] = useState(() => (def ? resolveButtonStyle(def.key, overrides) : null));
  useEffect(() => {
    if (def) setDraft(resolveButtonStyle(def.key, overrides));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides[def?.key ?? ""], def?.key]);
  if (!def || !draft) return <Fallback onFallback={onFallback} />;

  const update = (patch: Partial<typeof draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <div className="quick-edit-row">
      <div className="quick-edit-preview">
        <StyledButton buttonKey={def.key} />
      </div>
      <div className="button-settings-fields">
        <label className="button-settings-field">
          Text
          <input type="text" value={draft.text} onChange={(e) => update({ text: e.target.value })} />
        </label>
        <label className="button-settings-field narrow">
          Text color
          <input type="color" value={draft.textColor} onChange={(e) => update({ textColor: e.target.value })} />
        </label>
        <label className="button-settings-field narrow">
          Background
          <input
            type="color"
            value={draft.backgroundColor}
            onChange={(e) => update({ backgroundColor: e.target.value })}
          />
        </label>
        <label className="button-settings-field narrow">
          Outline color
          <input type="color" value={draft.borderColor} onChange={(e) => update({ borderColor: e.target.value })} />
        </label>
      </div>
      <div className="quick-edit-actions">
        <button className="add-button secondary" onClick={() => setOverride(def.key, draft)}>
          Save
        </button>
        {overrides[def.key] && (
          <button className="add-button danger" onClick={() => clearOverride(def.key)}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

function HeaderQuickEdit({ item, onFallback }: QuickEditProps) {
  const { overrides, setOverride, clearOverride } = useHeaderStyles();
  const def = HEADER_STYLE_REGISTRY.find((d) => d.key === item.key);
  const override = def ? overrides[def.key] : undefined;
  const [draft, setDraft] = useState(() =>
    def
      ? {
          text: override?.text ?? def.defaultText,
          size: override?.size ?? def.defaultSize,
          color: override?.color ?? def.defaultColor,
          bold: override?.bold ?? def.defaultBold,
          underline: override?.underline ?? def.defaultUnderline,
        }
      : { text: "", size: 14, color: "#000000", bold: false, underline: false }
  );
  useEffect(() => {
    if (def) {
      setDraft({
        text: override?.text ?? def.defaultText,
        size: override?.size ?? def.defaultSize,
        color: override?.color ?? def.defaultColor,
        bold: override?.bold ?? def.defaultBold,
        underline: override?.underline ?? def.defaultUnderline,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [override, def?.key]);
  if (!def) return <Fallback onFallback={onFallback} />;

  return (
    <div className="quick-edit-row">
      <div className="quick-edit-preview">
        <StyledHeader headerKey={def.key}>Aa</StyledHeader>
      </div>
      <div className="text-settings-fields">
        <input
          className="text-settings-text"
          type="text"
          value={draft.text}
          onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
        />
        <input
          className="text-settings-size"
          type="number"
          min={8}
          max={40}
          value={draft.size}
          onChange={(e) => setDraft((d) => ({ ...d, size: Number(e.target.value) }))}
        />
        <input
          className="text-settings-color"
          type="color"
          value={draft.color}
          onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
        />
        <button
          type="button"
          className={`field-style-toggle${draft.bold ? " active" : ""}`}
          title="Bold"
          onClick={() => setDraft((d) => ({ ...d, bold: !d.bold }))}
        >
          B
        </button>
        <button
          type="button"
          className={`field-style-toggle${draft.underline ? " active" : ""}`}
          title="Underline"
          onClick={() => setDraft((d) => ({ ...d, underline: !d.underline }))}
        >
          U
        </button>
      </div>
      <div className="quick-edit-actions">
        <button className="add-button secondary" onClick={() => setOverride(def.key, draft)}>
          Save
        </button>
        {overrides[def.key] && (
          <button className="add-button danger" onClick={() => clearOverride(def.key)}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

function ThemeQuickEdit({ item, onFallback }: QuickEditProps) {
  const { theme, overrides, setThemeValue, resetThemeValue } = useTheme();
  const modeDefaults = defaultsForMode(theme.mode);
  const fileInputRef = useRef<HTMLInputElement>(null);

  let field: ThemeColorField | undefined;
  for (const group of THEME_COLOR_GROUPS) {
    field = group.fields.find((f) => f.key === item.key);
    if (field) break;
  }
  if (!field) return <Fallback onFallback={onFallback} />;

  const { key, kind = "color" } = field;
  const value = overrides[key] || (key in modeDefaults ? (modeDefaults as unknown as Record<string, string>)[key as string] : (theme[key] as string));

  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setThemeValue(key, reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  let control: React.ReactNode;
  if (kind === "select") {
    control = (
      <select value={value} onChange={(e) => setThemeValue(key, e.target.value)}>
        {field.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  } else if (kind === "number") {
    control = (
      <input
        type="number"
        min={field.min ?? 0}
        max={field.max ?? 60}
        step={field.step ?? 1}
        value={value}
        onChange={(e) => setThemeValue(key, e.target.value)}
        className="theme-number-input"
      />
    );
  } else if (kind === "code") {
    control = (
      <textarea
        className="theme-code-input"
        rows={3}
        spellCheck={false}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => setThemeValue(key, e.target.value)}
      />
    );
  } else if (kind === "image") {
    control = (
      <div className="theme-image-field">
        {value && <img src={value} alt="" className="theme-image-preview" />}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleImageSelected}
        />
        <button className="add-button secondary" onClick={() => fileInputRef.current?.click()}>
          {value ? "Change" : "Upload"}
        </button>
      </div>
    );
  } else {
    control = <input type="color" value={value} onChange={(e) => setThemeValue(key, e.target.value)} />;
  }

  return (
    <div className="quick-edit-row">
      {control}
      {field.help && <p className="theme-code-help">{field.help}</p>}
      {overrides[field.key] && (
        <div className="quick-edit-actions">
          <button className="add-button danger" onClick={() => resetThemeValue(field.key)}>
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

const EDITOR_TOGGLE_MAP: Record<string, { settingKey: keyof EditorToolSettings; label: string }> = {
  "editor-toolbar": { settingKey: "toolbarEnabled", label: "Fixed toolbar" },
  "editor-context-menu": { settingKey: "contextMenuEnabled", label: "Right-click / long-press menu" },
  "editor-bubble-menu": { settingKey: "bubbleMenuEnabled", label: "Selection toolbar" },
  "editor-slash-command": { settingKey: "slashCommandEnabled", label: "Slash commands" },
};

function EditorQuickEdit({ item, onFallback }: QuickEditProps) {
  const { settings, setSetting } = useEditorSettings();

  if (item.key === "editor-input-mode") {
    return (
      <div className="quick-edit-row">
        <select
          className="inline-add-input"
          style={{ marginBottom: 0 }}
          value={settings.inputMode}
          onChange={(e) => setSetting("inputMode", e.target.value as EditorToolSettings["inputMode"])}
        >
          <option value="auto">Auto</option>
          <option value="mouse">Mouse</option>
          <option value="touch">Touch</option>
        </select>
      </div>
    );
  }

  const toggle = EDITOR_TOGGLE_MAP[item.key];
  if (!toggle) return <Fallback onFallback={onFallback} />;

  return (
    <div className="quick-edit-row">
      <label className="editor-settings-toggle">
        <input
          type="checkbox"
          checked={settings[toggle.settingKey] as boolean}
          onChange={(e) => setSetting(toggle.settingKey, e.target.checked as never)}
        />
        <span className="editor-settings-toggle-track" />
      </label>
    </div>
  );
}
