import React, { useRef, useState } from "react";
import { View } from "../types/nav";
import { useIcons } from "../icons/IconContext";
import { useTextElements } from "../icons/TextElementContext";
import { useButtonStyles } from "../icons/ButtonStyleContext";
import { useTheme } from "../theme/ThemeContext";
import { TextElementOverride } from "../db/textElements";
import { ButtonStyleOverride } from "../db/buttonStyles";
import { ThemeSettings } from "../theme/themeDefaults";
import "./Page.css";

interface ThemeExport {
  icons: Record<string, string>;
  textElements: Record<string, TextElementOverride>;
  buttonStyles: Record<string, ButtonStyleOverride>;
  themeSettings: Partial<ThemeSettings>;
}

export function SettingsHomePage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { overrides: iconOverrides, setOverride: setIconOverride, clearOverride: clearIconOverride } =
    useIcons();
  const {
    overrides: textOverrides,
    setOverride: setTextOverride,
    clearOverride: clearTextOverride,
  } = useTextElements();
  const {
    overrides: buttonOverrides,
    setOverride: setButtonOverride,
    clearOverride: clearButtonOverride,
  } = useButtonStyles();
  const { overrides: themeOverrides, setThemeValue, resetThemeValue } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleExport = () => {
    const data: ThemeExport = {
      icons: iconOverrides,
      textElements: textOverrides,
      buttonStyles: buttonOverrides,
      themeSettings: themeOverrides,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `webify-theme-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`Exported ${a.download}.`);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus(`Reading ${file.name}...`);

    const reader = new FileReader();
    reader.onerror = () => {
      console.error("FileReader error:", reader.error);
      setStatus(`Failed to read the file: ${reader.error?.message ?? "unknown error"}`);
    };
    reader.onload = async () => {
      let parsed: Partial<ThemeExport>;
      try {
        parsed = JSON.parse(reader.result as string) as Partial<ThemeExport>;
      } catch (err) {
        console.error("Theme JSON parse error:", err, "raw content:", reader.result);
        setStatus(`That file isn't valid JSON: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }

      try {
        const icons = parsed.icons ?? {};
        const textElements = parsed.textElements ?? {};
        const buttonStyles = parsed.buttonStyles ?? {};
        const themeSettings = parsed.themeSettings ?? {};

        // Full replace, not merge — clear whatever's currently
        // customized in each system first so switching themes doesn't
        // leave stale overrides behind from whatever was active before.
        for (const key of Object.keys(iconOverrides)) await clearIconOverride(key);
        for (const key of Object.keys(textOverrides)) await clearTextOverride(key);
        for (const key of Object.keys(buttonOverrides)) await clearButtonOverride(key);
        for (const key of Object.keys(themeOverrides)) {
          await resetThemeValue(key as keyof ThemeSettings);
        }

        let iconCount = 0, textCount = 0, buttonCount = 0, themeCount = 0;

        for (const [key, imageData] of Object.entries(icons)) {
          if (typeof imageData === "string") {
            await setIconOverride(key, imageData);
            iconCount++;
          }
        }
        for (const [key, override] of Object.entries(textElements)) {
          if (override && typeof override === "object") {
            await setTextOverride(key, override);
            textCount++;
          }
        }
        for (const [key, override] of Object.entries(buttonStyles)) {
          if (override && typeof override === "object") {
            await setButtonOverride(key, override);
            buttonCount++;
          }
        }
        for (const [key, value] of Object.entries(themeSettings)) {
          if (typeof value === "string") {
            await setThemeValue(key as keyof ThemeSettings, value);
            themeCount++;
          }
        }

        setStatus(
          `Imported: ${iconCount} icons, ${textCount} text elements, ${buttonCount} button styles, ${themeCount} theme settings.`
        );
      } catch (err) {
        console.error("Theme import error:", err);
        setStatus(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>
      <ul className="list">
        <li>
          <button className="list-item" onClick={() => onNavigate({ type: "settings-icons" })}>
            Icons
          </button>
        </li>
        <li>
          <button className="list-item" onClick={() => onNavigate({ type: "settings-text" })}>
            Text Elements
          </button>
        </li>
        <li>
          <button className="list-item" onClick={() => onNavigate({ type: "settings-buttons" })}>
            Buttons
          </button>
        </li>
        <li>
          <button className="list-item" onClick={() => onNavigate({ type: "settings-theme" })}>
            Theme
          </button>
        </li>
      </ul>

      <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
        <button className="add-button secondary" onClick={handleExport}>
          Export Theme
        </button>
        <button className="add-button secondary" onClick={() => fileInputRef.current?.click()}>
          Import Theme
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={handleFileSelected}
        />
      </div>

      {status && (
        <p style={{ marginTop: "12px", fontSize: "0.85rem", color: "#666" }}>{status}</p>
      )}
    </div>
  );
}
