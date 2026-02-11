"use client";
import { useState, useEffect } from "react";
import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useDash } from "@/context/DashboardContext";

const chartConfig = {
  accounts: {
    label: "Accounts",
  },
  chrome: {
    label: "Chrome",
    color: "#F8F9FA",
  },
  safari: {
    label: "Safari",
    color: "#DEE2E6",
  },
  firefox: {
    label: "Firefox",
    color: "#ADB5BD",
  },
  edge: {
    label: "Edge",
    color: "#6C757D",
  },
  other: {
    label: "Other",
    color: "#495057",
  },
} satisfies ChartConfig;

type accountListItem = {
  account_name: string;
  balance: number;
  fill: string;
};

export function PieChartDB() {
  const { accounts } = useDash();
  const totalBalance = accounts.reduce(
    (acc, curr) => acc + parseFloat(curr.balance.toString()),
    0
  );

  const [accountsList, setAccountsList] = useState<accountListItem[]>([]);
  useEffect(() => {
    const shadesOfGray = [
      "#495057",
      "#6C757D",
      "#ADB5BD",
      "#DEE2E6",
      "#F8F9FA",
    ];
    const temp = accounts.map((account, index) => ({
      account_name: account.account_name,
      balance: parseFloat(account.balance.toString()),
      fill: shadesOfGray[index],
    }));
    setAccountsList(temp);
  }, [accounts]);

  return (
    <Card className="flex flex-col bg-[#121212] border-none">
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={accountsList}
              dataKey="balance"
              nameKey="account_name"
              innerRadius={60}
              outerRadius={110}
              strokeWidth={10}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-white text-2xl font-bold font-mono"
                        >
                          $ {totalBalance.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-white"
                        ></tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-white/60 text-base"
                        >
                          Total Balance
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
