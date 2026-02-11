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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategorySelect } from "../categories/category-select";
import { useAuth } from "@/context/AuthContext";

export function AddRuleSheet({ children, onRuleAdded }: { children?: React.ReactNode, onRuleAdded: (rule: any) => void }) {
  const [open, setOpen] = useState(false);
  const [matchValue, setMatchValue] = useState("");
  const [matchType, setMatchType] = useState("contains");
  const [categoryId, setCategoryId] = useState("");
  
  const { tokens } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchValue || !categoryId) return;

    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/transactions/rules/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.access}`,
        },
        body: JSON.stringify({
          match_value: matchValue,
          match_type: matchType,
          category_ref: parseInt(categoryId),
        }),
      });

      if (response.ok) {
        const newRule = await response.json();
        onRuleAdded(newRule);
        setOpen(false);
        setMatchValue("");
        setCategoryId("");
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
        {children || <Button variant="outline">Add Rule</Button>}
      </SheetTrigger>
      <SheetContent className="bg-[#121212] text-white border-white/15">
        <SheetHeader>
          <SheetTitle className="text-white">Create Categorization Rule</SheetTitle>
          <SheetDescription>
            Automatically categorizes transactions matching the criteria.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>If Transaction Name/Merchant...</Label>
            <div className="flex gap-2">
                <Select value={matchType} onValueChange={setMatchType}>
                    <SelectTrigger className="w-[140px] bg-transparent border-white/15 text-white">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121212] border-white/15 text-white">
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="equals">Equals</SelectItem>
                        <SelectItem value="starts_with">Starts With</SelectItem>
                        <SelectItem value="regex">Regex</SelectItem>
                    </SelectContent>
                </Select>
                <Input 
                    value={matchValue} 
                    onChange={e => setMatchValue(e.target.value)} 
                    placeholder="e.g. Starbucks"
                    className="bg-transparent border-white/15 text-white flex-1"
                />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Then Assign Category</Label>
            <CategorySelect value={categoryId} onValueChange={setCategoryId} />
          </div>
          
          <SheetFooter>
            <Button type="submit" disabled={loading} className="w-full bg-white text-black hover:bg-white/90">
              {loading ? "Saving..." : "Save Rule"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
