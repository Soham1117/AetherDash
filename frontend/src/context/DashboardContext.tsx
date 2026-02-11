"use client";

import { useBud } from "@/context/BudgetContext";
import { useTran } from "@/context/TransactionContext";
import { useAcc } from "@/context/AccountContext";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useCategories } from "./CategoryContext";

// Removed duplicate Account interface

// Budget imported from BudgetContext
import { Budget } from "@/context/BudgetContext";

export interface TransactionListItem {
  id: number;
  amount: number;
  timestamp: string;
  description: string;
  category: string;
  category_ref?: number | null;
  transaction_type: string;
  account: string;
  tags?: any[]; // Using any[] to avoid circular dependency or import Tag interface
  is_transfer?: boolean;
}

interface DashboardContextType {
  totalBalance: number;
  transactionLength: number;
  budgetProgress: number;
  credited: number;
  debited: number;
  transactionList: TransactionListItem[];
  setTransactionList: (transactions: TransactionListItem[]) => void;
  budgets: Budget[];
  accounts: Account[];
  spendingList: SpendingItem[];
  aiTransactions: aiTransactionItem[];
  setBudgets: (budgets: Budget[]) => void;
}

export interface Account {
  id: number;
  account_name: string;
  balance: number;
}

interface SpendingItem {
  name: string;
  expense: number;
  percentage: number;
  color: string;
  timestamp: Date;
}

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined
);

interface DashboardProviderProps {
  children: ReactNode;
}

export const vibrantColors = [
  "#FF0000", // red
  "#00FF00", // lime
  "#0000FF", // blue
  "#FF00FF", // magenta
  "#00FFFF", // cyan
  "#FFFF00", // yellow
  "#FF4500", // orange red
  "#32CD32", // lime green
  "#4169E1", // royal blue
  "#FF1493", // deep pink
  "#00CED1", // dark turquoise
  "#FFD700", // gold
  "#FF6347", // tomato
  "#3CB371", // medium sea green
  "#4B0082", // indigo
  "#FF69B4", // hot pink
  "#20B2AA", // light sea green
  "#FFA500", // orange
  "#DC143C", // crimson
  "#228B22", // forest green
  "#8A2BE2", // blue violet
  "#FF7F50", // coral
  "#008B8B", // dark cyan
  "#DAA520", // goldenrod
  "#FF4466", // bright pink
  "#55FF33", // bright lime
  "#3333FF", // bright blue
  "#FF33FF", // bright magenta
  "#33FFFF", // bright cyan
  "#FFFF33", // bright yellow
  "#FF3366", // bright red
  "#33FF66", // bright green
  "#6633FF", // bright purple
  "#FF6633", // bright orange
  "#33FFCC", // bright turquoise
  "#E6399B", // bright rose
  "#39E639", // bright emerald
  "#3999E6", // bright azure
  "#E67339", // bright coral
  "#39E6E6", // bright aqua
  "#9B39E6", // bright violet
  "#E6E639", // bright chartreuse
  "#FF2D2D", // vivid red
  "#2DFF2D", // vivid green
  "#2D2DFF", // vivid blue
  "#FF2DFF", // vivid magenta
  "#2DFFFF", // vivid cyan
  "#FFFF2D", // vivid yellow
  "#FF552D", // vivid orange
  "#2DFF55", // vivid lime
];
interface aiTransactionItem {
  description: string;
  amount: number;
  timestamp: string;
}
export const DashboardProvider: React.FC<DashboardProviderProps> = ({
  children,
}) => {
  const { transactions, error } = useTran();
  const { budgets, setBudgets } = useBud();
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [budgetProgress, setBudgetProgress] = useState<number>(0);
  const transactionLength = transactions.length;
  const [credited, setCredited] = useState<number>(0);
  const [debited, setDebited] = useState<number>(0);
  const { accounts } = useAcc();
  const [transactionList, setTransactionList] = useState<TransactionListItem[]>(
    []
  );
  const { categories: hierarchicalCategories, getCategoryName } = useCategories();
  const [spendingList, setSpendingList] = useState<SpendingItem[]>([]);
  const [aiTransactions, setAITransactions] = useState<aiTransactionItem[]>([]);

  const calculateStats = () => {
    const balance = accounts.reduce(
      (total, account) => total + account.balance,
      0
    );

    const totalBudget = budgets.reduce(
      (total, budget) => total + budget.amount,
      0
    );

    const accountMap: Record<number, string> = accounts.reduce(
      (acc: Record<number, string>, account: Account) => {
        acc[account.id] = account.account_name;
        return acc;
      },
      {} as Record<number, string>
    );

    const newTransactionList = transactions.map((transaction) => {
      // Derive transaction_type from amount: negative = debit (expense), positive = credit (income)
      const amount = parseFloat(transaction.amount.toString());
      const transaction_type = amount < 0 ? "debit" : "credit";
      
      // Convert date to timestamp format for compatibility
      const timestamp = transaction.date ? new Date(transaction.date).toISOString() : new Date().toISOString();
      
      return {
        description: transaction.name || "Transaction",
        amount: Math.abs(amount), // Use absolute value for display
        timestamp: timestamp,
        transaction_type: transaction_type,
        account: accountMap[transaction.account] || "Unknown",
        id: transaction.id,
        category: transaction.category || "Uncategorized",
        category_ref: transaction.category_ref,
        tags: transaction.tags,
        is_transfer: transaction.is_transfer,
      };
    });

    const totalSpent = newTransactionList.reduce(
      (total, transaction) =>
        transaction.transaction_type === "debit" && !transaction.is_transfer
          ? total + transaction.amount
          : total,
      0
    );

    const aiTran = transactionList
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 10)
      .map((transaction) => ({
        description: transaction.description,
        amount: transaction.amount,
        timestamp: transaction.timestamp,
        // transaction_type: transaction.transaction_type,
        // account: transaction.account,
        // id: transaction.id,
        // category: transaction.category,
      }));
    setAITransactions(aiTran);

    const totalCredited = newTransactionList.reduce(
      (total, transaction) =>
        transaction.transaction_type === "credit" && !transaction.is_transfer
          ? total + transaction.amount
          : total,
      0
    );

    const totalDebited = newTransactionList.reduce(
      (total, transaction) =>
        transaction.transaction_type === "debit" && !transaction.is_transfer
          ? total + transaction.amount
          : total,
      0
    );

    // Hierarchical Spending Calculation
    const categoryTotals: Record<number, number> = {};
    const uncategorizedTotal = newTransactionList.filter(t => t.transaction_type === "debit" && !t.category_ref && !t.is_transfer).reduce((sum, t) => sum + t.amount, 0);

    newTransactionList.forEach(t => {
      if (t.transaction_type === "debit" && t.category_ref && !t.is_transfer) {
        categoryTotals[t.category_ref] = (categoryTotals[t.category_ref] || 0) + t.amount;
      }
    });

    // Helper to find parent category ID
    const getParentId = (catId: number): number | null => {
      const findParent = (cats: any[]): number | null => {
        for (const cat of cats) {
          if (cat.id === catId) return cat.parent;
          if (cat.children) {
            const found = findParent(cat.children);
            if (found !== undefined) return found; 
          }
        }
        return undefined as any;
      };
      const result = findParent(hierarchicalCategories);
      return result === undefined ? null : result;
    };

    // Roll up to top-level categories
    const rolledUpTotals: Record<string, number> = {};
    if (uncategorizedTotal > 0) rolledUpTotals["Uncategorized"] = uncategorizedTotal;

    Object.entries(categoryTotals).forEach(([catIdStr, amount]) => {
      const catId = parseInt(catIdStr);
      let currentId: number | null = catId;
      let lastKnownId: number = catId;
      
      // Basic approach: roll everything up to the root parent for summary comparison
      // or just keep it as is but use names from CategoryContext
      const catName = getCategoryName(catId);
      rolledUpTotals[catName] = (rolledUpTotals[catName] || 0) + amount;
    });

    const SpendingList = Object.entries(rolledUpTotals).map(([name, expense], index) => ({
      name,
      expense,
      percentage: totalSpent > 0 ? Number(((expense / totalSpent) * 100).toFixed(2)) : 0,
      color: vibrantColors[index % vibrantColors.length],
      timestamp: new Date(),
    })).sort((a, b) => b.expense - a.expense);

    setSpendingList(SpendingList);
    setTotalBalance(balance);
    setCredited(totalCredited);
    setDebited(totalDebited);
    setBudgetProgress(
      totalBudget > 0
        ? parseFloat(((totalSpent / totalBudget) * 100).toFixed(3))
        : 0
    );
    setTransactionList(newTransactionList);
  };

  useEffect(() => {
    calculateStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, transactions, budgets]);

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <DashboardContext.Provider
      value={{
        totalBalance,
        accounts,
        transactionLength,
        budgetProgress,
        credited,
        debited,
        transactionList,
        setTransactionList,
        budgets,
        spendingList,
        aiTransactions,
        setBudgets,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDash = (): DashboardContextType => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDash must be used within a DashboardProvider");
  }
  return context;
};
