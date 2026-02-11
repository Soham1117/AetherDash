"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
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

interface PayeeAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function PayeeAutocomplete({
  value,
  onChange,
  className,
}: PayeeAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const { tokens } = useAuth();

  // Debounce logic
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        fetchSuggestions(query);
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const fetchSuggestions = async (search: string) => {
    if (!tokens?.access) return;
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8000/transactions/payee_suggestions/?q=${encodeURIComponent(
          search
        )}`,
        {
          headers: { Authorization: `Bearer ${tokens.access}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (e) {
      console.error("Failed to fetch suggestions", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between bg-transparent border-white/15", className)}
        >
          {value || "Select payee..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 bg-[#121212] border-white/15">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search payee..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && (
              <div className="py-6 text-center text-sm flex items-center justify-center text-white/50">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}
            {!loading && suggestions.length === 0 && query.length >= 2 && (
              <CommandEmpty>No payees found. Use &quot;{query}&quot;</CommandEmpty>
            )}
            
            <CommandGroup>
              {suggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion}
                  value={suggestion}
                  onSelect={(currentValue) => {
                    onChange(currentValue);
                    setOpen(false);
                    setQuery(""); 
                  }}
                  className="text-white hover:bg-white/10 cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === suggestion ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {suggestion}
                </CommandItem>
              ))}
              
              {/* Allow selecting the typed value if it's not in suggestions */}
              {query && !suggestions.includes(query) && (
                <CommandItem
                  value={query}
                  onSelect={() => {
                    onChange(query);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-white hover:bg-white/10 cursor-pointer"
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  Create &quot;{query}&quot;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
