// src/App.tsx
import { useEffect, useState } from "react";
import { View } from "./types/nav";
import { getDb } from "./db/database";
import { Sidebar } from "./components/Sidebar";
import { HomePage } from "./pages/HomePage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { RecipesHomePage } from "./pages/RecipesHomePage";
import { RecipeCategoryPage } from "./pages/RecipeCategoryPage";
import { RecipeDetailPage } from "./pages/RecipeDetailPage";
import { RecipesGraphPage } from "./pages/RecipesGraphPage";
import { SettingsHomePage } from "./pages/SettingsHomePage";
import { SettingsIconsPage } from "./pages/SettingsIconsPage";
import { SettingsTextPage } from "./pages/SettingsTextPage";
import { SettingsButtonsPage } from "./pages/SettingsButtonsPage";
import { SettingsThemePage } from "./pages/SettingsThemePage";
import { ResponsibilitiesHomePage } from "./pages/ResponsibilitiesHomePage";
import { ResponsibilityDetailPage } from "./pages/ResponsibilityDetailPage";
import { DreamWebPage } from "./pages/DreamWebPage";
import { DreamDetailPage } from "./pages/DreamDetailPage";
import { IconProvider } from "./icons/IconContext";
import { TextElementProvider } from "./icons/TextElementContext";
import { ButtonStyleProvider } from "./icons/ButtonStyleContext";
import { ThemeProvider } from "./theme/ThemeContext";
import { ScreenCaptureWidget } from "./capture/ScreenCaptureWidget";
import "./App.css";

export default function App() {
  const [view, setView] = useState<View>({ type: "home" });
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    getDb().then(() => setDbReady(true));
  }, []);

  const renderPage = () => {
    switch (view.type) {
      case "home":
        return <HomePage />;
      case "placeholder":
        return <PlaceholderPage label={view.label} />;
      case "recipes-home":
        return <RecipesHomePage onNavigate={setView} />;
      case "recipes-graph":
        return (
          <RecipesGraphPage
            categoryId={view.categoryId}
            categoryName={view.categoryName}
            onNavigate={setView}
          />
        );
      case "recipes-category":
        return (
          <RecipeCategoryPage
            categoryId={view.categoryId}
            categoryName={view.categoryName}
            onNavigate={setView}
          />
        );
      case "recipe-detail":
        return (
          <RecipeDetailPage
            categoryId={view.categoryId}
            categoryName={view.categoryName}
            recipeId={view.recipeId}
            onNavigate={setView}
          />
        );
      case "settings-home":
        return <SettingsHomePage onNavigate={setView} />;
      case "settings-icons":
        return <SettingsIconsPage onNavigate={setView} focusKey={view.focusKey} />;
      case "settings-text":
        return <SettingsTextPage onNavigate={setView} focusKey={view.focusKey} />;
      case "settings-buttons":
        return <SettingsButtonsPage onNavigate={setView} focusKey={view.focusKey} />;
      case "settings-theme":
        return <SettingsThemePage onNavigate={setView} focusKey={view.focusKey} />;
      case "responsibilities-home":
        return <ResponsibilitiesHomePage onNavigate={setView} />;
      case "responsibility-detail":
        return (
          <ResponsibilityDetailPage
            responsibilityId={view.responsibilityId}
            onNavigate={setView}
          />
        );
      case "dreams-web":
        return <DreamWebPage onNavigate={setView} />;
      case "dream-detail":
        return <DreamDetailPage dreamId={view.dreamId} onNavigate={setView} />;
    }
  };

  if (!dbReady) {
    return (
      <div className="app-shell">
        <div className="app-content">
          <p style={{ padding: 40 }}>Loading database…</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <IconProvider>
        <TextElementProvider>
          <ButtonStyleProvider>
            <div className="app-shell">
              <Sidebar view={view} onNavigate={setView} />
              <main className="app-content">{renderPage()}</main>
            </div>
            <ScreenCaptureWidget view={view} onNavigate={setView} />
          </ButtonStyleProvider>
        </TextElementProvider>
      </IconProvider>
    </ThemeProvider>
  );
}
