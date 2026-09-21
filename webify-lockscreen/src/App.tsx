// src/App.tsx
import { useEffect, useRef, useState } from "react";
import { View } from "./types/nav";
import { PathEntry, resolveLabel, staticLabel, viewKey, sidebarSectionForView } from "./nav/navHistory";
import { NavHistoryBar } from "./components/NavHistoryBar";
import { getDb } from "./db/database";
import { listenForIncomingSync } from "./db/sync";
import { startLockScreenSync } from "./lockscreen/lockScreenSync";
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
import { SettingsLockScreenPage } from "./pages/SettingsLockScreenPage";
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
import { TasksPage } from "./pages/TasksPage";
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
import { computeMobileLayout, isMobileLayoutActive, MobileMode } from "./theme/mobileLayout";
import { WebPaneContent, WebPaneMemory, EMPTY_WEB_PANE_MEMORY, sameWebPaneContent, webPaneContentToView } from "./types/dualPaneWeb";
import { fetchProject } from "./db/projects";
import { useUiPreferences } from "./context/UiPreferencesContext";
import { DEFAULT_DUAL_PANE_WEB_SHORTCUT, serializeKeyEvent } from "./utils/keyboardShortcut";
import { SectionThemeScope, ThemeSection } from "./theme/SectionThemeScope";
import { ScreenCaptureWidget } from "./capture/ScreenCaptureWidget";
import { SettingsContextCapturePage } from "./pages/SettingsContextCapturePage";
import { RearrangeModeProvider, useRearrangeMode } from "./rearrange/RearrangeModeContext";
import { RearrangeToolbar } from "./rearrange/RearrangeToolbar";
import { EditorSettingsProvider } from "./editor/EditorSettingsContext";
import { UiPreferencesProvider } from "./context/UiPreferencesContext";
import { WebNodeLockProvider } from "./context/WebNodeLockContext";
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

  // Two independent dual-pane mechanisms share one discriminator so
  // they can never both be active at once. "notes" is the original
  // multi-pane mode (triggered from Notes): the left column is a
  // self-contained Notes app (its own tree + editor, own open-note
  // state); the right column shows a second, independent "view" that
  // Sidebar/NavHistoryBar drive. "web" is Dual-Pane Web Mode (see
  // below): the LEFT pane is the arbitrary/normal-navigation pane and
  // the RIGHT pane always shows one of a closed set of "web" views
  // (Goal Web / Recipes Graph) — the inverse of Notes' shape. See
  // navigate()/navigateDualLeft()/enterDualPane()/exitDualPane() for
  // Notes, and enterWebDualPane()/exitWebDualPane() for web mode.
  const [dualPaneMode, setDualPaneMode] = useState<"notes" | "web" | null>(null);
  const [dualPaneRightView, setDualPaneRightView] = useState<View>({ type: "home" });
  const [dualPaneNotesPageId, setDualPaneNotesPageId] = useState<number | undefined>(undefined);
  const [dualPaneLeftCollapsed, setDualPaneLeftCollapsed] = useState(false);

  // Dual-Pane Web Mode state — independent of the Notes fields above.
  // Session-only (no DB persistence): resets every relaunch by design.
  const [webPaneContent, setWebPaneContent] = useState<WebPaneContent>({ kind: "empty" });
  const [webPaneMemory, setWebPaneMemory] = useState<WebPaneMemory>(EMPTY_WEB_PANE_MEMORY);
  const [webDualPaneBlockedMessage, setWebDualPaneBlockedMessage] = useState(false);

  // The "user path" trail (NavHistoryBar) — separate from `view` itself.
  // navigate() below keeps this in sync: it compacts when the user
  // doubles back onto an already-visited entry, and resets when
  // {reset: true} is passed (sidebar section switches only).
  const [path, setPath] = useState<PathEntry[]>(() => [
    { key: viewKey({ type: "home" }), view: { type: "home" }, label: staticLabel({ type: "home" }) },
  ]);
  const labelCache = useRef(new Map<string, string>());

  // The last view actually visited within each sidebar section (Dreams,
  // Goals, Projects, ...) — lets the sidebar send you back to wherever
  // you were several layers deep in a section instead of always
  // resetting to that section's home view on every click. Session-only
  // (not persisted): this is about not losing your place while you
  // bounce between sections in one sitting, not about restoring it after
  // relaunching the app. See Sidebar.tsx's handleClick and
  // nav/navHistory.ts's sidebarSectionForView, which both this and
  // Sidebar's own active-item highlighting key off of.
  const [lastViewBySection, setLastViewBySection] = useState<Record<string, View>>({});

  // The "real" navigation — always used outside multi-pane mode, and
  // also used by exitDualPane() to land the app on whatever the right
  // pane was showing once multi-pane mode ends.
  const applyRealNavigation = (next: View, opts?: { reset?: boolean }) => {
    setViewState(next);
    const section = sidebarSectionForView(next);
    if (section) setLastViewBySection((prev) => ({ ...prev, [section]: next }));
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

  // While Notes' multi-pane mode is active, every navigation call from
  // the right side — the right pane's own page, the global Sidebar,
  // NavHistoryBar's breadcrumbs — flows through this same function, so
  // all of them drive the right pane instead of leaving multi-pane mode
  // or touching the real `view`. The left pane's Notes tree does NOT use
  // this — see navigateDualLeft — so selecting a note on the left can
  // never clobber whatever the right pane is showing.
  //
  // While Dual-Pane Web Mode is active, navigation stays REAL — the
  // left pane behaves exactly like normal single-pane navigation. This
  // function is still the one choke point that additionally decides
  // whether the web-mode right pane needs to react to that navigation
  // (see maybeSwitchOnLeftClick/maybeSwitchOnSidebarJump below) — no
  // page component needs to know it might be affecting a right pane.
  const navigate = (next: View, opts?: { reset?: boolean }) => {
    if (dualPaneMode === "notes") {
      setDualPaneRightView(next);
      return;
    }
    const prevView = view; // captured before applyRealNavigation updates state
    applyRealNavigation(next, opts);
    if (dualPaneMode === "web") {
      if (opts?.reset) maybeSwitchOnSidebarJump(prevView, next);
      else maybeSwitchOnLeftClick(next);
    }
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
    setDualPaneMode("notes");
  };

  const exitDualPane = () => {
    setDualPaneMode(null);
    applyRealNavigation(dualPaneRightView);
  };

  // --- Dual-Pane Web Mode ---------------------------------------------

  // Clicking a project/goal on the LEFT pane that isn't the one
  // currently shown as the right pane's web switches the right pane to
  // match. A project with no linked goal has no web (Dreams is out of
  // scope entirely) — clicking it is a silent no-op, right pane
  // unchanged. Recipes category clicks are deliberately NOT handled
  // here — the right pane's Recipes scope only ever re-evaluates on
  // dual-pane re-entry (see enterWebDualPane).
  const maybeSwitchOnLeftClick = (next: View) => {
    if (next.type === "project-detail") {
      fetchProject(next.projectId).then((p) => {
        if (!p || p.goalId == null) return;
        const target: WebPaneContent = { kind: "goal-web", goalId: p.goalId };
        setWebPaneContent((current) => {
          if (sameWebPaneContent(target, current)) return current;
          return target;
        });
        setWebPaneMemory((m) => ({ ...m, Projects: target }));
      });
      return;
    }
    if (next.type === "goal-detail") {
      const target: WebPaneContent = { kind: "goal-web", goalId: next.goalId };
      setWebPaneContent((current) => {
        if (sameWebPaneContent(target, current)) return current;
        return target;
      });
      setWebPaneMemory((m) => ({ ...m, Goals: target }));
    }
  };

  // The ONE sidebar-jump case that forces a right-pane change: jumping
  // INTO Recipes from a Goal or Project DETAIL page (not a list page).
  // Every other sidebar jump — Projects<->Goals, into any
  // non-integrated page, or from a list page into Recipes — leaves the
  // right pane exactly as it was. Sidebar.tsx's clicks are the only
  // caller that ever passes {reset:true}, so that's an exact, existing
  // proxy for "this came from the sidebar."
  const maybeSwitchOnSidebarJump = (prevView: View, next: View) => {
    const prevSection = sidebarSectionForView(prevView);
    const nextSection = sidebarSectionForView(next);
    if (nextSection !== "Recipes") return;
    if (prevSection !== "Goals" && prevSection !== "Projects") return;
    const wasDetail = prevView.type === "goal-detail" || prevView.type === "project-detail";
    if (!wasDetail) return;

    const target: WebPaneContent = webPaneMemory.Recipes ?? { kind: "recipes-graph" };
    setWebPaneContent(target);
    setWebPaneMemory((m) => ({ ...m, Recipes: target }));
  };

  const enterWebDualPane = () => {
    if (isMobileLayoutActive()) {
      setWebDualPaneBlockedMessage(true);
      return;
    }
    setSidebarOpen(false);
    const section = sidebarSectionForView(view);

    if (section === "Recipes" && (view.type === "recipes-graph" || view.type === "recipes-category")) {
      // Re-entry rescoping: derive scope from wherever the left pane
      // currently sits, not from memory.
      setWebPaneContent({ kind: "recipes-graph", categoryId: view.categoryId, categoryName: view.categoryName });
    } else if (section === "Recipes") {
      setWebPaneContent(webPaneMemory.Recipes ?? { kind: "recipes-graph" });
    } else if (section === "Projects" && view.type === "projects-home") {
      setWebPaneContent(webPaneMemory.Projects ?? { kind: "empty" });
    } else if (section === "Goals" && view.type === "goals-home") {
      setWebPaneContent(webPaneMemory.Goals ?? { kind: "empty" });
    }
    // else: any detail page, Dreams, or any non-integrated page — leave
    // webPaneContent exactly as it was this session, no forced change.

    setDualPaneMode("web");
  };

  const exitWebDualPane = () => {
    setDualPaneMode(null);
    // webPaneContent/webPaneMemory deliberately untouched — session
    // memory persists across toggle-off/on; only re-entry (above)
    // re-evaluates it.
  };

  // Right-pane node clicks (GoalWebPage/RecipesGraphPage's
  // isDualPaneWebRight branch) open their target on the LEFT pane
  // instead of navigating the right pane's own web in place. This is
  // deliberately just applyRealNavigation — it does NOT call
  // maybeSwitchOnLeftClick, so the right pane never moves as a side
  // effect of something clicked inside itself (confirmed behavior). It
  // already appends to `path`, which NavHistoryBar renders on the left
  // pane in web-mode — so "back" works for free, no second stack needed.
  const onOpenOnLeftPane = (v: View) => applyRealNavigation(v);

  // The explicit "Enter Web" buttons (GoalDetailPage, GoalsHomePage,
  // ProjectsHomePage, ProjectDetailPage) — while dual-pane-web is
  // active, these target the RIGHT pane only and leave the left pane
  // exactly where it is, so the next goal/project can be opened
  // straight away without backing up first. Distinct from
  // maybeSwitchOnLeftClick, which reacts to normal left-pane navigation
  // (project-detail/goal-detail) — this is a dedicated "go look at this
  // web" action, not a click that also needs to open a detail page on
  // the left. Only wired up while dualPaneMode === "web" (see
  // onEnterGoalWeb below) — the pages themselves fall back to plain
  // onNavigate when it's undefined, so single-pane/Notes-mode behavior
  // is untouched.
  const enterGoalWebOnRightPane = (goalId: number) => {
    const target: WebPaneContent = { kind: "goal-web", goalId };
    setWebPaneContent((current) => (sameWebPaneContent(target, current) ? current : target));
    const section = sidebarSectionForView(view);
    setWebPaneMemory((m) => {
      if (section === "Projects") return { ...m, Projects: target };
      if (section === "Goals") return { ...m, Goals: target };
      return m;
    });
  };
  const onEnterGoalWeb = dualPaneMode === "web" ? enterGoalWebOnRightPane : undefined;

  useEffect(() => {
  getDb()
    .then(async () => {
      setDbReady(true);
      // Android only (no-ops elsewhere): keeps the lock screen wallpaper
      // list in step with the database — see lockscreen/lockScreenSync.ts.
      startLockScreenSync().catch((err) =>
        console.warn("Failed to start lock screen sync:", err)
      );
      // Only ever fires on the computer, where the Rust sync server can
      // receive an upload pushed from the phone at any time (see
      // src-tauri/src/sync.rs and db/sync.ts) — harmless to register on
      // the phone too, it just never triggers there.
      listenForIncomingSync().catch((err) =>
        console.warn("Failed to register sync listener:", err)
      );
      // Apply stored ui_preferences overrides once, at startup — after
      // the matchMedia-derived sidebarOpen default and the plain
      // useState(null) dualPaneMode default have already been computed
      // above, so a user who's never touched either setting sees
      // exactly today's behavior.
      try {
        const prefs = await fetchUiPreferences();
        if (prefs.rememberSidebarOpen === "1" && prefs.sidebarOpen !== undefined) {
          setSidebarOpenState(prefs.sidebarOpen === "1");
        }
        if (prefs.dualPaneDefault === "1") {
          setDualPaneMode("notes");
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

  // `forRightPane` is true only for App's own web-mode right-pane render
  // path (see renderWebPaneContent below) — every other call site
  // (single-pane, and Notes' dual-pane right pane) omits it, so
  // GoalWebPage/RecipesGraphPage's isDualPaneWebRight prop defaults off.
  const renderPage = (v: View = view, forRightPane = false) => {
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
            isDualPaneWebRight={forRightPane}
            onOpenOnLeftPane={forRightPane ? onOpenOnLeftPane : undefined}
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
      case "settings-lockscreen":
        return <SettingsLockScreenPage onNavigate={navigate} />;
      case "settings-editor":
        return <SettingsEditorPage onNavigate={navigate} focusKey={v.focusKey} />;
      case "settings-headers":
        return <SettingsHeadersPage onNavigate={navigate} focusKey={v.focusKey} />;
      case "settings-issues":
        return <SettingsIssuesPage onNavigate={navigate} />;
      case "settings-context-capture":
        return <SettingsContextCapturePage onNavigate={navigate} />;
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
      case "tasks-home":
        return <TasksPage onNavigate={navigate} />;
      case "dreams-web":
        return <DreamWebPage onNavigate={navigate} />;
      case "dream-detail":
        return <DreamDetailPage dreamId={v.dreamId} onNavigate={navigate} />;
      case "goals-home":
        return <GoalsHomePage onNavigate={navigate} onEnterGoalWeb={onEnterGoalWeb} />;
      case "goal-detail":
        return <GoalDetailPage goalId={v.goalId} onNavigate={navigate} onEnterGoalWeb={onEnterGoalWeb} />;
      case "goal-web":
        return (
          <GoalWebPage
            goalId={v.goalId}
            onNavigate={navigate}
            isDualPaneWebRight={forRightPane}
            onOpenOnLeftPane={forRightPane ? onOpenOnLeftPane : undefined}
          />
        );
      case "projects-home":
        return <ProjectsHomePage onNavigate={navigate} onEnterGoalWeb={onEnterGoalWeb} />;
      case "project-detail":
        return <ProjectDetailPage projectId={v.projectId} onNavigate={navigate} onEnterGoalWeb={onEnterGoalWeb} />;
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
            dualPaneActive={dualPaneMode === "notes"}
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

  const dualPaneRightPage = dualPaneMode === "notes"
    ? sectionFor(dualPaneRightView.type)
      ? (
          <SectionThemeScope section={sectionFor(dualPaneRightView.type)!}>
            {renderPage(dualPaneRightView)}
          </SectionThemeScope>
        )
      : renderPage(dualPaneRightView)
    : null;

  // Parallel to renderPage/dualPaneRightPage above, but keyed on
  // WebPaneContent (a closed set of just the "web" views this feature
  // knows about) instead of the full View union — see
  // src/types/dualPaneWeb.ts for why.
  const renderWebPaneContent = (content: WebPaneContent): React.ReactNode => {
    if (content.kind === "empty") {
      return (
        <div className="dual-pane-web-empty">Open a project or goal to see its web here.</div>
      );
    }
    const asView = webPaneContentToView(content);
    if (!asView) return null;
    return sectionFor(asView.type) ? (
      <SectionThemeScope section={sectionFor(asView.type)!}>
        {renderPage(asView, true)}
      </SectionThemeScope>
    ) : (
      renderPage(asView, true)
    );
  };

  const dualPaneWebRightPage = dualPaneMode === "web" ? renderWebPaneContent(webPaneContent) : null;

  return (
    <ThemeProvider>
      <IconProvider>
        <TextElementProvider>
          <HeaderStyleProvider>
            <ButtonStyleProvider>
              <EditorSettingsProvider>
              <UiPreferencesProvider>
                <WebNodeLockProvider>
                <VaultSessionProvider>
                <PageBackgroundProvider view={view}>
                  <DynamicOverlayProvider>
                    <FieldStyleRegistryProvider>
                      <RearrangeModeProvider>
                        <AppShell
                          view={view}
                          onSidebarNavigate={resetNavigate}
                          lastViewBySection={lastViewBySection}
                          path={path}
                          onJump={navigate}
                          sidebarOpen={sidebarOpen}
                          setSidebarOpen={setSidebarOpen}
                          page={page}
                          dualPaneMode={dualPaneMode}
                          dualPaneNotesPageId={dualPaneNotesPageId}
                          dualPaneRightPage={dualPaneRightPage}
                          dualPaneLeftCollapsed={dualPaneLeftCollapsed}
                          onToggleDualPaneLeft={() => setDualPaneLeftCollapsed((v) => !v)}
                          onExitDualPane={exitDualPane}
                          navigateDualLeft={navigateDualLeft}
                          dualPaneWebRightPage={dualPaneWebRightPage}
                          webDualPaneBlockedMessage={webDualPaneBlockedMessage}
                          setWebDualPaneBlockedMessage={setWebDualPaneBlockedMessage}
                          onEnterWebDualPane={enterWebDualPane}
                          onExitWebDualPane={exitWebDualPane}
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
                </WebNodeLockProvider>
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
  lastViewBySection,
  path,
  onJump,
  sidebarOpen,
  setSidebarOpen,
  page,
  dualPaneMode,
  dualPaneNotesPageId,
  dualPaneRightPage,
  dualPaneLeftCollapsed,
  onToggleDualPaneLeft,
  onExitDualPane,
  navigateDualLeft,
  dualPaneWebRightPage,
  webDualPaneBlockedMessage,
  setWebDualPaneBlockedMessage,
  onEnterWebDualPane,
  onExitWebDualPane,
}: {
  view: View;
  onSidebarNavigate: (view: View) => void;
  lastViewBySection: Record<string, View>;
  path: PathEntry[];
  onJump: (view: View) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  page: React.ReactNode;
  dualPaneMode: "notes" | "web" | null;
  dualPaneNotesPageId: number | undefined;
  dualPaneRightPage: React.ReactNode;
  dualPaneLeftCollapsed: boolean;
  onToggleDualPaneLeft: () => void;
  onExitDualPane: () => void;
  navigateDualLeft: (view: View) => void;
  dualPaneWebRightPage: React.ReactNode;
  webDualPaneBlockedMessage: boolean;
  setWebDualPaneBlockedMessage: (v: boolean) => void;
  onEnterWebDualPane: () => void;
  onExitWebDualPane: () => void;
}) {
  const { active: rearranging } = useRearrangeMode();
  const mobile = useMobileLayout();
  const { theme } = useTheme();
  const { preferences } = useUiPreferences();

  // Notes' multi-pane mode force-narrows both columns to a "phone-width"
  // look (see NotesPage.css / the app's existing html.mobile-layout
  // rules) regardless of the real viewport, by toggling the same class
  // the Settings > Theme > Mobile layout setting drives. Restores
  // whatever that setting would compute for the real viewport on exit.
  // Dual-Pane WEB mode must NOT do this — it's desktop/wide-screen only
  // by design, so forcing mobile CSS on it would be exactly backwards.
  useEffect(() => {
    if (dualPaneMode !== "notes") return;
    document.documentElement.classList.add("mobile-layout");
    return () => {
      const mode = (theme.mobileMode as MobileMode) || "auto";
      document.documentElement.classList.toggle("mobile-layout", computeMobileLayout(mode));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dualPaneMode]);

  // The "Dual pane not available here" message (shown when the toggle
  // is pressed on a mobile-width viewport, see App()'s enterWebDualPane)
  // auto-clears itself — it's not something the user has to dismiss.
  useEffect(() => {
    if (!webDualPaneBlockedMessage) return;
    const t = setTimeout(() => setWebDualPaneBlockedMessage(false), 2500);
    return () => clearTimeout(t);
  }, [webDualPaneBlockedMessage, setWebDualPaneBlockedMessage]);

  // Global keyboard shortcut for Dual-Pane Web Mode (configurable in
  // Settings > Panel & Layout Memory) — lives here rather than in App()
  // itself because reading `preferences` needs a UiPreferencesProvider
  // ancestor, same reason AppShell is split out of App() in the first
  // place (see the comment above this function).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) {
        return;
      }
      const combo = serializeKeyEvent(e);
      if (!combo) return;
      const configured = preferences.dualPaneWebShortcut ?? DEFAULT_DUAL_PANE_WEB_SHORTCUT;
      if (combo !== configured) return;
      e.preventDefault();
      if (dualPaneMode === "web") onExitWebDualPane();
      else if (dualPaneMode === null) onEnterWebDualPane();
      // dualPaneMode === "notes": shortcut is a no-op, Notes keeps its own trigger.
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dualPaneMode, preferences.dualPaneWebShortcut, onEnterWebDualPane, onExitWebDualPane]);

  return (
    <div
      className={`app-shell${sidebarOpen ? "" : " sidebar-collapsed"}${rearranging ? " rearrange-mode-active" : ""}`}
    >
      {sidebarOpen && mobile && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      {sidebarOpen && (
        <Sidebar
          view={view}
          onNavigate={onSidebarNavigate}
          onToggle={() => setSidebarOpen(false)}
          lastViewBySection={lastViewBySection}
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
      <RearrangeToolbar />
      <div className="app-main-column">
        {dualPaneMode !== "notes" && (
          <div className="dual-pane-web-toggle-row">
            <NavHistoryBar path={path} onJump={onJump} />
            <button
              className="dual-pane-web-toggle"
              type="button"
              onClick={dualPaneMode === "web" ? onExitWebDualPane : onEnterWebDualPane}
              title={dualPaneMode === "web" ? "Exit Dual-Pane Web Mode" : "Enter Dual-Pane Web Mode"}
            >
              {dualPaneMode === "web" ? "✕ Web" : "⛶ Web"}
            </button>
            {webDualPaneBlockedMessage && (
              <span className="dual-pane-web-blocked-msg">Dual pane not available here</span>
            )}
          </div>
        )}
        {dualPaneMode === "notes" ? (
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
        ) : dualPaneMode === "web" ? (
          <div className="dual-pane-shell">
            <div className="dual-pane-web-left">
              <main className="app-content" data-color-surface="page">{page}</main>
            </div>
            <main className="app-content dual-pane-web-right" data-color-surface="page">
              {dualPaneWebRightPage}
            </main>
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
