"use client";

import { useAuth } from "./AuthContext";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface Account {
  id: number;
  account_name: string;
  balance: number;
}

interface AccountContextType {
  accounts: Account[];
  loading: boolean;
  error: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const fetchAccounts = async (token: string): Promise<Account[]> => {
  const response = await fetch(`${API_URL}/accounts/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch accounts");
  }
  return response.json();
};

const AccountContext = createContext<AccountContextType | undefined>(undefined);

interface AccountProviderProps {
  children: ReactNode;
}

export const AccountProvider: React.FC<AccountProviderProps> = ({
  children,
}) => {
  const { isAuthenticated, tokens } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && tokens?.access) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const data = await fetchAccounts(tokens.access);
          setAccounts(data);
        } catch (err) {
          setError("Failed to fetch accounts");
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [isAuthenticated, tokens]);

  return (
    <AccountContext.Provider value={{ accounts, loading, error }}>
      {children}
    </AccountContext.Provider>
  );
};

export const useAcc = (): AccountContextType => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAcc must be used within an AccountProvider");
  }
  return context;
};
