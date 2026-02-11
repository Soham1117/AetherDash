"use client";

import { useTime } from "@/context/TimeContext";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

export interface Tag {
  id: number;
  name: string;
  color: string;
}

interface Transaction {
  id: number;
  amount: number;
  date: string; // Changed from timestamp to date
  name: string; // Changed from description to name
  merchant_name?: string | null;
  category: string | null;
  category_ref?: number | null;
  payment_channel?: string | null;
  pending: boolean;
  account: number;
  plaid_transaction_id?: string | null;
  line_items?: any[];
  tags?: Tag[];
  created_at?: string;
  updated_at?: string;
  is_transfer?: boolean;
}

interface TransactionContextType {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refreshTransactions: () => Promise<void>;
}

const fetchTransactions = async (
  token: string,
  url: string
): Promise<Transaction[]> => {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    // If response is not ok, try to get error message
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.detail || errorMessage;
    } catch (e) {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  // Ensure we return an array
  if (Array.isArray(data)) {
    return data;
  }
  
  // If it's not an array, return empty array (might be an object with error)
  console.warn('Expected array but got:', data);
  return [];
};

const getURL = (timeFilterType: string, start: string, end: string): string => {
  switch (timeFilterType) {
    case "today":
      return `http://localhost:8000/transactions/filter_by_time_period/?type=today`;
    case "week":
      return `http://localhost:8000/transactions/filter_by_time_period/?type=week`;
    case "month":
      return `http://localhost:8000/transactions/filter_by_time_period/?type=month`;
    case "custom":
      return `http://localhost:8000/transactions/filter_by_time_period/?type=custom&start=${start}&end=${end}`;
    default:
      return "http://localhost:8000/transactions/";
  }
};

const TransactionContext = createContext<TransactionContextType | undefined>(
  undefined
);

interface TransactionProviderProps {
  children: ReactNode;
}

export const TransactionProvider = ({ children }: TransactionProviderProps) => {
  const { isAuthenticated, tokens } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { timeFilterType, start, end } = useTime();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!isAuthenticated || !tokens?.access) return;

    try {
      setLoading(true);
      const url = getURL(timeFilterType, start, end);
      console.log('[TransactionContext] Fetching transactions from:', url, 'timeFilterType:', timeFilterType);
      const data = await fetchTransactions(tokens.access, url);
      console.log('[TransactionContext] Received transactions:', data.length, 'transactions');
      setTransactions(data);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch transactions";
      console.error("Transaction fetch error:", errorMessage, err);
      setError(errorMessage);
      setTransactions([]); // Clear transactions on error
    } finally {
      setLoading(false);
    }
  };

  const refreshTransactions = async () => {
    console.log('[TransactionContext] Manual refresh triggered');
    await fetchData();
  };

  useEffect(() => {
    if (isAuthenticated && tokens?.access) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, tokens, timeFilterType, start, end]);

  return (
    <TransactionContext.Provider value={{ transactions, loading, error, refreshTransactions }}>
      {children}
    </TransactionContext.Provider>
  );
};

export const useTran = (): TransactionContextType => {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error("useTran must be used within a TransactionProvider");
  }
  return context;
};
