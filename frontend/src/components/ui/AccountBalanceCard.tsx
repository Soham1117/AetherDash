import { PieChartDB } from "./PieChartDB";

const AccountBalanceCard = () => {
  return (
    <div className="border border-white/15  min-h-[60vh] h-[60vh] p-10 cursor-default">
      <div className="flex flex-col gap-10 items-start justify-start w-full">
        <span className="text-lg font-normal text-white">Balance</span>
        <div className="w-full">
          <PieChartDB />
        </div>
      </div>
    </div>
  );
};

export default AccountBalanceCard;
