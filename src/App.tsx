// src/App.tsx
import { useEffect, useRef, useState } from "react";
import { View } from "./types/nav";
import { PathEntry, resolveLabel, staticLabel, viewKey } from "./nav/navHistory";
import { NavHistoryBar } from "./components/NavHistoryBar";
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
import { SettingsEditorPage } from "./pages/SettingsEditorPage";
import { SettingsHeadersPage } from "./pages/SettingsHeadersPage";
import { SettingsIssuesPage } from "./pages/SettingsIssuesPage";
import { SettingsDynamicSearchPage } from "./pages/SettingsDynamicSearchPage";
import { ResponsibilitiesHomePage } from "./pages/ResponsibilitiesHomePage";
import { ResponsibilitiesManagePage } from "./pages/ResponsibilitiesManagePage";
import { ResponsibilityDetailPage } from "./pages/ResponsibilityDetailPage";
import { DreamWebPage } from "./pages/DreamWebPage";
import { DreamDetailPage } from "./pages/DreamDetailPage";
import { GoalsHomePage } from "./pages/GoalsHomePage";
import { GoalDetailPage } from "./pages/GoalDetailPage";
import { GoalWebPage } from "./pages/GoalWebPage";
import { ProjectsHomePage } from "./pages/ProjectsHomePage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectJournalPage } from "./pages/ProjectJournalPage";
import { ProjectBoardPage } from "./pages/ProjectBoardPage";
import { ProjectTablePage } from "./pages/ProjectTablePage";
import { ProgressNodeDetailPage } from "./pages/ProgressNodeDetailPage";
import { NotesPage } from "./pages/NotesPage";
import { IconProvider } from "./icons/IconContext";
import { TextElementProvider } from "./icons/TextElementContext";
import { HeaderStyleProvider } from "./icons/HeaderStyleContext";
import { ButtonStyleProvider } from "./icons/ButtonStyleContext";
import { ThemeProvider } from "./theme/ThemeContext";
import { SectionThemeScope, ThemeSection } from "./theme/SectionThemeScope";
import { ScreenCaptureWidget } from "./capture/ScreenCaptureWidget";
import { RearrangeModeProvider, useRearrangeMode } from "./rearrange/RearrangeModeContext";
import { RearrangeToolbar } from "./rearrange/RearrangeToolbar";
import { EditorSettingsProvider } from "./editor/EditorSettingsContext";
import { DynamicOverlayProvider, useDynamicOverlay } from "./overlay/DynamicOverlayContext";
import { DynamicOverlayPanel } from "./overlay/DynamicOverlayPanel";
import { DynamicOverlayGutter } from "./overlay/DynamicOverlayGutter";
import { OverlayTargetHighlighter } from "./overlay/OverlayTargetHighlighter";
import { ColorModeSurfaceHighlighter } from "./overlay/ColorModeSurfaceHighlighter";
import { PageBackgroundProvider } from "./theme/PageBackgroundContext";
import { FieldStyleRegistryProvider } from "./rearrange/FieldStyleRegistryContext";
import "./App.css";

export default function App() {
  const [view, setViewState] = useState<View>({ type: "home" });
  const [dbReady, setDbReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // The "user path" trail (NavHistoryBar) — separate from `view` itself.
  // navigate() below keeps this in sync: it compacts when the user
  // doubles back onto an already-visited entry, and resets when
  // {reset: true} is passed (sidebar section switches only).
  const [path, setPath] = useState<PathEntry[]>(() => [
    { key: viewKey({ type: "home" }), view: { type: "home" }, label: staticLabel({ type: "home" }) },
  ]);
  const labelCache = useRef(new Map<string, string>());

  const navigate = (next: View, opts?: { reset?: boolean }) => {
    setViewState(next);
    const key = viewKey(next);
    setPath((prev) => {
      if (opts?.reset) {
        return [{ key, view: next, label: labelCache.current.get(key) ?? staticLabel(next) }];
      }
      const existingIdx = prev.findIndex((entry) => entry.key === key);
      if (existingIdx !== -1) {
        // Doubling back onto a page already in the trail — compact to it
        // instead of growing the trail further.
        const truncated = prev.slice(0, existingIdx + 1);
        truncated[truncated.length - 1] = { ...truncated[truncated.length - 1], view: next };
        return truncated;
      }
      if (prev.length > 0 && prev[prev.length - 1].key === key) {
        const copy = prev.slice();
        copy[copy.length - 1] = { ...copy[copy.length - 1], view: next };
        return copy;
      }
      return [...prev, { key, view: next, label: labelCache.current.get(key) ?? staticLabel(next) }];
    });
  };

  const resetNavigate = (next: View) => navigate(next, { reset: true });

  useEffect(() => {
  getDb()
    .then(() => setDbReady(true))
    .catch((error) => {
      console.error("DATABASE INITIALIZATION FAILED:", error);
    });
}, []);

  // Resolves the real display name (dream/project/goal/... title) for
  // whichever view is current, then backfills it onto the matching path
  // entry — entries start with a static fallback label and upgrade once
  // this resolves, and stay cached so revisiting is instant.
  useEffect(() => {
    const key = viewKey(view);
    let cancelled = false;
    resolveLabel(view).then((label) => {
      if (cancelled) return;
      labelCache.current.set(key, label);
      setPath((prev) => prev.map((entry) => (entry.key === key ? { ...entry, label } : entry)));
    });
    return () => {
      cancelled = true;
    };
  }, [view]);

  const renderPage = () => {
    switch (view.type) {
      case "home":
        return <HomePage />;
      case "placeholder":
        return <PlaceholderPage label={view.label} />;
      case "recipes-home":
        return <RecipesHomePage onNavigate={navigate} />;
      case "recipes-graph":
        return (
          <RecipesGraphPage
            categoryId={view.categoryId}
            categoryName={view.categoryName}
            onNavigate={navigate}
          />
        );
      case "recipes-category":
        return (
          <RecipeCategoryPage
            categoryId={view.categoryId}
            categoryName={view.categoryName}
            onNavigate={navigate}
          />
        );
      case "recipe-detail":
        return (
          <RecipeDetailPage
            categoryId={view.categoryId}
            categoryName={view.categoryName}
            recipeId={view.recipeId}
            onNavigate={navigate}
          />
        );
      case "settings-home":
        return <SettingsHomePage onNavigate={navigate} />;
      case "settings-icons":
        return <SettingsIconsPage onNavigate={navigate} focusKey={view.focusKey} />;
      case "settings-text":
        return <SettingsTextPage onNavigate={navigate} focusKey={view.focusKey} />;
      case "settings-buttons":
        return <SettingsButtonsPage onNavigate={navigate} focusKey={view.focusKey} />;
      case "settings-theme":
        return <SettingsThemePage onNavigate={navigate} focusKey={view.focusKey} />;
      case "settings-editor":
        return <SettingsEditorPage onNavigate={navigate} focusKey={view.focusKey} />;
      case "settings-headers":
        return <SettingsHeadersPage onNavigate={navigate} focusKey={view.focusKey} />;
      case "settings-issues":
        return <SettingsIssuesPage onNavigate={navigate} />;
      case "settings-dynamic-search":
        return <SettingsDynamicSearchPage onNavigate={navigate} />;
      case "responsibilities-home":
        return <ResponsibilitiesHomePage onNavigate={navigate} />;
      case "responsibilities-manage":
        return <ResponsibilitiesManagePage onNavigate={navigate} />;
      case "responsibility-detail":
        return (
          <ResponsibilityDetailPage
            responsibilityId={view.responsibilityId}
            onNavigate={navigate}
          />
        );
      case "dreams-web":
        return <DreamWebPage onNavigate={navigate} />;
      case "dream-detail":
        return <DreamDetailPage dreamId={view.dreamId} onNavigate={navigate} />;
      case "goals-home":
        return <GoalsHomePage onNavigate={navigate} />;
      case "goal-detail":
        return <GoalDetailPage goalId={view.goalId} onNavigate={navigate} />;
      case "goal-web":
        return <GoalWebPage goalId={view.goalId} onNavigate={navigate} />;
      case "projects-home":
        return <ProjectsHomePage onNavigate={navigate} />;
      case "project-detail":
        return <ProjectDetailPage projectId={view.projectId} onNavigate={navigate} />;
      case "project-journal":
        return (
          <ProjectJournalPage
            widgetId={view.widgetId}
            projectId={view.projectId}
            goalId={view.goalId}
            onNavigate={navigate}
          />
        );
      case "project-board":
        return (
          <ProjectBoardPage
            widgetId={view.widgetId}
            projectId={view.projectId}
            goalId={view.goalId}
            onNavigate={navigate}
          />
        );
      case "project-table":
        return (
          <ProjectTablePage
            widgetId={view.widgetId}
            projectId={view.projectId}
            goalId={view.goalId}
            onNavigate={navigate}
          />
        );
      case "progress-node-detail":
        return (
          <ProgressNodeDetailPage
            nodeId={view.nodeId}
            projectId={view.projectId}
            goalId={view.goalId}
            onNavigate={navigate}
          />
        );
      case "notes":
        return <NotesPage pageId={view.pageId} onNavigate={navigate} />;
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

  const page = sectionFor(view.type) ? (
    <SectionThemeScope section={sectionFor(view.type)!}>{renderPage()}</SectionThemeScope>
  ) : (
    renderPage()
  );

  return (
    <ThemeProvider>
      <IconProvider>
        <TextElementProvider>
          <HeaderStyleProvider>
            <ButtonStyleProvider>
              <EditorSettingsProvider>
                <PageBackgroundProvider view={view}>
                  <DynamicOverlayProvider>
                    <FieldStyleRegistryProvider>
                      <RearrangeModeProvider>
                        <AppShell
                          view={view}
                          onSidebarNavigate={resetNavigate}
                          path={path}
                          onJump={navigate}
                          sidebarOpen={sidebarOpen}
                          setSidebarOpen={setSidebarOpen}
                          page={page}
                        />
                      </RearrangeModeProvider>
                      <ScreenCaptureWidget view={view} onNavigate={navigate} />
                      <DynamicOverlayPanel view={view} onNavigate={navigate} />
                      <DynamicOverlayGutter view={view} />
                      <OverlayTargetHighlighter view={view} />
                      <ColorModeSurfaceHighlighter />
                      <DynamicOverlayToggle />
                    </FieldStyleRegistryProvider>
                  </DynamicOverlayProvider>
                </PageBackgroundProvider>
              </EditorSettingsProvider>
            </ButtonStyleProvider>
          </HeaderStyleProvider>
        </TextElementProvider>
      </IconProvider>
    </ThemeProvider>
  );
}

// Split out from App() so it can call useRearrangeMode() — that hook
// needs a RearrangeModeProvider ancestor, which App() itself sits
// outside of (the provider is one of App's own returned children).
function AppShell({
  view,
  onSidebarNavigate,
  path,
  onJump,
  sidebarOpen,
  setSidebarOpen,
  page,
}: {
  view: View;
  onSidebarNavigate: (view: View) => void;
  path: PathEntry[];
  onJump: (view: View) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  page: React.ReactNode;
}) {
  const { active: rearranging } = useRearrangeMode();

  return (
    <div
      className={`app-shell${sidebarOpen ? "" : " sidebar-collapsed"}${rearranging ? " rearrange-mode-active" : ""}`}
    >
      {sidebarOpen && (
        <Sidebar view={view} onNavigate={onSidebarNavigate} onToggle={() => setSidebarOpen(false)} />
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
      <RearrangeToolbar />
      <div className="app-main-column">
        <NavHistoryBar path={path} onJump={onJump} />
        <main className="app-content" data-color-surface="page">{page}</main>
      </div>
    </div>
  );
}

// Global floating toggle for "Dynamic Overlay" mode (Part 2) — visible
// on every page regardless of sidebar state, since overlay mode is a
// cross-page feature. Rendered as a sibling of AppShell so it survives
// sidebar collapse/expand.
function DynamicOverlayToggle() {
  const { active, toggle } = useDynamicOverlay();
  return (
    <button
      className={`dyn-overlay-toggle${active ? " active" : ""}`}
      onClick={toggle}
      title={
        active
          ? "Exit Dynamic Search overlay"
          : "Open Dynamic Search overlay — while active, hover any tagged element and press Ctrl (or \"J\") to edit its setting inline, no navigating away"
      }
    >
      {active ? "✕ Dynamic Search" : "🔍 Dynamic Search"}
    </button>
  );
}
