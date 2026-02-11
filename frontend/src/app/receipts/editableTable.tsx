"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MinusIcon, PlusIcon, TrashIcon, X } from "lucide-react";
import { useDispatch } from "react-redux";
import { setResult } from "@/app/redux/receiptSlice";

type LineItem = {
  type: "item" | "tax" | "discount";
  name: string;
  quantity: number;
  unit: string;
  priceAfterDiscount: number;
};

export type ReceiptData = {
  items: LineItem[];
  taxes: {
    type: string;
    amount: number;
  }[];
  discounts: {
    type: string;
    amount: number;
  }[];
  totals: {
    subTotal: number;
    taxes: number;
    serviceFee: number;
    total: number;
  };
  merchant?: {
    name?: string;
    address?: string;
    phone?: string;
  };
  transaction?: {
    date?: string;
    time?: string;
  };
};

type SplitItem = {
  splits: number[];
};

export function BillSplitter({
  initialReceipt,
  onSplitsChange,
}: {
  initialReceipt: ReceiptData;
  onSplitsChange?: (splits: any[]) => void;
}) {
  const dispatch = useDispatch();
  const [splitCount, setSplitCount] = useState(1);
  const [receipt, setReceipt] = useState<ReceiptData>(initialReceipt);
  const [bypassValidation, setBypassValidation] = useState(false);

  const lineItems = useMemo(
    () => [
      ...(receipt.items || []),
      ...(receipt.taxes || []).map((tax) => ({
        type: "tax" as const,
        name: tax.type,
        quantity: 1,
        unit: "",
        priceAfterDiscount: tax.amount,
      })),
      ...(receipt.discounts || []).map((discount) => ({
        type: "discount" as const,
        name: discount.type,
        quantity: 1,
        unit: "",
        priceAfterDiscount: discount.amount,
      })),
    ],
    [receipt]
  );

  const [splits, setSplits] = useState<SplitItem[]>(() =>
    lineItems.map((item) => ({
      splits: Array(splitCount).fill(item.priceAfterDiscount / splitCount),
    }))
  );

  // Only recalculate splits when splitCount increases (new person added) or lineItems change
  // Don't recalculate when splitCount decreases (person was removed via handleRemovePerson)
  useEffect(() => {
    const currentSplitLength = splits[0]?.splits.length || 0;
    
    // Only recalculate if splitCount increased (new person added via button)
    if (splitCount > currentSplitLength) {
      // New person added - add a new column with equal distribution
      const newSplits = lineItems.map((item) => ({
        splits: Array(splitCount).fill(item.priceAfterDiscount / splitCount),
      }));
      setSplits(newSplits);
      if (onSplitsChange) onSplitsChange(newSplits);
    } else if (lineItems.length !== splits.length) {
      // Line items changed - recalculate with current split count
      const currentCount = currentSplitLength || splitCount;
      const newSplits = lineItems.map((item) => ({
        splits: Array(currentCount).fill(item.priceAfterDiscount / currentCount),
      }));
      setSplits(newSplits);
      if (onSplitsChange) onSplitsChange(newSplits);
    }
    // Don't do anything if splitCount decreased - that's handled by handleRemovePerson
  }, [splitCount, lineItems.length]);

  useEffect(() => {
    if (initialReceipt && Array.isArray(initialReceipt.items)) {
      setReceipt(initialReceipt);
    } else {
      console.error("Invalid initialReceipt format:", initialReceipt);
    }
  }, [initialReceipt]);

  const handleSplitChange = (
    itemIndex: number,
    splitIndex: number,
    value: string,
    recalculateOthers: boolean = false
  ) => {
    const newSplits = splits.map((item, idx) => {
      if (idx === itemIndex) {
        const newItemSplits = [...item.splits];
        // Allow typing partial numbers (like "12." or empty string)
        if (value === '' || value === '.' || value === '-') {
          newItemSplits[splitIndex] = value as any;
        } else {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            newItemSplits[splitIndex] = numValue;
          } else {
            newItemSplits[splitIndex] = value as any;
          }
        }
        
        // Only recalculate other splits if explicitly requested (on blur) or if we have a valid number
        if (recalculateOthers && typeof newItemSplits[splitIndex] === 'number') {
          const item = lineItems[itemIndex];
          const remainingAmount = item.priceAfterDiscount - newItemSplits[splitIndex];
          const remainingSplits = newItemSplits.length - 1;
          if (remainingSplits > 0 && remainingAmount >= 0) {
            return {
              splits: newItemSplits.map((val, i) =>
                i === splitIndex ? newItemSplits[splitIndex] : remainingAmount / remainingSplits
              ),
            };
          }
        }
        
        return { splits: newItemSplits };
      }
      return item;
    });

    setSplits(newSplits);
    if (onSplitsChange) {
      onSplitsChange(newSplits);
    }
  };

  const recalculateSplits = () => {
    const targetSplitCount = splitCount;
    const updatedSplits = lineItems.map((item) => ({
      splits: Array(targetSplitCount).fill(item.priceAfterDiscount / targetSplitCount),
    }));
    
    setSplits(updatedSplits);
    
    if (onSplitsChange) {
      onSplitsChange(updatedSplits);
    }
  };

  const totalPerSplit = useMemo(() => {
    const currentSplitLength = splits[0]?.splits.length || 0;
    if (currentSplitLength === 0) return [];
    const totals = Array(currentSplitLength).fill(0);
    splits.forEach((item) => {
      item.splits.forEach((split, i) => {
        if (i < currentSplitLength) {
          const numSplit = typeof split === 'number' ? split : 0;
          totals[i] += numSplit;
        }
      });
    });
    return totals;
  }, [splits]);

  const totalBill = totalPerSplit.reduce((total, split) => total + split, 0);
  
  // Calculate extracted total from receipt
  const extractedTotal = receipt.totals?.total || 0;
  
  // Check if totals match (with small tolerance for floating point errors)
  const totalsMatch = Math.abs(totalBill - extractedTotal) < 0.01;
  
  // Calculate difference
  const totalDifference = totalBill - extractedTotal;

  const updateReceipt = (
    type: "item" | "tax" | "discount",
    index: number,
    update: Partial<LineItem>
  ) => {
    const newReceipt = { ...receipt };

    if (type === "item") {
      newReceipt.items = [...receipt.items];
      newReceipt.items[index] = { ...newReceipt.items[index], ...update };
    } else if (type === "tax") {
      newReceipt.taxes = [...receipt.taxes];
      const taxIndex = index - receipt.items.length;
      newReceipt.taxes[taxIndex] = {
        ...newReceipt.taxes[taxIndex],
        type: update.name || newReceipt.taxes[taxIndex].type,
        amount: update.priceAfterDiscount || newReceipt.taxes[taxIndex].amount,
      };
    } else if (type === "discount") {
      newReceipt.discounts = [...receipt.discounts];
      const discountIndex = index - receipt.items.length - receipt.taxes.length;
      newReceipt.discounts[discountIndex] = {
        ...newReceipt.discounts[discountIndex],
        type: update.name || newReceipt.discounts[discountIndex].type,
        amount:
          update.priceAfterDiscount ||
          newReceipt.discounts[discountIndex].amount,
      };
    }

    setReceipt(newReceipt);
    dispatch(setResult(newReceipt));
  };

  const handleRemoveRow = (index: number) => {
    const newReceipt = { ...receipt };

    if (index < receipt.items.length) {
      // Remove an item
      newReceipt.items = receipt.items.filter((_, i) => i !== index);
    } else if (index < receipt.items.length + receipt.taxes.length) {
      // Remove a tax
      const taxIndex = index - receipt.items.length;
      newReceipt.taxes = receipt.taxes.filter((_, i) => i !== taxIndex);
    } else {
      // Remove a discount
      const discountIndex = index - receipt.items.length - receipt.taxes.length;
      newReceipt.discounts = receipt.discounts.filter(
        (_, i) => i !== discountIndex
      );
    }

    setReceipt(newReceipt);
  };

  const handleRemovePerson = (personIndex: number) => {
    // Use actual current split length instead of splitCount state
    const currentSplitLength = splits[0]?.splits.length || splitCount;
    if (currentSplitLength <= 1) return; // Can't remove the last person
    
    // Remove the person's column from all splits and redistribute amounts
    const newSplits = splits.map((item) => {
      const removedAmount = typeof item.splits[personIndex] === 'number' 
        ? item.splits[personIndex] 
        : 0;
      const remainingSplits = item.splits.filter((_, i) => i !== personIndex);
      const remainingCount = remainingSplits.length;
      
      // Redistribute the removed person's amount to remaining splits
      if (remainingCount > 0 && removedAmount > 0) {
        const amountPerPerson = removedAmount / remainingCount;
        return {
          splits: remainingSplits.map((split) => {
            const numSplit = typeof split === 'number' ? split : 0;
            return numSplit + amountPerPerson;
          }),
        };
      }
      
      return { splits: remainingSplits };
    });
    
    setSplits(newSplits);
    setSplitCount(currentSplitLength - 1);
    if (onSplitsChange) {
      onSplitsChange(newSplits);
    }
  };

  return (
    <div className="space-y-4 border w-full border-white/15 p-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        {/* Total Validation */}
        <div className="flex items-center gap-3">
          {!bypassValidation && !totalsMatch && extractedTotal > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-yellow-500/10 border border-yellow-500/30">
              <span className="text-sm text-yellow-500">
                Total mismatch: Calculated ${totalBill.toFixed(2)} vs Extracted ${extractedTotal.toFixed(2)}
                {Math.abs(totalDifference) > 0.01 && (
                  <span className="ml-1">
                    ({totalDifference > 0 ? '+' : ''}${totalDifference.toFixed(2)})
                  </span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBypassValidation(true)}
                className="h-6 px-2 text-xs text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
              >
                Bypass
              </Button>
            </div>
          )}
          {bypassValidation && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-500/10 border border-blue-500/30">
              <span className="text-sm text-blue-500">Validation bypassed</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBypassValidation(false)}
                className="h-6 px-2 text-xs text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"
              >
                Re-enable
              </Button>
            </div>
          )}
          {totalsMatch && !bypassValidation && extractedTotal > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-500/10 border border-green-500/30">
              <span className="text-sm text-green-500">✓ Totals match: ${totalBill.toFixed(2)}</span>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => setSplitCount((c) => c + 1)}
            variant="outline"
            size="sm"
          >
            <PlusIcon className="h-4 w-4 mr-2" /> Add Split
          </Button>
          <Button
            onClick={() => {
              const currentLength = splits[0]?.splits.length || splitCount;
              if (currentLength > 1) {
                setSplitCount(currentLength - 1);
              }
            }}
            variant="outline"
            size="sm"
            disabled={(splits[0]?.splits.length || splitCount) <= 1}
          >
            <MinusIcon className="h-4 w-4 mr-2" /> Remove Split
          </Button>
          <Button onClick={recalculateSplits} variant="outline" size="sm">
            Recalculate
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Description</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Price</TableHead>
            {(splits[0]?.splits.length || splitCount) > 0 && Array.from({ length: splits[0]?.splits.length || splitCount }).map((_, i) => (
              <TableHead key={`person-${i}`} className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span>Person {i + 1}</span>
                  {(splits[0]?.splits.length || splitCount) > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePerson(i)}
                      className="h-6 w-6 p-0 hover:bg-destructive/10"
                      title={`Remove Person ${i + 1}`}
                    >
                      <X className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              </TableHead>
            ))}
            <TableHead>Remove</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {lineItems.map((item, index) => (
            <TableRow key={`${item.type}-${index}`}>
              <TableCell>
                <Input
                  value={item.name}
                  onChange={(e) =>
                    updateReceipt(item.type, index, { name: e.target.value })
                  }
                />
              </TableCell>
              <TableCell>
                <Input
                  value={`${item.quantity} ${item.unit}`}
                  onChange={(e) => {
                    const [quantity, ...unitParts] = e.target.value.split(" ");
                    updateReceipt(item.type, index, {
                      quantity: parseFloat(quantity) || 0,
                      unit: unitParts.join(" "),
                    });
                  }}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="text"
                  key={`price-${index}-${item.priceAfterDiscount}`}
                  defaultValue={item.priceAfterDiscount}
                  onBlur={(e) =>
                    updateReceipt(item.type, index, {
                      priceAfterDiscount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </TableCell>
              {splits[index]?.splits.map((split, splitIndex) => (
                <TableCell key={`split-${index}-${splitIndex}`} className="text-right">
                  <Input
                    type="text"
                    value={split}
                    onChange={(e) => {
                      // Update value without recalculating others (allows continuous typing)
                      handleSplitChange(index, splitIndex, e.target.value, false);
                    }}
                    onBlur={(e) => {
                      // Recalculate other splits when user finishes editing
                      const value = e.target.value;
                      if (value && !isNaN(parseFloat(value))) {
                        handleSplitChange(index, splitIndex, value, true);
                      }
                    }}
                  />
                </TableCell>
              ))}
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveRow(index)}
                >
                  <TrashIcon className="h-4 w-4 text-red-500" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-medium">
              Total
            </TableCell>
            <TableCell className="text-right font-medium">
              {totalBill.toFixed(2)}
            </TableCell>
            {totalPerSplit.map((total, i) => (
              <TableCell key={i} className="text-right font-medium">
                ${total.toFixed(2)}
              </TableCell>
            ))}
            <TableCell></TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
