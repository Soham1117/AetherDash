"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend
} from "recharts";
import { Loader2 } from "lucide-react";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent
} from "@/components/ui/chart";

const COLORS = [
  "hsl(var(--chart-1))", 
  "hsl(var(--chart-2))", 
  "hsl(var(--chart-3))", 
  "hsl(var(--chart-4))", 
  "hsl(var(--chart-5))", 
  "#EC4899", 
  "#06B6D4", 
  "#6366F1", 
  "#F97316"
];

export function SpendingTrends() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { tokens } = useAuth();

  useEffect(() => {
    const fetchTrends = async () => {
      if (!tokens?.access) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/transactions/trends/?months=6`, {
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
    fetchTrends();
  }, [tokens]);

  const chartConfig = useMemo(() => {
    if (!data?.categories) return {};
    const config: ChartConfig = {};
    data.categories.forEach((cat: string, index: number) => {
        // Slugify category name for safe CSS variable usage
        const slug = cat.toLowerCase().replace(/[^a-z0-9]/g, "-");
        config[slug] = {
            label: cat,
            color: COLORS[index % COLORS.length],
        };
    });
    return config;
  }, [data]);

  if (loading) {
    return (
      <div className="border border-white/15 p-10 min-h-[60vh] h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/20" />
      </div>
    );
  }

  if (!data || !data.trends || data.trends.length === 0) return null;

  return (
    <div className="border border-white/15 p-10 text-white col-span-1 flex flex-col gap-6 min-h-[60vh] h-full">
      <div className="flex flex-col gap-1">
        <span className="text-lg font-normal text-white">Spending Trends</span>
        <span className="text-sm text-white/40">Monthly expense breakdown by category</span>
      </div>
      <ChartContainer config={chartConfig} className="flex-1 w-full min-h-0 aspect-auto">
          <BarChart data={data.trends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
            <XAxis 
              dataKey="month" 
              stroke="#666" 
              fontSize={10} 
              tickFormatter={(str) => {
                  const [year, month] = str.split('-');
                  return new Date(parseInt(year), parseInt(month)-1).toLocaleDateString(undefined, { month: 'short' });
              }}
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
                content={<ChartTooltipContent indicator="line" />}
                cursor={{ fill: '#ffffff05' }}
            />
            {data.categories.map((cat: string, index: number) => {
              const slug = cat.toLowerCase().replace(/[^a-z0-9]/g, "-");
              return (
                <Bar 
                    key={cat} 
                    dataKey={cat} 
                    name={slug} // Pass slug as name to match config key
                    stackId="a" 
                    fill={`var(--color-${slug})`}
                    radius={index === data.categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                />
              );
            })}
            <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
          </BarChart>
      </ChartContainer>
    </div>
  );
}
