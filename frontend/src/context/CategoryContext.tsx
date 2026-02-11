"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import api from "@/components/finance/api";

export interface Category {
  id: number;
  name: string;
  parent: number | null;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  children?: Category[];
}

interface CategoryContextType {
  categories: Category[];
  loading: boolean;
  error: string | null;
  getCategoryName: (id: number | null) => string;
  refreshCategories: () => Promise<void>;
}

const CategoryContext = createContext<CategoryContextType | undefined>(
  undefined,
);

export const CategoryProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get("/categories/");

      // Build hierarchical tree
      const catMap: Record<number, Category> = {};
      const roots: Category[] = [];

      const rawData = response.data as Category[];

      rawData.forEach((cat) => {
        catMap[cat.id] = { ...cat, children: [] };
      });

      rawData.forEach((cat) => {
        if (cat.parent && catMap[cat.parent]) {
          catMap[cat.parent].children?.push(catMap[cat.id]);
        } else {
          roots.push(catMap[cat.id]);
        }
      });

      setCategories(roots);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
      setError("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const getCategoryName = (id: number | null) => {
    if (!id) return "Uncategorized";

    // Recursive search in tree
    const findInTree = (cats: Category[], targetId: number): string | null => {
      for (const cat of cats) {
        if (cat.id === targetId) return cat.name;
        if (cat.children) {
          const found = findInTree(cat.children, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    return findInTree(categories, id) || "Uncategorized";
  };

  return (
    <CategoryContext.Provider
      value={{
        categories,
        loading,
        error,
        getCategoryName,
        refreshCategories: fetchCategories,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategories = () => {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error("useCategories must be used within a CategoryProvider");
  }
  return context;
};
