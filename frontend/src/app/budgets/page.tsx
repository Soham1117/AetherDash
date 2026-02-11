"use client";
import { Poppins } from "next/font/google";
import { useDash, vibrantColors } from "@/context/DashboardContext";
import { Progress } from "@/components/ui/progress";
import { EditIcon } from "lucide-react";
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

const Page = () => {
  const { budgets, transactionList, setBudgets, accounts } = useDash();
  const [editedBudget, setEditedBudget] = useState<Budget | null>(null);
  const { isAuthenticated, tokens } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newBudget, setNewBudget] = useState({
    category_name: "",
    amount: 0,
    start_date: new Date().toString().split("T")[0],
    end_date: new Date().toString().split("T")[0],
    account: 0,
  });

  // const numberOfBudgets = budgets.length;

  const handleCreateSubmit = async () => {
    if (!newBudget) return;
    console.log("New budget:", newBudget);
    try {
      // Send the new budget to the backend
      const response = await fetch("http://localhost:8000/budgets/", {
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
      // Parse the response to get the newly created budget (with the generated ID)
      const createdBudget: Budget = await response.json();
      console.log("Budget created successfully", createdBudget);

      // Add the newly created budget to the local state
      setBudgets([...budgets, createdBudget]);

      // Reset the newBudget state
      setNewBudget({
        category_name: "",
        amount: 0,
        start_date: new Date().toString().split("T")[0],
        end_date: new Date().toString().split("T")[0],
        account: 0,
      });

      // Close the sheet
      setIsCreating(false);
    } catch (error) {
      console.error("Error creating budget:", error);
    }
  };

  const filteredBudgets = budgets.filter((budget) =>
    budget.category_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const updateBudget = async (budget: Budget) => {
    const url = `http://localhost:8000/budgets/${budget.id}/`;

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

  // Unique categories from transactionList
  const budgetCategories: framework[] = Array.from(
    new Set(transactionList.map((transaction) => transaction.category))
  ).map((category) => ({ value: category, label: category }));

  const accountsList: {
    value: string;
    label: string;
  }[] = accounts.map((account) => ({
    value: account.id.toString(), // Display name
    label: account.account_name, // Display name
  }));

  const handleSubmit = () => {
    if (!editedBudget) return;

    const updatedBudgets = isCreating
      ? [...budgets, editedBudget] // Add new budget
      : budgets.map((b) => (b.id === editedBudget.id ? editedBudget : b)); // Update existing budget

    setBudgets(updatedBudgets);
    if (isAuthenticated && tokens?.access) {
      updateBudget(editedBudget);
    }
    setEditedBudget(null);
    setIsCreating(false);
  };

  return (
    <div
      className={`flex flex-col gap-4 min-h-[60vh] w-full bg-[#121212] text-base font-sans pt-4 pl-24 pr-12`}
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Budgets</h1>
        <p className="text-white/60 mt-1">
          Manage your monthly spending limits per category.
        </p>
      </div>

      <div className="flex justify-between items-center w-full">
        <input
          className="w-1/4 border border-white/15 p-2"
          placeholder="Search for a budget"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Sheet>
          <SheetTrigger>
            <Button
              variant="default"
              size="icon"
              className="w-full p-4 text-2xl"
            >
              +
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Add a Budget</SheetTitle>
              <SheetDescription>
                Add a budget for a specific category. Set the amount and the
                start and end date.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="category" className="text-right">
                  Category
                </Label>
                <ComboboxCat
                  options={budgetCategories}
                  setCategory={(category: string) =>
                    setNewBudget((prev) => ({
                      ...(prev || {
                        category_name: "",
                        amount: 0,
                        start_date: new Date().toString().split("T")[0],
                        end_date: new Date().toString().split("T")[0],
                        account: 0,
                      }),
                      category_name: category,
                    }))
                  }
                />
              </div>

              {/* Amount Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount
                </Label>
                <Input
                  id="amount"
                  type="number"
                  value={newBudget?.amount || 0}
                  className="col-span-3"
                  onChange={(e) =>
                    setNewBudget((prev) => ({
                      ...(prev || {
                        category: "",
                        amount: 0,
                        start_date: new Date().toString().split("T")[0],
                        end_date: new Date().toString().split("T")[0],
                        account: 0,
                      }),
                      amount: Number(e.target.value),
                    }))
                  }
                />
              </div>

              {/* Start Date Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="startDate" className="text-right">
                  Start Date
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newBudget?.start_date || ""}
                  className="col-span-3"
                  onChange={(e) =>
                    setNewBudget((prev) => ({
                      ...(prev || {
                        category: "",
                        amount: 0,
                        start_date: new Date().toString().split("T")[0],
                        end_date: new Date().toString().split("T")[0],
                        account: 0,
                      }),
                      start_date: e.target.value,
                    }))
                  }
                />
              </div>

              {/* End Date Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="endDate" className="text-right">
                  End Date
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={newBudget?.end_date || ""}
                  className="col-span-3"
                  onChange={(e) =>
                    setNewBudget((prev) => ({
                      ...(prev || {
                        category: "",
                        amount: 0,
                        start_date: new Date().toString().split("T")[0],
                        end_date: new Date().toString().split("T")[0],
                        account: 0,
                      }),
                      end_date: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="account" className="text-right">
                  Account
                </Label>
                <ComboboxAcc
                  options={accountsList}
                  setAccountNumber={(accountNumber: number) =>
                    setNewBudget((prev) => ({
                      ...(prev || {
                        category: "",
                        amount: 0,
                        start_date: new Date().toString().split("T")[0],
                        end_date: new Date().toString().split("T")[0],
                        account: 0,
                      }),
                      account: accountNumber,
                    }))
                  }
                />
              </div>
            </div>
            <SheetFooter>
              <SheetClose asChild>
                <Button type="submit" onClick={handleCreateSubmit}>
                  Save changes
                </Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-rows-12 gap-4 w-full">
        {filteredBudgets.map((budget) => {
          const timeTransactions = transactionList.filter(
            (trans) =>
              trans.transaction_type === "debit" &&
              !trans.is_transfer &&
              new Date(budget.start_date) <= new Date(trans.timestamp) &&
              new Date(trans.timestamp) <= new Date(budget.end_date)
          );

          const SpendingList = Object.values(
            timeTransactions.reduce((acc, transaction) => {
              if (!acc[transaction.category]) {
                acc[transaction.category] = {
                  name: transaction.category,
                  expense: 0,

                  color:
                    vibrantColors[
                      Object.keys(acc).length % vibrantColors.length
                    ],
                };
              }
              acc[transaction.category].expense += transaction.amount;
              return acc;
            }, {} as Record<string, { name: string; expense: number; color: string }>)
          );

          const categorySpending = SpendingList.find(
            (s) => s.name.toLowerCase() === budget.category_name.toLowerCase()
          );

          const spentPercentage = categorySpending
            ? Math.min((categorySpending.expense / budget.amount) * 100, 100)
            : 0;

          return (
            <div
              key={budget.id}
              className="border border-white/15 p-10 cursor-default flex flex-col gap-8 w-full"
            >
              <div className="flex flex-row gap-10 items-center justify-between w-full">
                <div className="flex flex-row gap-4 items-center">
                  <span className="text-lg font-normal font-mono text-white">
                    {budget.id < 10 ? `0${budget.id}` : budget.id}.
                  </span>
                  <span className="text-lg font-normal text-white capitalize">
                    {budget.category_name}
                  </span>
                </div>

                {/* Edit Button and Sheet */}
                <Sheet>
                  <SheetTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditedBudget(budget)}
                    >
                      <EditIcon className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Edit Budget</SheetTitle>
                      <SheetDescription>
                        Make changes to your budget here. Click save when youre
                        done.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="grid gap-4 py-4">
                      {/* Category Input */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">
                          Category
                        </Label>
                        <Input
                          id="category"
                          value={editedBudget?.category_name || ""}
                          className="col-span-3"
                          onChange={(e) =>
                            setEditedBudget((prev) => ({
                              ...(prev || budget),
                              category: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* Amount Input */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="amount" className="text-right">
                          Amount
                        </Label>
                        <Input
                          id="amount"
                          type="number"
                          value={editedBudget?.amount || 0}
                          className="col-span-3"
                          onChange={(e) =>
                            setEditedBudget((prev) => ({
                              ...(prev || budget),
                              amount: Number(e.target.value),
                            }))
                          }
                        />
                      </div>

                      {/* Start Date Input */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="startDate" className="text-right">
                          Start Date
                        </Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={
                            editedBudget?.start_date.toString().split("T")[0] ||
                            ""
                          }
                          className="col-span-3"
                          onChange={(e) =>
                            setEditedBudget((prev) => ({
                              ...(prev || budget),
                              start_date: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* End Date Input */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="endDate" className="text-right">
                          End Date
                        </Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={editedBudget?.end_date.toString()}
                          className="col-span-3"
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
                          Save changes
                        </Button>
                      </SheetClose>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </div>

              <div className="flex flex-col gap-4 w-full">
                <Progress
                  value={spentPercentage}
                  className="h-2 bg-gray-900"
                  color={spentPercentage > 80 ? "red" : "blue"}
                />
                <span className="flex flex-row justify-end w-full">
                  ${categorySpending?.expense || 0} / ${budget.amount}
                </span>
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
      </div>
    </div>
  );
};

export default Page;
