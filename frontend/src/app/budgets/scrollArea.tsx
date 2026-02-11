import * as React from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TransactionListItem } from "@/context/DashboardContext";

export function ScrollAreaDemo({
  transactions,
  budgetCategory,
}: {
  transactions: TransactionListItem[];
  budgetCategory: string;
}) {
  return (
    <ScrollArea className="rounded-none border border-white/15">
      <div className="p-4">
        <h4 className="mb-4 text-md font-semibold leading-none">
          Transactions
        </h4>
        {transactions.map((trans) =>
          trans.category.toLowerCase() === budgetCategory.toLowerCase() ? (
            <>
              <div
                key={trans.id}
                className="text-sm flex flex-row items-center justify-between"
              >
                <div className="w-1/3">{trans.description}</div>
                <div className="w-1/3">{trans.account}</div>
                <div className="w-1/3">$ {trans.amount}</div>
              </div>
              <Separator className="my-2" />
            </>
          ) : null
        )}
      </div>
    </ScrollArea>
  );
}
