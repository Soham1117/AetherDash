"use client";
import Chart from "@/components/ui/ChartDB";
import { CashflowForecast } from "@/components/finance/charts/CashflowForecast";
import { SankeyFlow } from "@/components/finance/charts/SankeyFlow";
import { SpendingBreakdown } from "@/components/finance/spending/SpendingBreakdown";

export default function Home() {
  return (
    <div
      className={`flex flex-col gap-4 font-sans min-h-lvh w-full bg-[#121212] pt-4 mb-24 md:mb-20 pl-4 pr-4 md:pl-24 md:pr-12`}
    >
      <div>
        <Chart />
      </div>
      <div className="h-4 md:h-16"></div>
      <div className="flex flex-col gap-4">

        <div className="flex flex-col gap-6 mt-12 mb-12 w-full">
            <SpendingBreakdown />
            <SankeyFlow />
            <CashflowForecast />
        </div>
      </div>
    </div>
  );
}