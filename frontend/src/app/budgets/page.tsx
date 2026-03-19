"use client";

import { useDash, vibrantColors } from "@/context/DashboardContext";
import { Progress } from "@/components/ui/progress";
import { EditIcon, Plus } from "lucide-react";
import { Budget } from "@/context/BudgetContext";
import { useState } from "react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { ComboboxCat } from "./comboBoxCategory";
import { ComboboxAcc } from "./comboBoxAccount";
import { ScrollAreaDemo } from "./scrollArea";

export type framework = { value: string; label: string };

const defaultDate = () => new Date().toISOString().split("T")[0];

const Page = () => {
  const { budgets, transactionList, setBudgets, accounts } = useDash();
  const [editedBudget, setEditedBudget] = useState<Budget | null>(null);
  const { isAuthenticated, tokens } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newBudget, setNewBudget] = useState({
    category_name: "",
    amount: 0,
    start_date: defaultDate(),
    end_date: defaultDate(),
    account: 0,
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const resetNewBudget = () => {
    setNewBudget({
      category_name: "",
      amount: 0,
      start_date: defaultDate(),
      end_date: defaultDate(),
      account: 0,
    });
  };

  const handleCreateSubmit = async () => {
    if (!newBudget) return;
    try {
      const response = await fetch(`${API_URL}/budgets/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens?.access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newBudget),
      });

      if (!response.ok) {
        throw new Error("Failed to create budget");
      }

      const createdBudget: Budget = await response.json();
      setBudgets([...budgets, createdBudget]);
      resetNewBudget();
      setIsCreating(false);
    } catch (error) {
      console.error("Error creating budget:", error);
    }
  };

  const filteredBudgets = budgets.filter((budget) =>
    budget.category_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const updateBudget = async (budget: Budget) => {
    const url = `${API_URL}/budgets/${budget.id}/`;

    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokens?.access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(budget),
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }
    } catch (err: unknown) {
      console.log(err);
    }
  };

  const budgetCategories: framework[] = Array.from(
    new Set(transactionList.map((transaction) => transaction.category))
  ).map((category) => ({ value: category, label: category }));

  const accountsList: {
    value: string;
    label: string;
  }[] = accounts.map((account) => ({
    value: account.id.toString(),
    label: account.account_name,
  }));

  const handleSubmit = () => {
    if (!editedBudget) return;

    const updatedBudgets = isCreating
      ? [...budgets, editedBudget]
      : budgets.map((b) => (b.id === editedBudget.id ? editedBudget : b));

    setBudgets(updatedBudgets);
    if (isAuthenticated && tokens?.access) {
      updateBudget(editedBudget);
    }
    setEditedBudget(null);
    setIsCreating(false);
  };

  return (
    <div className="min-h-[70vh] w-full bg-[#121212] px-4 pb-12 pt-4 text-white sm:px-6 md:px-10 lg:px-14">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Budgets</h1>
          <p className="mt-1 text-sm text-white/60 sm:text-base">
            Manage spending limits by category and quickly monitor utilization.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            className="w-full border-white/15 bg-[#171717] text-white placeholder:text-white/40 sm:max-w-sm"
            placeholder="Search budgets by category"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Sheet open={isCreating} onOpenChange={setIsCreating}>
            <SheetTrigger asChild>
              <Button variant="default" className="w-full gap-2 sm:w-auto">
                <Plus className="h-4 w-4" />
                Add Budget
              </Button>
            </SheetTrigger>
            <SheetContent className="border-white/15 bg-[#121212] text-white">
              <SheetHeader>
                <SheetTitle>Add a Budget</SheetTitle>
                <SheetDescription>
                  Create a category budget with a date range and account scope.
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-category">Category</Label>
                  <ComboboxCat
                    options={budgetCategories}
                    setCategory={(category: string) =>
                      setNewBudget((prev) => ({ ...prev, category_name: category }))
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="new-amount">Amount</Label>
                  <Input
                    id="new-amount"
                    type="number"
                    value={newBudget?.amount || 0}
                    onChange={(e) =>
                      setNewBudget((prev) => ({ ...prev, amount: Number(e.target.value) }))
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="new-startDate">Start Date</Label>
                  <Input
                    id="new-startDate"
                    type="date"
                    value={newBudget?.start_date || ""}
                    onChange={(e) =>
                      setNewBudget((prev) => ({ ...prev, start_date: e.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="new-endDate">End Date</Label>
                  <Input
                    id="new-endDate"
                    type="date"
                    value={newBudget?.end_date || ""}
                    onChange={(e) =>
                      setNewBudget((prev) => ({ ...prev, end_date: e.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="new-account">Account</Label>
                  <ComboboxAcc
                    options={accountsList}
                    setAccountNumber={(accountNumber: number) =>
                      setNewBudget((prev) => ({ ...prev, account: accountNumber }))
                    }
                  />
                </div>
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button type="submit" onClick={handleCreateSubmit}>
                    Save Budget
                  </Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filteredBudgets.map((budget) => {
            const timeTransactions = transactionList.filter(
              (trans) =>
                trans.transaction_type === "debit" &&
                !trans.is_transfer &&
                new Date(budget.start_date) <= new Date(trans.timestamp) &&
                new Date(trans.timestamp) <= new Date(budget.end_date)
            );

            const spendingList = Object.values(
              timeTransactions.reduce((acc, transaction) => {
                if (!acc[transaction.category]) {
                  acc[transaction.category] = {
                    name: transaction.category,
                    expense: 0,
                    color: vibrantColors[Object.keys(acc).length % vibrantColors.length],
                  };
                }
                acc[transaction.category].expense += transaction.amount;
                return acc;
              }, {} as Record<string, { name: string; expense: number; color: string }>)
            );

            const categorySpending = spendingList.find(
              (s) => s.name.toLowerCase() === budget.category_name.toLowerCase()
            );

            const spentPercentage =
              categorySpending && budget.amount > 0
                ? Math.min((categorySpending.expense / budget.amount) * 100, 100)
                : 0;

            return (
              <div
                key={budget.id}
                className="rounded-2xl border border-white/15 bg-[#151515] p-4 sm:p-6"
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-white/60 sm:text-sm">
                      #{budget.id < 10 ? `0${budget.id}` : budget.id}
                    </span>
                    <span className="text-lg capitalize text-white">{budget.category_name}</span>
                  </div>

                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditedBudget(budget)}
                        className="self-start sm:self-auto"
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="border-white/15 bg-[#121212] text-white">
                      <SheetHeader>
                        <SheetTitle>Edit Budget</SheetTitle>
                        <SheetDescription>
                          Update category, amount, and date range.
                        </SheetDescription>
                      </SheetHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="edit-category">Category</Label>
                          <Input
                            id="edit-category"
                            value={editedBudget?.category_name || ""}
                            onChange={(e) =>
                              setEditedBudget((prev) => ({
                                ...(prev || budget),
                                category_name: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="edit-amount">Amount</Label>
                          <Input
                            id="edit-amount"
                            type="number"
                            value={editedBudget?.amount || 0}
                            onChange={(e) =>
                              setEditedBudget((prev) => ({
                                ...(prev || budget),
                                amount: Number(e.target.value),
                              }))
                            }
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="edit-startDate">Start Date</Label>
                          <Input
                            id="edit-startDate"
                            type="date"
                            value={editedBudget?.start_date.toString().split("T")[0] || ""}
                            onChange={(e) =>
                              setEditedBudget((prev) => ({
                                ...(prev || budget),
                                start_date: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="edit-endDate">End Date</Label>
                          <Input
                            id="edit-endDate"
                            type="date"
                            value={editedBudget?.end_date.toString().split("T")[0] || ""}
                            onChange={(e) =>
                              setEditedBudget((prev) => ({
                                ...(prev || budget),
                                end_date: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <SheetFooter>
                        <SheetClose asChild>
                          <Button type="submit" onClick={handleSubmit}>
                            Save Changes
                          </Button>
                        </SheetClose>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>
                </div>

                <div className="mb-4 grid gap-2">
                  <Progress
                    value={spentPercentage}
                    className="h-2 bg-gray-900"
                    color={spentPercentage > 80 ? "red" : "blue"}
                  />
                  <div className="flex items-center justify-between text-sm text-white/75">
                    <span>
                      Spent: ${categorySpending?.expense || 0}
                    </span>
                    <span>Budget: ${budget.amount}</span>
                  </div>
                </div>

                <div className="w-full">
                  <ScrollAreaDemo
                    transactions={timeTransactions}
                    budgetCategory={budget.category_name}
                  />
                </div>
              </div>
            );
          })}

          {filteredBudgets.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/20 bg-black/20 p-10 text-center text-sm text-white/50">
              No budgets match your search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Page;
