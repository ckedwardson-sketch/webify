import { HOME_PAGE_OPTIONS, findHomePageOption } from "./homePageOptions";

// The one dropdown used both in the middle of an unassigned Home page
// and in Settings > Page Settings > Home Page, so the two can't drift.
export function HomePagePicker({
  value,
  onChange,
  emptyLabel,
}: {
  value: string | null;
  onChange: (key: string | null) => void;
  // Label for the "nothing chosen" entry.
  emptyLabel: string;
}) {
  // A stored key that no longer matches any option shows as unassigned.
  const current = findHomePageOption(value)?.key ?? "";
  return (
    <select value={current} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{emptyLabel}</option>
      {HOME_PAGE_OPTIONS.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
