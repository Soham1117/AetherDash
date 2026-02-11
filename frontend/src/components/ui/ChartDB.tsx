"use client";

import { useState } from "react";
import { CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
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
    if (transaction.is_transfer) return;

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
      if (transaction.transaction_type === "credit") {
        groupedData[key].income += amount;
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

  // Calculate totals for the period
  const totalIncome = chartData.reduce((sum, item) => sum + item.income, 0);
  const totalExpense = chartData.reduce((sum, item) => sum + item.expense, 0);
  const netCashFlow = totalIncome - totalExpense;

  const formattedNet = netCashFlow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div>
      <Card className={`flex flex-col gap-6 font-poppins bg-[#121212] border-none`}>
        <CardHeader className="flex flex-col items-stretch space-y-0 p-0 sm:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-4 py-5 sm:py-6">
            <div className="flex flex-row justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-white/60">Net Cash Flow</span>
                <CardTitle className="text-4xl font-mono flex flex-row gap-2 items-end justify-start mt-1">
                  <span className={`text-2xl ${netCashFlow >= 0 ? 'text-green-500' : 'text-red-500'}`}>$</span>
                  <span className={netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}>{formattedNet}</span>
                </CardTitle>
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
