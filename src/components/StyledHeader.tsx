import { CSSProperties, ReactNode } from "react";
import { useHeaderStyles } from "../icons/HeaderStyleContext";
import { HEADER_STYLE_REGISTRY } from "../icons/headerRegistry";

// Wraps a header's actual text with its resolved font size/color/bold/
// underline override, and lets that text itself be renamed — used for
// the sidebar's title and nav items, customizable via the Dynamic
// Settings Overlay / Settings > Headers. `children` is just the default
// label shown until a text override is set. Tagged data-overlay-target
// for the existing reverse hover+Ctrl jump (see overlay/useOverlayTargetInteraction.ts).
export function StyledHeader({
  headerKey,
  as: Tag = "span",
  className,
  children,
}: {
  headerKey: string;
  as?: "span" | "div";
  className?: string;
  children: ReactNode;
}) {
  const { overrides } = useHeaderStyles();
  const def = HEADER_STYLE_REGISTRY.find((d) => d.key === headerKey);
  const override = overrides[headerKey];

  const size = override?.size ?? def?.defaultSize;
  const color = override?.color ?? def?.defaultColor;
  const bold = override?.bold ?? def?.defaultBold;
  const underline = override?.underline ?? def?.defaultUnderline;

  const style: CSSProperties = {};
  if (size != null) style.fontSize = `${size}px`;
  if (color) style.color = color;
  if (bold) style.fontWeight = 700;
  if (underline) style.textDecoration = "underline";

  return (
    <Tag data-overlay-target={headerKey} className={className} style={style}>
      {override?.text ?? children}
    </Tag>
  );
}
