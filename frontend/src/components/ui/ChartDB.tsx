"use client";

import { useState } from "react";
import { CartesianGrid, XAxis } from "recharts";
import { Bar, BarChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from "@/components/ui/chart";
import { DatePickerWithRange } from "./DatePickerWithRange";
import { TransactionListItem, useDash } from "@/context/DashboardContext";

const transformDataMonthly = (
  transactions: TransactionListItem[],
  startDate?: Date,
  endDate?: Date
) => {
  const groupedData: { [key: string]: { income: number; expense: number } } = {};

  transactions.forEach((transaction) => {
    // Skip transfers - they don't count as income or expenses
    const transferLike = transaction.is_transfer || (transaction.category || '').toLowerCase() === 'transfer';
    if (transferLike) return;

    const transactionDate = new Date(transaction.timestamp);

    if (
      (!startDate || transactionDate >= startDate) &&
      (!endDate || transactionDate <= endDate)
    ) {
      // Group by YYYY-MM
      const year = transactionDate.getFullYear();
      const month = String(transactionDate.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;

      if (!groupedData[key]) {
        groupedData[key] = { income: 0, expense: 0 };
      }

      const amount = parseFloat(transaction.amount.toString());
      const cat = (transaction.category || '').toLowerCase();
      const isRefund = cat === 'refund';
      if (transaction.transaction_type === "credit") {
        if (isRefund) {
          // Refund reduces prior spending; don't inflate income.
          groupedData[key].expense = Math.max(0, groupedData[key].expense - amount);
        } else {
          groupedData[key].income += amount;
        }
      } else if (transaction.transaction_type === "debit") {
        groupedData[key].expense += Math.abs(amount);
      }
    }
  });

  return Object.keys(groupedData)
    .map((date) => ({
      date,
      income: groupedData[date].income,
      expense: groupedData[date].expense,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const chartConfig = {
  income: {
    label: "Income",
    color: "hsl(var(--chart-2))", // Usually green-ish
  },
  expense: {
    label: "Expenses",
    color: "hsl(var(--chart-1))", // Usually red-ish
  },
} satisfies ChartConfig;

type DateRange = {
  from?: Date;
  to?: Date;
};

export function Chart() {
  const { transactionList } = useDash();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const handleDateChange = (dateRange: DateRange | undefined) => {
    setDateRange(dateRange);
  };

  const chartData = transformDataMonthly(
    transactionList,
    dateRange?.from,
    dateRange?.to
  );

  // Calculate totals for the selected period
  const totalIncome = chartData.reduce((sum, item) => sum + item.income, 0);
  const totalExpense = chartData.reduce((sum, item) => sum + item.expense, 0);
  const netCashFlow = totalIncome - totalExpense;

  // Calculate cleaned lifetime totals from all transactions
  const lifetimeIncome = transactionList.reduce((sum, transaction) => {
    const transferLike = transaction.is_transfer || (transaction.category || '').toLowerCase() === 'transfer';
    const cat = (transaction.category || '').toLowerCase();
    if (transferLike || transaction.transaction_type !== 'credit' || cat === 'refund') return sum;
    return sum + Math.abs(parseFloat(transaction.amount.toString()) || 0);
  }, 0);

  const lifetimeExpense = transactionList.reduce((sum, transaction) => {
    const transferLike = transaction.is_transfer || (transaction.category || '').toLowerCase() === 'transfer';
    if (transferLike || transaction.transaction_type !== 'debit') return sum;
    return sum + Math.abs(parseFloat(transaction.amount.toString()) || 0);
  }, 0);

  const totalTransfers = transactionList.reduce((sum, transaction) => {
    const transferLike = transaction.is_transfer || (transaction.category || '').toLowerCase() === 'transfer';
    if (!transferLike) return sum;
    return sum + Math.abs(parseFloat(transaction.amount.toString()) || 0);
  }, 0);

  const lifetimeNetSavings = lifetimeIncome - lifetimeExpense;

  const formattedNet = netCashFlow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedLifetimeIncome = lifetimeIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedLifetimeExpense = lifetimeExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedTotalTransfers = totalTransfers.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedLifetimeNetSavings = lifetimeNetSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div>
      <Card className={`flex flex-col gap-6 font-poppins bg-[#121212] border-none`}>
        <CardHeader className="flex flex-col items-stretch space-y-0 p-0 sm:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-4 py-5 sm:py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex flex-col gap-4 w-full">
                <div className="flex flex-col">
                  <span className="text-sm text-white/60">Net Cash Flow</span>
                  <CardTitle className="text-4xl font-mono flex flex-row gap-2 items-end justify-start mt-1">
                    <span className={`text-2xl ${netCashFlow >= 0 ? 'text-green-500' : 'text-red-500'}`}>$</span>
                    <span className={netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}>{formattedNet}</span>
                  </CardTitle>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-white/10 bg-[#181818] p-3">
                    <div className="text-xs text-white/60">Total Income Till Now</div>
                    <div className="text-xl font-mono text-green-400 mt-1">${formattedLifetimeIncome}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#181818] p-3">
                    <div className="text-xs text-white/60">Total Expense Till Now</div>
                    <div className="text-xl font-mono text-red-400 mt-1">${formattedLifetimeExpense}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#181818] p-3">
                    <div className="text-xs text-white/60">Total Transfers Till Now</div>
                    <div className="text-xl font-mono text-sky-400 mt-1">${formattedTotalTransfers}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#181818] p-3">
                    <div className="text-xs text-white/60">Net Savings Till Now</div>
                    <div className={`text-xl font-mono mt-1 ${lifetimeNetSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>${formattedLifetimeNetSavings}</div>
                  </div>
                </div>
              </div>
              <DatePickerWithRange onDateChange={handleDateChange} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 lg:p-0 sm:p-6">
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[350px] w-full"
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const [year, month] = value.split('-');
                  const date = new Date(parseInt(year), parseInt(month) - 1);
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    year: "2-digit",
                  });
                }}
              />
              <ChartTooltip
                cursor={{ fill: '#ffffff05' }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      const [year, month] = value.split('-');
                      const date = new Date(parseInt(year), parseInt(month) - 1);
                      return date.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      });
                    }}
                  />
                }
              />
              <Bar
                dataKey="income"
                fill="var(--color-income)"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
              <Bar
                dataKey="expense"
                fill="var(--color-expense)"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

export default Chart;
