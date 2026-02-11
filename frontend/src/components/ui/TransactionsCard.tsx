"use client";
import { ComboboxDemo } from "./ComboBox";
import { useEffect, useState } from "react";
import { TransactionListItem, useDash } from "@/context/DashboardContext";
import { Button } from "./button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const data: dataType[] = [
  {
    value: "all",
    label: "All",
  },
  {
    value: "debit",
    label: "Expense",
  },
  {
    value: "credit",
    label: "Income",
  },
];

type dataType = {
  value: string;
  label: string;
};

const TransactionsCard = () => {
  const [selectedData, setSelectedData] = useState<string>("all");
  const { transactionList } = useDash();
  const [recentTransactions, setRecentTransactions] = useState<
    TransactionListItem[]
  >([]);

  useEffect(() => {
    const recent = transactionList
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 10)
      .map((transaction) => ({
        description: transaction.description,
        amount: transaction.amount,
        timestamp: transaction.timestamp,
        transaction_type: transaction.transaction_type,
        account: transaction.account,
        id: transaction.id,
        category: transaction.category,
        is_transfer: transaction.is_transfer,
      }));

    setRecentTransactions(recent);
  }, [transactionList]);

  return (
    <div className="border border-white/15 min-h-[60vh] h-[60vh] p-10 cursor-default">
      <div className="flex flex-col h-full w-full">
        <div className="flex flex-row w-full justify-between items-center mb-6">
          <span className="text-lg font-normal text-white">
            Recent Transactions
          </span>
          <ComboboxDemo onSelect={setSelectedData} data={data} />
        </div>
        <div className="w-full flex-1 min-h-0 mb-6">
          <div className="flex flex-col items-start justify-between w-full border border-white/15 p-3 h-full">
            <div className="flex flex-row items-start justify-between w-full border-b border-white/50 pb-2 mb-2 px-2 flex-none">
              <div className="w-1/2 font-medium text-muted-foreground">Description</div>
              <div className="w-1/4 font-medium text-muted-foreground">Amount</div>
              <div className="w-1/4 font-medium text-muted-foreground">Category</div>
            </div>
            <div className="w-full overflow-y-auto scrollbar-hidden flex-1">
              {recentTransactions.map((transaction) => {
                const temp =
                  selectedData === "all" ||
                  transaction.transaction_type === selectedData;
                return (
                  <div
                    key={transaction.id}
                    className={`flex flex-row items-center justify-between w-full py-2 px-2 border-b border-white/20 last:border-0 ${
                      transaction.is_transfer
                        ? "text-white/40"
                        : transaction.transaction_type === "debit"
                        ? "text-white"
                        : "text-green-500"
                    } ${temp ? "" : "hidden"}`}
                  >
                    <div className="w-1/2 pr-2 flex items-center gap-2">
                      <span className="truncate" title={transaction.description}>
                        {transaction.description}
                      </span>
                      {transaction.is_transfer && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex-shrink-0">
                          <ArrowRight className="h-2.5 w-2.5" />
                          Transfer
                        </span>
                      )}
                    </div>
                    <div className="w-1/4 truncate">
                      $ {transaction.amount}
                    </div>
                    <div className="w-1/4 truncate" title={transaction.category}>
                      {transaction.category}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end w-full">
          <Link href="/transactions">
            <Button
              className="bg-[#121212] border border-white/15 text-white rounded-none"
              variant={"default"}
            >
              View All
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TransactionsCard;
