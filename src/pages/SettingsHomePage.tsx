import { View } from "../types/nav";
import "./Page.css";

export function SettingsHomePage({ onNavigate }: { onNavigate: (view: View) => void }) {
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
    </div>
  );
}
