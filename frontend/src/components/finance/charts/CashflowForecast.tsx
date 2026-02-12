"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
} from "recharts";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  projected_balance: {
    label: "Balance",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function CashflowForecast() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { tokens } = useAuth();

  useEffect(() => {
    const fetchForecast = async () => {
      if (!tokens?.access) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/predictions/cashflow/?days=30`, {
          headers: { Authorization: `Bearer ${tokens.access}` },
        });
        const result = await res.json();
        setData(result);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchForecast();
  }, [tokens]);

  if (loading) {
    return (
      <div className="border border-white/15 p-10 h-[400px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/20" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="border border-white/15 p-10 text-white col-span-2 flex flex-col gap-6">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-normal text-white">Cash Flow Forecast</span>
          <span className="text-sm text-white/40">30-day balance projection</span>
        </div>
        <div className="flex gap-4">
            <div className="text-right">
                <p className="text-[10px] text-white/40 uppercase">Avg Daily Net</p>
                <p className={`font-bold ${data.avg_daily_income - data.avg_daily_expense >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${(data.avg_daily_income - data.avg_daily_expense).toFixed(2)}
                </p>
            </div>
        </div>
      </div>
      <div>
        {data.warning_date && (
           <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 flex gap-3 items-center text-red-400 text-sm">
             <AlertCircle className="h-4 w-4" />
             <p>Balance projected to drop below zero on <b>{data.warning_date}</b></p>
           </div>
        )}
        
        <ChartContainer config={chartConfig} className="h-[250px] w-full mt-4">
            <AreaChart data={data.forecast}>
              <defs>
                <linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-projected_balance)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-projected_balance)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#666" 
                fontSize={10} 
                tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#666" 
                fontSize={10} 
                tickFormatter={(val) => `$${val}`}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip 
                content={
                    <ChartTooltipContent 
                        labelFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    />
                } 
              />
              <Area 
                type="monotone" 
                dataKey="projected_balance" 
                stroke="var(--color-projected_balance)" 
                fillOpacity={1} 
                fill="url(#fillBalance)" 
                strokeWidth={2}
              />
            </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
}
