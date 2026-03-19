"use client";
import { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MdSpaceDashboard } from "react-icons/md";
import { FaRegListAlt } from "react-icons/fa";
import { MdOutlineAccountBalanceWallet } from "react-icons/md";
import { MdOutlineAddAlert } from "react-icons/md";
import logo from "@/../public/logo.png";
import Image from "next/image";
import { ReceiptIcon, Building2, CalendarClock, Calendar, Sun, TrendingUp } from "lucide-react";

const Navbar = () => {
  type selectedType =
    | "Dashboard"
    | "Transactions"
    | "Receipts"
    | "Budgets"
    | "Accounts"
    | "Subscriptions"
    | "Calendar"
    | "Today"
    | "Investments"
    | "Notifications";

  type Icon = {
    icon: ReactElement;
    label: selectedType;
    href: string;
  };

  const pathname = usePathname();

  const pages: Icon[] = [
    { icon: <MdSpaceDashboard />, label: "Dashboard", href: "/" },
    { icon: <FaRegListAlt />, label: "Transactions", href: "/transactions" },
    { icon: <ReceiptIcon />, label: "Receipts", href: "/receipts" },
    { icon: <MdOutlineAccountBalanceWallet />, label: "Budgets", href: "/budgets" },
    { icon: <CalendarClock size={20} />, label: "Subscriptions", href: "/subscriptions" },
    { icon: <Calendar size={20} />, label: "Calendar", href: "/calendar" },
    { icon: <Sun size={20} />, label: "Today", href: "/today" },
    { icon: <TrendingUp size={20} />, label: "Investments", href: "/investments" },
    { icon: <Building2 size={20} />, label: "Accounts", href: "/finance/accounts" },
    { icon: <MdOutlineAddAlert />, label: "Notifications", href: "/notifications" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <div className="hidden md:flex fixed z-20 top-0 left-0 h-full w-20 items-center justify-start py-4 px-2 flex-col gap-4 bg-[#121212]">
        <div className="flex z-20 flex-col gap-8">
          <div className="w-8 z-20 h-8">
            <Link href="/">
              <Image src={logo} alt="logo" />
            </Link>
          </div>
          <div className="h-full z-20 flex flex-col gap-4">
            {pages.map((page, index) => (
              <Link key={index} href={page.href}>
                <div
                  className={`w-10 h-10 flex items-center justify-center text-xl text-white relative group ${
                    isActive(page.href)
                      ? "border border-[#2b2b2b] bg-[#1c1c1c]"
                      : "hover:border hover:border-[#2b2b2b] hover:bg-[#1c1c1c]"
                  }`}
                >
                  {page.icon}
                  <div className="absolute left-14 h-6 p-2 text-sm text-white flex items-center justify-center border border-[#2b2b2b] bg-[#1c1c1c] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
                    {page.label}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#121212]/95 backdrop-blur px-2 py-2">
        <div className="grid grid-cols-5 gap-1">
          {pages.slice(0, 5).map((page, index) => (
            <Link key={index} href={page.href} className={`flex flex-col items-center justify-center rounded-md py-2 text-[11px] ${isActive(page.href) ? "bg-[#1c1c1c] text-white" : "text-white/65"}`}>
              <div className="text-lg">{page.icon}</div>
              <span className="truncate max-w-full">{page.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
};

export default Navbar;
