import React from "react";
import { useIcons } from "./IconContext";
import { ICON_REGISTRY } from "./registry";

export function Icon({ iconKey, size = 16 }: { iconKey: string; size?: number }) {
  const { overrides } = useIcons();
  const def = ICON_REGISTRY.find((i) => i.key === iconKey);
  const override = overrides[iconKey];

  if (override) {
    return (
      <img
        src={override}
        alt={def?.label ?? iconKey}
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

  return <span>{def?.defaultGlyph ?? "?"}</span>;
}
