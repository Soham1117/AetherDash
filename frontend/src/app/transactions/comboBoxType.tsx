import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const ComboboxType = ({
  options,
  setType,
  value: controlledValue,
  matchTriggerWidth,
}: {
  options: { value: string; label: string }[];
  setType: (type: string) => void;
  value?: string;
  /** When true, trigger and dropdown match the container width (e.g. full-width form rows). */
  matchTriggerWidth?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(controlledValue || "");
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between",
            matchTriggerWidth ? "w-full min-w-0" : "w-[200px]"
          )}
        >
          {value
            ? options.find((option) => option.value === value)?.label
            : "Select type..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-0",
          matchTriggerWidth
            ? "w-[var(--radix-popover-trigger-width)] max-w-none"
            : "w-[200px]"
        )}
      >
        <Command>
          <CommandInput placeholder="Search type..." />
          <CommandEmpty>No type found.</CommandEmpty>
          <CommandGroup>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={(currentValue) => {
                  const newValue = currentValue === value ? "" : currentValue;
                  if (controlledValue === undefined) {
                    setInternalValue(newValue);
                  }
                  setType(option.value); // Pass the type
                  setOpen(false);
                }}
              >
                <Check
                  className={`mr-2 h-4 w-4 ${
                    value === option.value ? "opacity-100" : "opacity-0"
                  }`}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
