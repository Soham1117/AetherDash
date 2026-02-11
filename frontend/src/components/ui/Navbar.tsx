"use client";
import { ReactElement, useState } from "react";
import Link from "next/link";
import { MdSpaceDashboard } from "react-icons/md";
import { FaRegListAlt } from "react-icons/fa";
import { MdOutlineAccountBalanceWallet } from "react-icons/md";
import { MdOutlineAddAlert } from "react-icons/md";
import logo from "@/../public/logo.png";
import Image from "next/image";
// import { CiSettings } from "react-icons/ci";
import { ReceiptIcon, Building2, CalendarClock, Calendar } from "lucide-react";

const Navbar = () => {
  type selectedType =
    | "Home"
    | "Dashboard"
    | "Transactions"
    | "Receipts"
    | "Budgets"
    | "Accounts"
    | "Subscriptions"
    | "Calendar"
    | "Notifications";
  // | "Settings";
  const [selected, setSelected] = useState<selectedType>("Home");

  type Icon = {
    icon: ReactElement;
    label: selectedType;
    href: string;
  };

  const pages: Icon[] = [
    { icon: <MdSpaceDashboard />, label: "Dashboard", href: "/" },
    { icon: <FaRegListAlt />, label: "Transactions", href: "/transactions" },
    {
      icon: <ReceiptIcon />,
      label: "Receipts",
      href: "/receipts",
    },
    {
      icon: <MdOutlineAccountBalanceWallet />,
      label: "Budgets",
      href: "/budgets",
    },
    {
      icon: <CalendarClock size={20} />,
      label: "Subscriptions",
      href: "/subscriptions",
    },
    {
      icon: <Calendar size={20} />,
      label: "Calendar",
      href: "/calendar",
    },
    {
      icon: <Building2 size={20} />,
      label: "Accounts",
      href: "/finance/accounts",
    },
    { icon: <MdOutlineAddAlert />, label: "Notifications", href: "/notifications" },
    // { icon: <CiSettings />, label: "Settings", href: "/settings" },
  ];

  const handleClick = (label: selectedType) => {
    setSelected(label);
  };

  return (
    <div className="fixed z-20 top-0 left-0 h-full w-20 flex items-center justify-start py-4 px-2 flex-col gap-4 bg-[#121212]">
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
                  selected === page.label
                    ? "border border-[#2b2b2b] bg-[#1c1c1c]"
                    : "hover:border hover:border-[#2b2b2b] hover:bg-[#1c1c1c]"
                }`}
                onClick={() => handleClick(page.label)}
              >
                {page.icon}
                <div
                  className="absolute left-14 h-6 p-2 text-sm text-white flex items-center justify-center border 
                border-[#2b2b2b]  bg-[#1c1c1c] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                >
                  {page.label}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
