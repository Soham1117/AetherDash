import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/context/AuthContext";
import { AddBudgetSheet } from "../finance/budgets/AddBudgetSheet";
import { Button } from "./button";
import { Plus } from "lucide-react";

interface BudgetProgress {
  id: number;
  category: string;
  category_icon?: string;
  category_color?: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
}

export default function BudgetCard() {
  const { tokens } = useAuth();
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBudgets = () => {
    if (tokens?.access) {
      setLoading(true);
      fetch("http://localhost:8000/budgets/progress/", {
        headers: { Authorization: `Bearer ${tokens.access}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
            setBudgets(data);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, [tokens]);

  return (
    <div className="border border-white/15 min-h-[60vh] p-10 cursor-default flex flex-col">
      <div className="flex justify-between items-center mb-10">
        <span className="text-lg font-normal text-white">Budgets (This Month)</span>
        <AddBudgetSheet>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10" onClick={(e) => {
              // The sheet trigger wraps this, but we can also trigger refresh on close if passed as prop
          }}>
            <Plus className="h-4 w-4" />
          </Button>
        </AddBudgetSheet>
      </div>
      
      <div className="flex flex-col gap-6 text-sm w-full overflow-y-auto flex-grow custom-scrollbar">
        {budgets.length === 0 && !loading && (
          <div className="text-white/50 text-center py-10 flex flex-col gap-2 items-center">
            <span>No active budgets</span>
            <AddBudgetSheet>
                <Button variant="link" className="text-blue-400">Create one</Button>
            </AddBudgetSheet>
          </div>
        )}
        
        {budgets.map((b) => (
          <div key={b.id} className="flex flex-col gap-2 group">
            <div className="flex justify-between items-center text-xs text-white/80">
              <span className="flex items-center gap-2 font-medium">
                 {b.category_color && <div className="w-2 h-2 rounded-none" style={{backgroundColor: b.category_color}} />}
                 {b.category}
              </span>
              <span>
                  <span className={b.remaining < 0 ? "text-red-400" : "text-white"}>
                    ${b.spent.toFixed(0)}
                  </span>
                  <span className="text-white/40"> / ${b.budgeted.toFixed(0)}</span>
              </span>
            </div>
            
            <Progress 
                value={Math.min(b.percentage, 100)} 
                className={`h-2 ${b.percentage > 100 ? "[&>div]:bg-red-500" : b.percentage > 85 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500"}`} 
            />
            
            <div className="flex justify-between text-[10px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <span>{b.percentage.toFixed(0)}% used</span>
                <span>${Math.abs(b.remaining).toFixed(0)} {b.remaining < 0 ? 'over' : 'left'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
