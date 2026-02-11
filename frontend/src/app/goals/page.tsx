"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, PiggyBank, Target, TrendingUp } from "lucide-react";

interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  icon: string | null;
  color: string;
  is_completed: boolean;
  progress: number;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const { tokens } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // New goal form
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: "", target_amount: "", deadline: "", color: "#10B981" });
  
  // Add funds dialog
  const [addFundsDialogOpen, setAddFundsDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [fundsAmount, setFundsAmount] = useState("");

  const fetchGoals = async () => {
    if (!tokens?.access) return;
    try {
      const res = await fetch("http://localhost:8000/transactions/goals/", {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setGoals(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [tokens]);

  const handleCreateGoal = async () => {
    if (!newGoal.name || !newGoal.target_amount) return;
    try {
      const res = await fetch("http://localhost:8000/transactions/goals/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens?.access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newGoal.name,
          target_amount: parseFloat(newGoal.target_amount),
          deadline: newGoal.deadline || null,
          color: newGoal.color,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setGoals([created, ...goals]);
        setSheetOpen(false);
        setNewGoal({ name: "", target_amount: "", deadline: "", color: "#10B981" });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddFunds = async () => {
    if (!selectedGoal || !fundsAmount) return;
    try {
      const res = await fetch(`http://localhost:8000/transactions/goals/${selectedGoal.id}/add_funds/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens?.access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: parseFloat(fundsAmount) }),
      });
      if (res.ok) {
        const updated = await res.json();
        setGoals(goals.map(g => g.id === updated.id ? updated : g));
        setAddFundsDialogOpen(false);
        setFundsAmount("");
        setSelectedGoal(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this savings goal?")) return;
    try {
      const res = await fetch(`http://localhost:8000/transactions/goals/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokens?.access}` },
      });
      if (res.ok) {
        setGoals(goals.filter(g => g.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const totalSaved = goals.reduce((sum, g) => sum + g.current_amount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.target_amount, 0);

  return (
    <div className="min-h-screen bg-[#121212] text-white p-8 pl-24 pt-20">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <PiggyBank className="h-8 w-8 text-green-400" />
            Savings Goals
          </h1>
          <p className="text-white/50 mt-1">Track your progress toward financial targets</p>
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="mr-2 h-4 w-4" /> New Goal
            </Button>
          </SheetTrigger>
          <SheetContent className="bg-[#121212] text-white border-white/15">
            <SheetHeader>
              <SheetTitle className="text-white">Create Savings Goal</SheetTitle>
              <SheetDescription>Set a target to work toward.</SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Goal Name</Label>
                <Input
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                  placeholder="e.g. Emergency Fund"
                  className="bg-transparent border-white/15"
                />
              </div>
              <div className="grid gap-2">
                <Label>Target Amount ($)</Label>
                <Input
                  type="number"
                  value={newGoal.target_amount}
                  onChange={(e) => setNewGoal({ ...newGoal, target_amount: e.target.value })}
                  placeholder="10000"
                  className="bg-transparent border-white/15"
                />
              </div>
              <div className="grid gap-2">
                <Label>Deadline (Optional)</Label>
                <Input
                  type="date"
                  value={newGoal.deadline}
                  onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                  className="bg-transparent border-white/15"
                />
              </div>
              <div className="grid gap-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899"].map(color => (
                    <button
                      key={color}
                      onClick={() => setNewGoal({ ...newGoal, color })}
                      className={`w-8 h-8 rounded-none border-2 ${newGoal.color === color ? "border-white" : "border-transparent"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <SheetFooter>
              <Button onClick={handleCreateGoal} className="w-full bg-green-600 hover:bg-green-700">
                Create Goal
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-600/20 to-green-900/20 rounded-none p-6 border border-green-500/20">
          <TrendingUp className="h-8 w-8 text-green-400 mb-2" />
          <p className="text-white/60 text-sm">Total Saved</p>
          <p className="text-3xl font-bold text-green-400">${totalSaved.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-900/20 rounded-none p-6 border border-blue-500/20">
          <Target className="h-8 w-8 text-blue-400 mb-2" />
          <p className="text-white/60 text-sm">Total Target</p>
          <p className="text-3xl font-bold text-blue-400">${totalTarget.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-600/20 to-purple-900/20 rounded-none p-6 border border-purple-500/20">
          <PiggyBank className="h-8 w-8 text-purple-400 mb-2" />
          <p className="text-white/60 text-sm">Active Goals</p>
          <p className="text-3xl font-bold text-purple-400">{goals.filter(g => !g.is_completed).length}</p>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => (
          <div
            key={goal.id}
            className={`bg-[#1c1c1c] rounded-none p-6 border border-white/10 relative overflow-hidden ${goal.is_completed ? "opacity-75" : ""}`}
          >
            {/* Color accent */}
            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: goal.color }} />
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">{goal.name}</h3>
                {goal.deadline && (
                  <p className="text-xs text-white/40">
                    Due: {new Date(goal.deadline).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                onClick={() => handleDelete(goal.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/60">Progress</span>
                <span className="font-bold" style={{ color: goal.color }}>
                  {goal.progress}%
                </span>
              </div>
              <Progress 
                value={goal.progress} 
                className="h-3"
                style={{ "--progress-color": goal.color } as any}
              />
            </div>

            <div className="flex justify-between items-end">
              <div>
                <p className="text-2xl font-bold">${goal.current_amount.toLocaleString()}</p>
                <p className="text-xs text-white/40">of ${goal.target_amount.toLocaleString()}</p>
              </div>
              {!goal.is_completed && (
                <Button
                  size="sm"
                  style={{ backgroundColor: goal.color }}
                  className="hover:opacity-90"
                  onClick={() => {
                    setSelectedGoal(goal);
                    setAddFundsDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Funds
                </Button>
              )}
              {goal.is_completed && (
                <span className="text-green-400 font-bold text-sm">✓ Completed!</span>
              )}
            </div>
          </div>
        ))}

        {goals.length === 0 && !loading && (
          <div className="col-span-full text-center py-20 text-white/50">
            <PiggyBank className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No savings goals yet</p>
            <p className="text-sm">Create your first goal to start tracking!</p>
          </div>
        )}
      </div>

      {/* Add Funds Dialog */}
      <Dialog open={addFundsDialogOpen} onOpenChange={setAddFundsDialogOpen}>
        <DialogContent className="bg-[#121212] border-white/15 text-white">
          <DialogHeader>
            <DialogTitle>Add Funds to {selectedGoal?.name}</DialogTitle>
            <DialogDescription>
              Current: ${selectedGoal?.current_amount.toLocaleString()} / ${selectedGoal?.target_amount.toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Amount to Add ($)</Label>
            <Input
              type="number"
              value={fundsAmount}
              onChange={(e) => setFundsAmount(e.target.value)}
              placeholder="100"
              className="bg-transparent border-white/15 mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFundsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFunds} className="bg-green-600 hover:bg-green-700">
              Add Funds
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
