import { useTextElements } from "./TextElementContext";
import { TEXT_ELEMENT_REGISTRY } from "./textRegistry";

export function TextElement({ elementKey }: { elementKey: string }) {
  const { overrides } = useTextElements();
  const def = TEXT_ELEMENT_REGISTRY.find((d) => d.key === elementKey);
  const override = overrides[elementKey];

  const text = override?.text ?? def?.defaultText ?? "?";
  const size = override?.size ?? def?.defaultSize ?? 14;
  const color = override?.color ?? def?.defaultColor;

  return <span style={{ fontSize: `${size}px`, color, lineHeight: 1 }}>{text}</span>;
}
