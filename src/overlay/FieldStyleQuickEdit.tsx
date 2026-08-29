// The body of the field-style quick edit (font/color/background/border/
// header + "On the web" toggles) — chrome (header/close) is supplied by
// DynamicOverlayPanel.tsx, same as quickEditItem's OverlayQuickEdit. This
// is what ctrl+click on a field (see RearrangeableField.tsx) opens now,
// replacing the old always-visible inline 🎨 popover. The live field row
// and its save handler come from whichever Project/Goal/Dream detail
// page is currently mounted (see FieldStyleRegistryContext.tsx) — if
// nothing matches (stale id, or no detail page mounted), this renders a
// short explanation instead of erroring.
import { useFieldStyleRegistry } from "../rearrange/FieldStyleRegistryContext";
import { FieldStyleFields } from "../components/FieldStyleFields";

export function FieldStyleQuickEdit({ fieldId }: { fieldId: number }) {
  const { target } = useFieldStyleRegistry();
  const field = target?.fields.find((f) => f.id === fieldId);

  if (!field || !target) {
    return <p className="page-text">This field isn't on the current page anymore.</p>;
  }

  return (
    <FieldStyleFields
      field={field}
      onSave={(patch) => target.onSave(field.id, patch)}
      onRename={(label) => target.onRename(field.id, label)}
    />
  );
}
