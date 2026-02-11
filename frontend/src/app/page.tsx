"use client";
import Chart from "@/components/ui/ChartDB";
import TransactionsCard from "@/components/ui/TransactionsCard";
import AccountBalanceCard from "@/components/ui/AccountBalanceCard";
import TrackerCard from "@/components/ui/TrackerCard";
import BudgetCard from "@/components/ui/BudgetCard";
import { SpendingTrends } from "@/components/finance/charts/SpendingTrends";
import { CashflowForecast } from "@/components/finance/charts/CashflowForecast";
import { SankeyFlow } from "@/components/finance/charts/SankeyFlow";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export default function Home() {
  return (
    <div
      className={`flex flex-col gap-4 font-sans min-h-lvh w-full bg-[#121212] pt-4 mb-20 pl-24 pr-12`}
    >
      <div>
        <Chart />
      </div>
      <div className="h-16"></div>
      <div className="flex flex-col gap-4">
        <Carousel className="w-full mt-4">
          <CarouselContent className="-ml-2 mt-4 md:-ml-4">
            <CarouselItem className="pl-2 md:pl-4 md:basis-1/3">
              <div className="h-[60vh] overflow-hidden">
                 <SpendingTrends />
              </div>
            </CarouselItem>
            <CarouselItem className="pl-2 md:pl-4 md:basis-1/3">
              <TransactionsCard />
            </CarouselItem>
            <CarouselItem className="pl-2 md:pl-4 md:basis-1/3">
              <AccountBalanceCard />
            </CarouselItem>
            <CarouselItem className="pl-2 md:pl-4 md:basis-1/3">
              <TrackerCard />
            </CarouselItem>
            <CarouselItem className="pl-2 md:pl-4 md:basis-1/3">
              <BudgetCard />
            </CarouselItem>
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>

        <div className="flex flex-col gap-6 mt-12 mb-12 w-full">
            <SankeyFlow />
            <CashflowForecast />
        </div>
      </div>
    </div>
  );
}