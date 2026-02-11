import * as React from "react"
import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number
  onValueChange: (value: string) => void
  step?: number
  min?: number
  max?: number
}

export function NumberInput({ 
  className, 
  value, 
  onValueChange, 
  step = 1,
  min = 0,
  max,
  ...props 
}: NumberInputProps) {
  
  const handleIncrement = (e: React.MouseEvent) => {
    e.preventDefault();
    const currentValue = parseFloat(value.toString()) || 0;
    const newValue = currentValue + step;
    if (max !== undefined && newValue > max) return;
    onValueChange(newValue.toString());
  }

  const handleDecrement = (e: React.MouseEvent) => {
    e.preventDefault();
    const currentValue = parseFloat(value.toString()) || 0;
    const newValue = currentValue - step;
    if (min !== undefined && newValue < min) return;
    onValueChange(newValue.toString());
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onValueChange(e.target.value);
  }

  return (
    <div className={cn("flex items-center space-x-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={handleDecrement}
        tabIndex={-1}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <div className="relative">
        <Input
          type="number"
          value={value}
          onChange={handleChange}
          step={step}
          min={min}
          max={max}
          className="h-8 w-16 text-center px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          {...props}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={handleIncrement}
        tabIndex={-1}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  )
}
