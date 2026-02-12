import { useAuth } from "./AuthContext";
import { useTime } from "@/context/TimeContext";
import { createContext, useContext, useState, useEffect } from "react";

export interface Budget {
  id: number;
  category_group: number;
  category_name: string;
  amount: number;
  start_date: string;
  end_date: string;
}

interface BudgetContextType {
  budgets: Budget[];
  setBudgets: (budgets: Budget[]) => void;
  loading: boolean;
  error: string | null;
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

const fetchBudgets = async (token: string, url: string): Promise<Budget[]> => {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch budgets");
  }

  return response.json();
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const getURL = (
  timeFilterType: string,
  start?: string,
  end?: string
): string => {
  switch (timeFilterType) {
    case "today":
      return `${API_URL}/budgets/?type=today`;
    case "week":
      return `${API_URL}/budgets/?type=week`;
    case "month":
      return `${API_URL}/budgets/?type=month`;
    case "custom":
      return `${API_URL}/budgets/?type=custom&start=${start}&end=${end}`;
    default:
      return `${API_URL}/budgets/`;
  }
};

interface BudgetProviderProps {
  children: React.ReactNode;
}

export const BudgetProvider: React.FC<BudgetProviderProps> = ({ children }) => {
  const { isAuthenticated, tokens } = useAuth();
  const { timeFilterType, start, end } = useTime();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && tokens?.access) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const url = getURL(timeFilterType, start, end);
          const data = await fetchBudgets(tokens.access, url);
          setBudgets(data);

          setError(null);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [isAuthenticated, tokens, timeFilterType, start, end]);

  return (
    <BudgetContext.Provider value={{ budgets, setBudgets, loading, error }}>
      {children}
    </BudgetContext.Provider>
  );
};

export const useBud = (): BudgetContextType => {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error("useBud must be used within a BudgetProvider");
  }
  return context;
};
