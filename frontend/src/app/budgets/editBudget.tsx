"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Budget } from "@/context/BudgetContext";
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

export function SheetDemo({
  id,
  budgets,
  setBudgets,
}: {
  id: number;
  budgets: Budget[];
  setBudgets: (budget: Budget[]) => void;
}) {
  // Local state for the edited budget
  const [editedBudget, setEditedBudget] = useState<Budget>({
    id,
    category_group: 0,
    category_name: "",
    amount: 0,
    start_date: "",
    end_date: "",
  });

  // Initialize local state when the component mounts or `id` changes
  useEffect(() => {
    const currentBudget = budgets.find((b) => b.id === id) || {
      id,
      category_group: 0,
      category_name: "",
      amount: 0,
      start_date: "",
      end_date: "",
    };
    setEditedBudget(currentBudget);
  }, [id, budgets]);

  // Handle form submission
  const handleSubmit = () => {
    // Update the existing budget or add a new one
    const updatedBudgets = budgets.some((b) => b.id === id)
      ? budgets.map((b) => (b.id === id ? editedBudget : b)) // Update existing budget
      : [...budgets, editedBudget]; // Add new budget

    // Update the parent state
    setBudgets(updatedBudgets);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Budget</SheetTitle>
          <SheetDescription>
            Make changes to your budget here. Click save when youre done.
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
              value={editedBudget.category_name}
              className="col-span-3"
              onChange={(e) =>
                setEditedBudget((prev) => ({
                  ...prev,
                  category_name: e.target.value,
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
              value={editedBudget.amount}
              className="col-span-3"
              onChange={(e) =>
                setEditedBudget((prev) => ({
                  ...prev,
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
              value={editedBudget.start_date.toString().split("T")[0]}
              className="col-span-3"
              onChange={(e) =>
                setEditedBudget((prev) => ({
                  ...prev,
                  start_date: new Date(e.target.value).toString(),
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
              value={editedBudget.end_date.toString().split("T")[0]}
              className="col-span-3"
              onChange={(e) =>
                setEditedBudget((prev) => ({
                  ...prev,
                  end_date: new Date(e.target.value).toString(),
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
  );
}
