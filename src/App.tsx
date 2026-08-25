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
import { SettingsIssuesPage } from "./pages/SettingsIssuesPage";
import { ResponsibilitiesHomePage } from "./pages/ResponsibilitiesHomePage";
import { ResponsibilitiesManagePage } from "./pages/ResponsibilitiesManagePage";
import { ResponsibilityDetailPage } from "./pages/ResponsibilityDetailPage";
import { DreamWebPage } from "./pages/DreamWebPage";
import { DreamDetailPage } from "./pages/DreamDetailPage";
import { ProjectsHomePage } from "./pages/ProjectsHomePage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectJournalPage } from "./pages/ProjectJournalPage";
import { ProjectBoardPage } from "./pages/ProjectBoardPage";
import { ProgressWebPage } from "./pages/ProgressWebPage";
import { ProgressNodeDetailPage } from "./pages/ProgressNodeDetailPage";
import { IconProvider } from "./icons/IconContext";
import { TextElementProvider } from "./icons/TextElementContext";
import { ButtonStyleProvider } from "./icons/ButtonStyleContext";
import { ThemeProvider } from "./theme/ThemeContext";
import { SectionThemeScope, ThemeSection } from "./theme/SectionThemeScope";
import { ScreenCaptureWidget } from "./capture/ScreenCaptureWidget";
import "./App.css";

export default function App() {
  const [view, setView] = useState<View>({ type: "home" });
  const [dbReady, setDbReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
  getDb()
    .then(() => setDbReady(true))
    .catch((error) => {
      console.error("DATABASE INITIALIZATION FAILED:", error);
    });
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
      case "settings-issues":
        return <SettingsIssuesPage onNavigate={setView} />;
      case "responsibilities-home":
        return <ResponsibilitiesHomePage onNavigate={setView} />;
      case "responsibilities-manage":
        return <ResponsibilitiesManagePage onNavigate={setView} />;
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
      case "projects-home":
        return <ProjectsHomePage onNavigate={setView} />;
      case "project-detail":
        return <ProjectDetailPage projectId={view.projectId} onNavigate={setView} />;
      case "project-journal":
        return (
          <ProjectJournalPage
            widgetId={view.widgetId}
            projectId={view.projectId}
            onNavigate={setView}
          />
        );
      case "project-board":
        return (
          <ProjectBoardPage
            widgetId={view.widgetId}
            projectId={view.projectId}
            onNavigate={setView}
          />
        );
      case "progress-web":
        return <ProgressWebPage onNavigate={setView} />;
      case "progress-node-detail":
        return <ProgressNodeDetailPage nodeId={view.nodeId} onNavigate={setView} />;
    }
  };

  // Recipes / Dream Web / Responsibilities are the three sections a
  // saved theme can give a distinct palette layer via *ThemeOverrides
  // (see themeDefaults.ts) — everything else (Home, Projects, Settings)
  // always renders the plain global theme.
  const sectionFor = (viewType: View["type"]): ThemeSection | null => {
    if (viewType.startsWith("recipe")) return "recipe";
    if (viewType.startsWith("dream")) return "dream";
    if (viewType.startsWith("responsibilit")) return "responsibility";
    return null;
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
            <div className={`app-shell${sidebarOpen ? "" : " sidebar-collapsed"}`}>
              {sidebarOpen && (
                <Sidebar
                  view={view}
                  onNavigate={setView}
                  onToggle={() => setSidebarOpen(false)}
                />
              )}
              {!sidebarOpen && (
                <button
                  className="sidebar-toggle sidebar-toggle-floating"
                  type="button"
                  aria-label="Show sidebar"
                  onClick={() => setSidebarOpen(true)}
                >
                  ☰
                </button>
              )}
              <main className="app-content">
                {sectionFor(view.type) ? (
                  <SectionThemeScope section={sectionFor(view.type)!}>{renderPage()}</SectionThemeScope>
                ) : (
                  renderPage()
                )}
              </main>
            </div>
            <ScreenCaptureWidget view={view} onNavigate={setView} />
          </ButtonStyleProvider>
        </TextElementProvider>
      </IconProvider>
    </ThemeProvider>
  );
}
