"use client";
import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pie, PieChart, ResponsiveContainer, Cell } from "recharts";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  LabelList,
  Line,
  LineChart,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "./button";
import Link from "next/link";

interface ParsedResponse {
  type: "table" | "chart" | "navigation" | "csv";
  chart_type: string | null;
  data: any;
}
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "white",
  },
} satisfies ChartConfig;

const extractJsonFromString = (
  input: string,
  setIsJSON: React.Dispatch<React.SetStateAction<boolean>>
): any | null => {
  const jsonRegex = /{[\s\S]*}/;
  const match = input.match(jsonRegex);

  if (match) {
    try {
      setIsJSON(true);
      return JSON.parse(match[0]);
    } catch (error) {
      console.error("Error parsing JSON:", error);
      return null;
    }
  }
  setIsJSON(false);
  return null;
};

export default function ResponseRenderer({ response }: { response: string }) {
  const [parsedData, setParsedData] = useState<ParsedResponse | null>(null);
  const [isJSON, setIsJSON] = useState<boolean>(false);
  // console.log(response);

  const convertToCSV = (data: any[]): string => {
    const headers = Object.keys(data[0]).join(","); // Create CSV headers
    const rows = data.map((item) =>
      Object.values(item)
        .map((value) => `"${value}"`) // Wrap values in quotes to handle commas
        .join(",")
    );
    return `${headers}\n${rows.join("\n")}`; // Combine headers and rows
  };

  const downloadCSV = (csvString: string, filename: string) => {
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    if (parsedData?.type === "csv" && Array.isArray(parsedData.data)) {
      const csvString = convertToCSV(parsedData.data);
      downloadCSV(csvString, "transactions.csv");
    }
  };

  useEffect(() => {
    const jsonMatch = extractJsonFromString(response, setIsJSON);
    setParsedData(jsonMatch);
  }, [response]);

  if (!isJSON) return <p>{response}</p>;

  if (!parsedData) return <p>Loading...</p>;
  if (parsedData.type === "table" && Array.isArray(parsedData.data)) {
    const keys =
      parsedData.data.length > 0 ? Object.keys(parsedData.data[0]) : [];

    return (
      <div className="p-4">
        <Table>
          <TableHeader>
            <TableRow>
              {keys.map((key) => (
                <TableHead key={key} className="capitalize">
                  {key.replace(/_/g, " ")}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsedData.data.map((row: any, index: number) => (
              <TableRow key={index}>
                {keys.map((key) => (
                  <TableCell key={key} className="font-medium">
                    {String(row[key] ?? "-")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (parsedData.type === "chart") {
    if (parsedData.chart_type === "bar") {
      return (
        <Card className="w-[30vw] bg-[#161616] border-none">
          <CardHeader>
            <CardDescription>
              Last {parsedData.data.length} periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <BarChart
                accessibilityLayer
                data={parsedData.data}
                margin={{
                  top: 20,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey={Object.keys(parsedData.data[0])[0]}
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 10)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                {Object.keys(parsedData.data[0])
                  .slice(1)
                  .map((key) => (
                    <Bar key={key} dataKey={key} fill="white" radius={2}>
                      <LabelList
                        position="top"
                        offset={12}
                        className="fill-foreground"
                        fontSize={12}
                      />
                    </Bar>
                  ))}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      );
    }
    if (parsedData.chart_type === "line") {
      return (
        <Card className="w-[30vw] bg-[#161616] border-none">
          <CardHeader>
            <CardDescription>
              Last {parsedData.data.length} periods
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <LineChart
                accessibilityLayer
                data={parsedData.data}
                margin={{ left: 6, right: 6 }}
              >
                <CartesianGrid vertical={true} />
                <XAxis
                  dataKey={Object.keys(parsedData.data[0])[0]}
                  tickLine={true}
                  axisLine={true}
                  tickMargin={8}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                {Object.keys(parsedData.data[0])
                  .slice(1)
                  .map((key) => (
                    <Line
                      key={key}
                      dataKey={key}
                      type="natural"
                      stroke="#ffffff"
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      );
    }

    if (parsedData.chart_type === "pie") {
      const transformedData = parsedData.data.map((item: any) => ({
        label: item.label,
        value: parseFloat(item.value), // Replace with your value key
      }));
      return (
        <Card className="flex flex-col w-[30vw] bg-[#161616] border-none">
          <CardHeader>
            <CardDescription>
              Last {parsedData.data.length} periods
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <ChartTooltip />
                <Pie
                  data={transformedData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {parsedData.data.map(
                    (entry: { fill: string }, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    )
                  )}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );
    }
  }

  if (parsedData.type === "navigation") {
    return (
      <div className="p-4">
        <Link href="/transactions">
          <Button
            className="bg-[#121212] border border-white/15 text-white rounded-none"
            variant={"default"}
          >
            View All
          </Button>
        </Link>
      </div>
    );
  }

  if (parsedData.type === "csv") {
    return (
      <div className="p-4">
        <Button
          onClick={handleDownloadCSV}
          className="bg-[#121212] border border-white/15 text-white rounded-none"
          variant={"default"}
        >
          Download CSV
        </Button>
      </div>
    );
  }

  return <p className="text-gray-400">{response}</p>;
}
