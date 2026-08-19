import "./Breadcrumb.css";

interface Crumb {
  label: string;
  onClick?: () => void;
}

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <div className="breadcrumb">
      {crumbs.map((crumb, i) => (
        <span key={i} className="breadcrumb-segment">
          {crumb.onClick ? (
            <button className="breadcrumb-link" onClick={crumb.onClick}>
              {crumb.label}
            </button>
          ) : (
            <span className="breadcrumb-current">{crumb.label}</span>
          )}
          {i < crumbs.length - 1 && <span className="breadcrumb-sep">/</span>}
        </span>
      ))}
    </div>
  );
}
