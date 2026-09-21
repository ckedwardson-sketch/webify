import type { ReactNode } from "react";
import { View } from "../types/nav";
import { HomePagePicker } from "../homePage/HomePagePicker";
import { findHomePageOption } from "../homePage/homePageOptions";
import { useHomePageSetting } from "../homePage/useHomePageSetting";
import "./Page.css";
import "./HomePage.css";

// Home is a host: the view stays { type: "home" } (so the sidebar,
// history trail, etc. all still say Home), but whatever page is
// assigned in Settings > Page Settings > Home Page is what's drawn.
// renderPage is App's own page renderer (with section theming
// applied), so the hosted page is the real thing, not a copy.
export function HomePage({ renderPage }: { renderPage: (view: View) => ReactNode }) {
  const { homePageKey, loaded, updateHomePage } = useHomePageSetting();

  // Nothing to show until the stored choice is read — avoids flashing
  // the picker for a frame when a page is already assigned.
  if (!loaded) return null;

  const option = findHomePageOption(homePageKey);
  if (option) return <>{renderPage(option.view)}</>;

  return (
    <div className="home-page-empty">
      <div className="home-page-picker-card">
        <h1 className="page-title">Home</h1>
        <p className="page-text">
          Choose which page Home should show. You can change it any time in Settings › Page
          Settings › Home Page.
        </p>
        <HomePagePicker value={null} onChange={updateHomePage} emptyLabel="Choose a page…" />
      </div>
    </div>
  );
}
