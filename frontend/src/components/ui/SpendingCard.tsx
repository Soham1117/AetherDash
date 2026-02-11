import { Progress } from "@/components/ui/progress";
import { useDash } from "@/context/DashboardContext";

const SpendingCard = () => {
  const { spendingList } = useDash();

  return (
    <div className="border border-white/15 min-h-[60vh] p-10 cursor-default">
      <div className="flex flex-col gap-12 items-start justify-start w-full">
        <span className="text-lg font-normal text-white">Spending</span>
        <div className="flex flex-col gap-4 text-sm w-full">
          {spendingList.map((spending, index) => {
            return (
              <div key={index}>
                <div className="flex flex-row gap-4 items-center justify-between">
                  <div className="flex flex-row gap-4 items-center">
                    <div
                      className={` h-3 w-3`}
                      style={{ backgroundColor: spending.color }}
                    ></div>
                    <div>
                      <span> {spending.name}</span>
                    </div>
                  </div>
                  <div className="w-1/2 group relative">
                    <Progress value={spending.percentage} />
                    <div
                      className="absolute flex-row -left-1/3 top-4 h-8 p-3 z-10 text-sm gap-14 text-white flex items-center justify-center border 
                border-[#2b2b2b]  bg-[#121212] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    >
                      <div className="flex flex-row gap-2 items-center">
                        <div
                          className={`h-3 w-3`}
                          style={{ backgroundColor: spending.color }}
                        ></div>
                        <div className="font-semibold">
                          {" "}
                          ${spending.expense}
                        </div>
                      </div>
                      <div className="text-white/60 text-sm">
                        {spending.percentage}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SpendingCard;
