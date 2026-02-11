"use client";

import React from "react";
import { useCategories, Category } from "@/context/CategoryContext";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CategorySelectProps {
  value: number | string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CategorySelect({ value, onValueChange, placeholder = "Select category", className }: CategorySelectProps) {
  const [open, setOpen] = React.useState(false);
  const { categories, loading, getCategoryName } = useCategories();

  // Flatten categories for search
  const flattenCategories = (cats: Category[], depth = 0): (Category & { depth: number })[] => {
    let result: (Category & { depth: number })[] = [];
    cats.forEach(cat => {
      result.push({ ...cat, depth });
      if (cat.children && cat.children.length > 0) {
        result = [...result, ...flattenCategories(cat.children, depth + 1)];
      }
    });
    return result;
  };

  const flatCategories = flattenCategories(categories);
  const selectedName = getCategoryName(value ? parseInt(value.toString()) : null);

  if (loading) return <div>Loading...</div>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between bg-[#121212] border-white/15 text-white capitalize", className)}
        >
          {value ? selectedName : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-[#121212] border-white/15">
        <Command className="bg-[#121212] text-white">
          <CommandInput placeholder="Search category..." className="text-white" />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandGroup>
              {flatCategories.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={cat.name}
                  onSelect={() => {
                    onValueChange(cat.id.toString());
                    setOpen(false);
                  }}
                  className="text-white hover:bg-white/10"
                >
                  <span style={{ marginLeft: `${cat.depth * 12}px` }} className="flex items-center">
                    {cat.icon && <span className="mr-2 text-lg">{cat.icon}</span>}
                    {cat.name}
                  </span>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value?.toString() === cat.id.toString() ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
