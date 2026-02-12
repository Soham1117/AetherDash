"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CategorySelect } from "../categories/category-select";
import { useAuth } from "@/context/AuthContext";
import { useBud } from "@/context/BudgetContext";

export function AddBudgetSheet({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split("T")[0].substring(0, 8) + "01"
  ); // First of current month
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0]; // Last of current month
  });
  const { tokens } = useAuth();
  const { setBudgets, budgets } = useBud();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !amount || !startDate || !endDate) return;

    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/budgets/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.access}`,
        },
        body: JSON.stringify({
          category_group: parseInt(categoryId),
          amount: parseFloat(amount),
          start_date: startDate,
          end_date: endDate,
        }),
      });

      if (response.ok) {
        const newBudget = await response.json();
        setBudgets([...budgets, newBudget]);
        setOpen(false);
        setCategoryId("");
        setAmount("");
      } else {
        console.error("Failed to create budget");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children || <Button variant="outline">Add Budget</Button>}
      </SheetTrigger>
      <SheetContent className="bg-[#121212] text-white border-white/15">
        <SheetHeader>
          <SheetTitle className="text-white">Create Category Budget</SheetTitle>
          <SheetDescription>
            Set a spending limit for a specific category.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <CategorySelect value={categoryId} onValueChange={setCategoryId} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-transparent border-white/15 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start">Start Date</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-white/15 text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end">End Date</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-white/15 text-white"
              />
            </div>
          </div>
          <SheetFooter>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black hover:bg-white/90"
            >
              {loading ? "Saving..." : "Save Budget"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
