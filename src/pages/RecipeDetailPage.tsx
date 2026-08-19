// src/pages/RecipeDetailPage.tsx
import { useEffect, useState } from "react";
import { fetchRecipe, updateRecipeInstructions } from "../db/recipes";
import { Recipe } from "../types/models";
import { View } from "../types/nav";
import { Breadcrumb } from "../components/Breadcrumb";
import "./Page.css";

export function RecipeDetailPage({
  categoryId,
  categoryName,
  recipeId,
  onNavigate,
}: {
  categoryId: number;
  categoryName: string;
  recipeId: number;
  onNavigate: (view: View) => void;
}) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await fetchRecipe(recipeId);
      if (data) {
        setRecipe(data);
        setInstructions(data.instructions || "");
      }
      setLoading(false);
    }
    load();
  }, [recipeId]);

  const handleSave = async () => {
    if (recipe) {
      await updateRecipeInstructions(recipe.id, instructions);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <p className="page-text">Loading...</p>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="page">
        <p className="page-text">Recipe not found.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumb
        crumbs={[
          { label: "Recipes", onClick: () => onNavigate({ type: "recipes-home" }) },
          {
            label: categoryName,
            onClick: () =>
              onNavigate({
                type: "recipes-category",
                categoryId,
                categoryName,
              }),
          },
          { label: recipe.name },
        ]}
      />

      <h1 className="page-title">{recipe.name}</h1>

      <textarea
        style={{
          width: "100%",
          minHeight: "200px",
          padding: "12px",
          borderRadius: "8px",
          border: "1px solid #cbd5e1",
          fontSize: "14px",
          fontFamily: "inherit",
          marginBottom: "12px",
        }}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        onBlur={handleSave}
        placeholder="Add recipe instructions, ingredients, or notes..."
      />
    </div>
  );
}