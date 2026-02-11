"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddRuleSheet } from "@/components/finance/rules/AddRuleSheet";

interface Rule {
  id: number;
  match_value: string;
  match_type: string;
  category_ref: number;
  category_name: string;
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const { tokens } = useAuth();
  const [loading, setLoading] = useState(true);

  const fetchRules = async () => {
    if (!tokens?.access) return;
    try {
      const res = await fetch("http://localhost:8000/transactions/rules/", {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setRules(data);
    } catch (e) {
      console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [tokens]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this rule?")) return;
    try {
      const res = await fetch(`http://localhost:8000/transactions/rules/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokens?.access}` },
      });
      if (res.ok) {
        setRules(rules.filter((r) => r.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white p-8 pl-24 pt-20">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Categorization Rules</h1>
        <AddRuleSheet onRuleAdded={(rule) => setRules([...rules, rule])}>
          <Button variant="outline" className="bg-[#1c1c1c] border-white/15 text-white hover:bg-[#2b2b2b]">
            <Plus className="mr-2 h-4 w-4" /> Add Rule
          </Button>
        </AddRuleSheet>
      </div>

      <div className="bg-[#1c1c1c] rounded-lg border border-white/10 p-4">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-white/5">
              <TableHead className="text-white">Condition</TableHead>
              <TableHead className="text-white">Value</TableHead>
              <TableHead className="text-white">Assign Category</TableHead>
              <TableHead className="text-right text-white">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id} className="border-white/10 hover:bg-white/5">
                 <TableCell className="capitalize font-mono text-white/70">{rule.match_type.replace('_', ' ')}</TableCell>
                <TableCell className="font-bold text-lg">{rule.match_value}</TableCell>
                <TableCell>
                    <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-none text-sm border border-blue-500/30">
                        {rule.category_name || "Unknown Category"}
                    </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    onClick={() => handleDelete(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
             {rules.length === 0 && !loading && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center py-16 text-white/50">
                        No rules found. Create one to auto-categorize transactions based on description or merchant name.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
