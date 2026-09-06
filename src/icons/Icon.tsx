import { useState } from "react";
import { useIcons } from "./IconContext";
import { ICON_REGISTRY } from "./registry";

export function Icon({ iconKey, size = 16 }: { iconKey: string; size?: number }) {
  const { overrides } = useIcons();
  const def = ICON_REGISTRY.find((i) => i.key === iconKey);
  const override = overrides[iconKey];
  // An override can fail to load (a bad data URI, an external URL the
  // Tauri webview's CSP blocks, a value an AI-authored theme guessed
  // wrong) — track that per-key so a broken image never renders
  // forever; fall back to the default glyph instead.
  const [failedKey, setFailedKey] = useState<string | null>(null);

  if (override && failedKey !== iconKey) {
    return (
      <img
        src={override}
        alt={def?.label ?? iconKey}
        data-overlay-target={iconKey}
        onError={() => setFailedKey(iconKey)}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          display: "inline-block",
          verticalAlign: "middle",
        }}
      />
    );
  }

  return <span data-overlay-target={iconKey}>{def?.defaultGlyph ?? "?"}</span>;
}
