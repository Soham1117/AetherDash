"use client";

import React, { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
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
import { useAuth } from "@/context/AuthContext";
import { Tag } from "@/context/TransactionContext";

interface TagSelectProps {
  value: number[]; // Array of tag IDs (multi-select)
  onValueChange: (value: number[]) => void;
  className?: string;
}

export function TagSelect({ value, onValueChange, className }: TagSelectProps) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const { tokens } = useAuth();
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");

  const fetchTags = async () => {
      if (!tokens?.access) return;
      try {
          const res = await fetch("http://localhost:8000/transactions/tags/", {
             headers: { Authorization: `Bearer ${tokens.access}` }
          });
          const data = await res.json();
          if (Array.isArray(data)) setTags(data);
      } catch(e) { console.error(e); }
  };

  useEffect(() => {
      fetchTags();
  }, [tokens]);

  const toggleTag = (id: number) => {
    if (value.includes(id)) {
        onValueChange(value.filter(v => v !== id));
    } else {
        onValueChange([...value, id]);
    }
  };

  const createTag = async () => {
      if (!input || !tokens?.access) return;
      try {
          const res = await fetch("http://localhost:8000/transactions/tags/", {
             method: 'POST',
             headers: { 
                 Authorization: `Bearer ${tokens.access}`,
                 'Content-Type': 'application/json'
             },
             body: JSON.stringify({ name: input, color: '#'+Math.floor(Math.random()*16777215).toString(16) })
          });
          if (res.ok) {
              const newTag = await res.json();
              setTags([...tags, newTag]);
              toggleTag(newTag.id);
              setInput("");
          }
      } catch(e) { console.error(e); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between bg-[#121212] border-white/15 text-white capitalize", className)}
        >
          {value.length > 0 ? `${value.length} tags selected` : "Select tags"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-[#121212] border-white/15">
        <Command className="bg-[#121212] text-white">
          <CommandInput 
            placeholder="Search or create tag..." 
            className="text-white" 
            value={input}
            onValueChange={setInput}
          />
          <CommandList>
            <CommandEmpty>
                {input && (
                  <Button variant="ghost" className="w-full justify-start text-white" onClick={createTag}>
                    <Plus className="mr-2 h-4 w-4" /> Create "{input}"
                  </Button>
                )}
            </CommandEmpty>
            <CommandGroup>
              {tags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={tag.name}
                  onSelect={() => toggleTag(tag.id)}
                  className="text-white hover:bg-white/10"
                >
                  <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-none" style={{backgroundColor: tag.color}} />
                     {tag.name}
                  </div>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value.includes(tag.id) ? "opacity-100" : "opacity-0"
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
