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
      className={`flex flex-col gap-4 font-sans min-h-lvh w-full bg-[#121212] pt-4 mb-24 md:mb-20 pl-4 pr-4 md:pl-24 md:pr-12`}
    >
      <div>
        <Chart />
      </div>
      <div className="h-4 md:h-16"></div>
      <div className="flex flex-col gap-4">
        <Carousel className="w-full mt-4">
          <CarouselContent className="-ml-2 mt-4 md:-ml-4">
            <CarouselItem className="pl-2 basis-[92%] sm:basis-[75%] md:pl-4 md:basis-1/3">
              <div className="h-[50vh] md:h-[60vh] overflow-hidden">
                 <SpendingTrends />
              </div>
            </CarouselItem>
            <CarouselItem className="pl-2 basis-[92%] sm:basis-[75%] md:pl-4 md:basis-1/3">
              <TransactionsCard />
            </CarouselItem>
            <CarouselItem className="pl-2 basis-[92%] sm:basis-[75%] md:pl-4 md:basis-1/3">
              <AccountBalanceCard />
            </CarouselItem>
            <CarouselItem className="pl-2 basis-[92%] sm:basis-[75%] md:pl-4 md:basis-1/3">
              <TrackerCard />
            </CarouselItem>
            <CarouselItem className="pl-2 basis-[92%] sm:basis-[75%] md:pl-4 md:basis-1/3">
              <BudgetCard />
            </CarouselItem>
          </CarouselContent>
          <div className="hidden md:block">
            <CarouselPrevious />
            <CarouselNext />
          </div>
        </Carousel>

        <div className="flex flex-col gap-6 mt-12 mb-12 w-full">
            <SankeyFlow />
            <CashflowForecast />
        </div>
      </div>
    </div>
  );
}