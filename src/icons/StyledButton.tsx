import React from "react";
import { Icon } from "./Icon";
import { useButtonStyles } from "./ButtonStyleContext";
import { BUTTON_STYLE_REGISTRY } from "./buttonRegistry";

export function resolveButtonStyle(
  buttonKey: string,
  overrides: ReturnType<typeof useButtonStyles>["overrides"]
) {
  const def = BUTTON_STYLE_REGISTRY.find((d) => d.key === buttonKey);
  const override = overrides[buttonKey];
  return {
    text: override?.text ?? def?.defaultText ?? "?",
    fontFamily: override?.fontFamily ?? def?.defaultFontFamily ?? "inherit",
    fontSize: override?.fontSize ?? def?.defaultFontSize ?? 14,
    textColor: override?.textColor ?? def?.defaultTextColor ?? "#000000",
    backgroundColor: override?.backgroundColor ?? def?.defaultBackgroundColor ?? "#e5e7eb",
    borderColor: override?.borderColor ?? def?.defaultBorderColor ?? "transparent",
    paddingX: override?.paddingX ?? def?.defaultPaddingX ?? 12,
    paddingY: override?.paddingY ?? def?.defaultPaddingY ?? 8,
    borderRadius: override?.borderRadius ?? def?.defaultBorderRadius ?? 6,
  };
}

// A button whose text, font, colors, and box size (padding/radius) are all
// pulled from Settings > Buttons, falling back to the registry defaults.
// `iconKey` is optional and renders via <Icon> to the left of the text,
// same as the hardcoded buttons this replaced.
export function StyledButton({
  buttonKey,
  iconKey,
  onClick,
  style,
}: {
  buttonKey: string;
  iconKey?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  const { overrides } = useButtonStyles();
  const resolved = resolveButtonStyle(buttonKey, overrides);

  return (
    <button
      onClick={onClick}
      data-overlay-target={buttonKey}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        cursor: "pointer",
        fontFamily: resolved.fontFamily,
        fontSize: `${resolved.fontSize}px`,
        color: resolved.textColor,
        background: resolved.backgroundColor,
        border: `1px solid ${resolved.borderColor}`,
        borderRadius: `${resolved.borderRadius}px`,
        padding: `${resolved.paddingY}px ${resolved.paddingX}px`,
        ...style,
      }}
    >
      {iconKey && <Icon iconKey={iconKey} size={resolved.fontSize} />}
      {resolved.text}
    </button>
  );
}
