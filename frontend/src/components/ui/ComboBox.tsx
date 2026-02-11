"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Roboto } from "next/font/google";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type dataType = {
  value: string;
  label: string;
};

type ComboboxProps = {
  onSelect: (value: string) => void;
  data: dataType[];
};

const inter = Roboto({ subsets: ["latin"], weight: "300" });

export function ComboboxDemo({ onSelect, data }: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(data[0].value); // Default to first value

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select an option"
          className="w-[200px] justify-between border border-white/15 py-1 rounded-none bg-[#121212] text-white hover:bg-[#121212]/40 hover:text-white"
        >
          {data.find((item) => item.value === value)?.label}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={`w-[200px] border border-white/15 py-1 bg-[#121212] text-white rounded-none ${inter.className}`}
      >
        <Command>
          <CommandList>
            <CommandGroup>
              {data.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  onSelect={() => {
                    setValue(item.value);
                    onSelect(item.value);
                    setOpen(false);
                  }}
                >
                  {item.label}
                  <Check
                    className={cn(
                      "ml-auto",
                      value === item.value ? "opacity-100" : "opacity-0"
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
