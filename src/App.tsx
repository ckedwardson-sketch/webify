// src/App.tsx
import { useEffect, useRef, useState } from "react";
import { View } from "./types/nav";
import { PathEntry, resolveLabel, staticLabel, viewKey } from "./nav/navHistory";
import { NavHistoryBar } from "./components/NavHistoryBar";
import { getDb } from "./db/database";
import { listenForIncomingSync } from "./db/sync";
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
import { SettingsMobilePage } from "./pages/SettingsMobilePage";
import { SettingsEditorPage } from "./pages/SettingsEditorPage";
import { SettingsHeadersPage } from "./pages/SettingsHeadersPage";
import { SettingsIssuesPage } from "./pages/SettingsIssuesPage";
import { SettingsSyncPage } from "./pages/SettingsSyncPage";
import { SettingsWidgetVisibilityPage } from "./pages/SettingsWidgetVisibilityPage";
import { SettingsPanelMemoryPage } from "./pages/SettingsPanelMemoryPage";
import { SettingsDynamicSearchPage } from "./pages/SettingsDynamicSearchPage";
import { SettingsPageSettingsPage } from "./pages/SettingsPageSettingsPage";
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
import { VaultPage } from "./pages/VaultPage";
import { VaultSessionProvider } from "./vault/VaultSessionContext";
import { SkillsHomePage } from "./pages/SkillsHomePage";
import { SkillTreePage } from "./pages/SkillTreePage";
import { QuickAppsHomePage } from "./pages/QuickAppsHomePage";
import { RaftWithDogFullscreenPage } from "./pages/RaftWithDogFullscreenPage";
import { SleepStudyPage } from "./pages/SleepStudyPage";
import { IconProvider } from "./icons/IconContext";
import { TextElementProvider } from "./icons/TextElementContext";
import { HeaderStyleProvider } from "./icons/HeaderStyleContext";
import { ButtonStyleProvider } from "./icons/ButtonStyleContext";
import { ThemeProvider, useTheme } from "./theme/ThemeContext";
import { useMobileLayout } from "./theme/useMobileLayout";
import { computeMobileLayout, MobileMode } from "./theme/mobileLayout";
import { SectionThemeScope, ThemeSection } from "./theme/SectionThemeScope";
import { ScreenCaptureWidget } from "./capture/ScreenCaptureWidget";
import { RearrangeModeProvider, useRearrangeMode } from "./rearrange/RearrangeModeContext";
import { RearrangeToolbar } from "./rearrange/RearrangeToolbar";
import { EditorSettingsProvider } from "./editor/EditorSettingsContext";
import { UiPreferencesProvider } from "./context/UiPreferencesContext";
import { fetchUiPreferences, setUiPreference } from "./db/uiPreferences";
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
  const [dbError, setDbError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpenState] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(max-width: 768px)").matches
  );

  // Persists sidebarOpen through ui_preferences, but only when the user
  // has opted in via the "Remember sidebar open/closed" master toggle
  // (Settings > Panel & Layout Memory) — the stored value is always
  // written on every change below, but only ever READ back on next
  // launch if rememberSidebarOpen is on, so today's matchMedia-only
  // behavior is unchanged for anyone who hasn't opted in.
  const setSidebarOpen = (next: boolean) => {
    setSidebarOpenState(next);
    setUiPreference("sidebarOpen", next ? "1" : "0").catch((err) =>
      console.warn("Failed to persist sidebarOpen preference:", err)
    );
  };

  // Multi-pane mode (triggered from Notes) — the left column is a
  // self-contained Notes app (its own tree + editor, own open-note
  // state) for reading/editing notes; the right column shows a second,
  // independent "view" that Sidebar/NavHistoryBar drive, for freely
  // browsing the rest of the app. The two are intentionally decoupled —
  // see navigate()/navigateDualLeft()/enterDualPane()/exitDualPane().
  const [dualPane, setDualPane] = useState(false);
  const [dualPaneRightView, setDualPaneRightView] = useState<View>({ type: "home" });
  const [dualPaneNotesPageId, setDualPaneNotesPageId] = useState<number | undefined>(undefined);
  const [dualPaneLeftCollapsed, setDualPaneLeftCollapsed] = useState(false);

  // The "user path" trail (NavHistoryBar) — separate from `view` itself.
  // navigate() below keeps this in sync: it compacts when the user
  // doubles back onto an already-visited entry, and resets when
  // {reset: true} is passed (sidebar section switches only).
  const [path, setPath] = useState<PathEntry[]>(() => [
    { key: viewKey({ type: "home" }), view: { type: "home" }, label: staticLabel({ type: "home" }) },
  ]);
  const labelCache = useRef(new Map<string, string>());

  // The "real" navigation — always used outside multi-pane mode, and
  // also used by exitDualPane() to land the app on whatever the right
  // pane was showing once multi-pane mode ends.
  const applyRealNavigation = (next: View, opts?: { reset?: boolean }) => {
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

  // While multi-pane mode is active, every navigation call from the
  // right side — the right pane's own page, the global Sidebar,
  // NavHistoryBar's breadcrumbs — flows through this same function, so
  // all of them drive the right pane instead of leaving multi-pane mode
  // or touching the real `view`. The left pane's Notes tree does NOT use
  // this — see navigateDualLeft — so selecting a note on the left can
  // never clobber whatever the right pane is showing.
  const navigate = (next: View, opts?: { reset?: boolean }) => {
    if (dualPane) {
      setDualPaneRightView(next);
      return;
    }
    applyRealNavigation(next, opts);
  };

  const resetNavigate = (next: View) => navigate(next, { reset: true });

  // The left pane only ever shows Notes, so it only ever needs to track
  // its own open note id — never routed through `navigate`/`dualPaneRightView`.
  const navigateDualLeft = (next: View) => {
    if (next.type === "notes") setDualPaneNotesPageId(next.pageId);
  };

  const enterDualPane = () => {
    setDualPaneRightView(view);
    setDualPaneNotesPageId(view.type === "notes" ? view.pageId : undefined);
    setDualPaneLeftCollapsed(false);
    setSidebarOpen(false);
    setDualPane(true);
  };

  const exitDualPane = () => {
    setDualPane(false);
    applyRealNavigation(dualPaneRightView);
  };

  useEffect(() => {
  getDb()
    .then(async () => {
      setDbReady(true);
      // Only ever fires on the computer, where the Rust sync server can
      // receive an upload pushed from the phone at any time (see
      // src-tauri/src/sync.rs and db/sync.ts) — harmless to register on
      // the phone too, it just never triggers there.
      listenForIncomingSync().catch((err) =>
        console.warn("Failed to register sync listener:", err)
      );
      // Apply stored ui_preferences overrides once, at startup — after
      // the matchMedia-derived sidebarOpen default and the plain
      // useState(false) dualPane default have already been computed
      // above, so a user who's never touched either setting sees
      // exactly today's behavior.
      try {
        const prefs = await fetchUiPreferences();
        if (prefs.rememberSidebarOpen === "1" && prefs.sidebarOpen !== undefined) {
          setSidebarOpenState(prefs.sidebarOpen === "1");
        }
        if (prefs.dualPaneDefault === "1") {
          setDualPane(true);
        }
      } catch (err) {
        console.warn("Failed to load ui_preferences on startup:", err);
      }
    })
    .catch((error) => {
      console.error("DATABASE INITIALIZATION FAILED:", error);
      setDbError(error instanceof Error ? error.message : String(error));
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

  const renderPage = (v: View = view) => {
    switch (v.type) {
      case "home":
        return <HomePage />;
      case "placeholder":
        return <PlaceholderPage label={v.label} />;
      case "recipes-home":
        return <RecipesHomePage onNavigate={navigate} />;
      case "recipes-graph":
        return (
          <RecipesGraphPage
            categoryId={v.categoryId}
            categoryName={v.categoryName}
            onNavigate={navigate}
          />
        );
      case "recipes-category":
        return (
          <RecipeCategoryPage
            categoryId={v.categoryId}
            categoryName={v.categoryName}
            onNavigate={navigate}
          />
        );
      case "recipe-detail":
        return (
          <RecipeDetailPage
            categoryId={v.categoryId}
            categoryName={v.categoryName}
            recipeId={v.recipeId}
            onNavigate={navigate}
          />
        );
      case "settings-home":
        return <SettingsHomePage onNavigate={navigate} />;
      case "settings-icons":
        return <SettingsIconsPage onNavigate={navigate} focusKey={v.focusKey} />;
      case "settings-text":
        return <SettingsTextPage onNavigate={navigate} focusKey={v.focusKey} />;
      case "settings-buttons":
        return <SettingsButtonsPage onNavigate={navigate} focusKey={v.focusKey} />;
      case "settings-theme":
        return <SettingsThemePage onNavigate={navigate} focusKey={v.focusKey} />;
      case "settings-mobile":
        return <SettingsMobilePage onNavigate={navigate} />;
      case "settings-editor":
        return <SettingsEditorPage onNavigate={navigate} focusKey={v.focusKey} />;
      case "settings-headers":
        return <SettingsHeadersPage onNavigate={navigate} focusKey={v.focusKey} />;
      case "settings-issues":
        return <SettingsIssuesPage onNavigate={navigate} />;
      case "settings-sync":
        return <SettingsSyncPage onNavigate={navigate} />;
      case "settings-widget-visibility":
        return <SettingsWidgetVisibilityPage onNavigate={navigate} focusKey={v.focusKey} />;
      case "settings-panel-memory":
        return <SettingsPanelMemoryPage onNavigate={navigate} focusKey={v.focusKey} />;
      case "settings-dynamic-search":
        return <SettingsDynamicSearchPage onNavigate={navigate} />;
      case "settings-page-settings":
        return <SettingsPageSettingsPage onNavigate={navigate} focusKey={v.focusKey} />;
      case "responsibilities-home":
        return <ResponsibilitiesHomePage onNavigate={navigate} />;
      case "responsibilities-manage":
        return <ResponsibilitiesManagePage onNavigate={navigate} />;
      case "responsibility-detail":
        return (
          <ResponsibilityDetailPage
            responsibilityId={v.responsibilityId}
            onNavigate={navigate}
          />
        );
      case "dreams-web":
        return <DreamWebPage onNavigate={navigate} />;
      case "dream-detail":
        return <DreamDetailPage dreamId={v.dreamId} onNavigate={navigate} />;
      case "goals-home":
        return <GoalsHomePage onNavigate={navigate} />;
      case "goal-detail":
        return <GoalDetailPage goalId={v.goalId} onNavigate={navigate} />;
      case "goal-web":
        return <GoalWebPage goalId={v.goalId} onNavigate={navigate} />;
      case "projects-home":
        return <ProjectsHomePage onNavigate={navigate} />;
      case "project-detail":
        return <ProjectDetailPage projectId={v.projectId} onNavigate={navigate} />;
      case "project-journal":
        return (
          <ProjectJournalPage
            widgetId={v.widgetId}
            projectId={v.projectId}
            goalId={v.goalId}
            onNavigate={navigate}
          />
        );
      case "project-board":
        return (
          <ProjectBoardPage
            widgetId={v.widgetId}
            projectId={v.projectId}
            goalId={v.goalId}
            onNavigate={navigate}
          />
        );
      case "project-table":
        return (
          <ProjectTablePage
            widgetId={v.widgetId}
            projectId={v.projectId}
            goalId={v.goalId}
            onNavigate={navigate}
          />
        );
      case "progress-node-detail":
        return (
          <ProgressNodeDetailPage
            nodeId={v.nodeId}
            projectId={v.projectId}
            goalId={v.goalId}
            onNavigate={navigate}
          />
        );
      case "notes":
        return (
          <NotesPage
            pageId={v.pageId}
            onNavigate={navigate}
            onEnterDualPane={enterDualPane}
            dualPaneActive={dualPane}
          />
        );
      case "vault":
        return <VaultPage onNavigate={navigate} />;
      case "skills-home":
        return <SkillsHomePage onNavigate={navigate} />;
      case "skill-tree":
        return <SkillTreePage skillId={v.skillId} onNavigate={navigate} />;
      case "quick-apps-home":
        return <QuickAppsHomePage onNavigate={navigate} />;
      case "quick-apps-raft-dog-fullscreen":
        return <RaftWithDogFullscreenPage onNavigate={navigate} />;
      case "quick-apps-sleep-study":
        return <SleepStudyPage onNavigate={navigate} />;
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

  if (dbError) {
    return (
      <div className="app-shell">
        <div className="app-content">
          <div style={{ padding: 40, maxWidth: 560 }}>
            <h2 style={{ marginTop: 0 }}>Couldn't open the database</h2>
            <p>The app's local database failed to load, so nothing else can render. Details:</p>
            <pre style={{ whiteSpace: "pre-wrap", background: "rgba(127,29,29,0.1)", padding: 12, borderRadius: 8 }}>
              {dbError}
            </pre>
            <p>Restarting the app usually recovers from a transient failure. If this keeps happening after a restart, the underlying database file or its folder may be missing or corrupted.</p>
          </div>
        </div>
      </div>
    );
  }

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

  const dualPaneRightPage = dualPane
    ? sectionFor(dualPaneRightView.type)
      ? (
          <SectionThemeScope section={sectionFor(dualPaneRightView.type)!}>
            {renderPage(dualPaneRightView)}
          </SectionThemeScope>
        )
      : renderPage(dualPaneRightView)
    : null;

  return (
    <ThemeProvider>
      <IconProvider>
        <TextElementProvider>
          <HeaderStyleProvider>
            <ButtonStyleProvider>
              <EditorSettingsProvider>
              <UiPreferencesProvider>
                <VaultSessionProvider>
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
                          dualPane={dualPane}
                          dualPaneNotesPageId={dualPaneNotesPageId}
                          dualPaneRightPage={dualPaneRightPage}
                          dualPaneLeftCollapsed={dualPaneLeftCollapsed}
                          onToggleDualPaneLeft={() => setDualPaneLeftCollapsed((v) => !v)}
                          onExitDualPane={exitDualPane}
                          navigateDualLeft={navigateDualLeft}
                        />
                      </RearrangeModeProvider>
                      <ScreenCaptureButtonGate view={view} onNavigate={navigate} />
                      <DynamicOverlayPanel view={view} onNavigate={navigate} />
                      <DynamicOverlayGutter view={view} />
                      <OverlayTargetHighlighter view={view} />
                      <ColorModeSurfaceHighlighter />
                      <DynamicOverlayToggleGate />
                    </FieldStyleRegistryProvider>
                  </DynamicOverlayProvider>
                </PageBackgroundProvider>
                </VaultSessionProvider>
              </UiPreferencesProvider>
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
  dualPane,
  dualPaneNotesPageId,
  dualPaneRightPage,
  dualPaneLeftCollapsed,
  onToggleDualPaneLeft,
  onExitDualPane,
  navigateDualLeft,
}: {
  view: View;
  onSidebarNavigate: (view: View) => void;
  path: PathEntry[];
  onJump: (view: View) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  page: React.ReactNode;
  dualPane: boolean;
  dualPaneNotesPageId: number | undefined;
  dualPaneRightPage: React.ReactNode;
  dualPaneLeftCollapsed: boolean;
  onToggleDualPaneLeft: () => void;
  onExitDualPane: () => void;
  navigateDualLeft: (view: View) => void;
}) {
  const { active: rearranging } = useRearrangeMode();
  const mobile = useMobileLayout();
  const { theme } = useTheme();

  // Multi-pane mode force-narrows both columns to a "phone-width" look
  // (see NotesPage.css / the app's existing html.mobile-layout rules)
  // regardless of the real viewport, by toggling the same class the
  // Settings > Theme > Mobile layout setting drives. Restores whatever
  // that setting would compute for the real viewport on exit.
  useEffect(() => {
    if (!dualPane) return;
    document.documentElement.classList.add("mobile-layout");
    return () => {
      const mode = (theme.mobileMode as MobileMode) || "auto";
      document.documentElement.classList.toggle("mobile-layout", computeMobileLayout(mode));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dualPane]);

  return (
    <div
      className={`app-shell${sidebarOpen ? "" : " sidebar-collapsed"}${rearranging ? " rearrange-mode-active" : ""}`}
    >
      {sidebarOpen && mobile && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
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
        {!dualPane && <NavHistoryBar path={path} onJump={onJump} />}
        {dualPane ? (
          <div className="dual-pane-shell">
            {!dualPaneLeftCollapsed && (
              <div className="dual-pane-left">
                <NotesPage
                  pageId={dualPaneNotesPageId}
                  onNavigate={navigateDualLeft}
                  dualPaneActive
                />
              </div>
            )}
            <button
              className="dual-pane-left-toggle"
              type="button"
              onClick={onToggleDualPaneLeft}
              title={dualPaneLeftCollapsed ? "Show notes list" : "Hide notes list"}
            >
              {dualPaneLeftCollapsed ? "☰" : "‹"}
            </button>
            <main className="app-content dual-pane-right" data-color-surface="page">
              {dualPaneRightPage}
            </main>
            <button className="dual-pane-exit" type="button" onClick={onExitDualPane}>
              ✕ Exit dual-pane
            </button>
          </div>
        ) : (
          <main className="app-content" data-color-surface="page">{page}</main>
        )}
      </div>
    </div>
  );
}

// Global floating toggle for "Dynamic Overlay" mode (Part 2) — visible
// on every page regardless of sidebar state, since overlay mode is a
// cross-page feature. Rendered as a sibling of AppShell so it survives
// sidebar collapse/expand.
function ScreenCaptureButtonGate({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
  const { theme } = useTheme();
  if (theme.showCaptureButton === "0") return null;
  return <ScreenCaptureWidget view={view} onNavigate={onNavigate} />;
}

function DynamicOverlayToggleGate() {
  const { theme } = useTheme();
  if (theme.showDynamicSearchButton === "0") return null;
  return <DynamicOverlayToggle />;
}

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
