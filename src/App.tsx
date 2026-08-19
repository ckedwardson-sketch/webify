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
        return <RecipesGraphPage onNavigate={setView} />;
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
    <div className="app-shell">
      <Sidebar view={view} onNavigate={setView} />
      <main className="app-content">{renderPage()}</main>
    </div>
  );
}