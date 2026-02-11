import React from "react";
import { Roboto } from "next/font/google";
import { IoMdLogOut } from "react-icons/io";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModalAI } from "./ModalAI";
import { useAuth } from "@/context/AuthContext";
import { NotificationsPopover } from "@/components/notifications/notifications-popover";

const inter = Roboto({ subsets: ["latin"], weight: "300" });

export default function Header() {
  const { logout } = useAuth();

  return (
    <div
      className={`flex flex-col z-10 gap-4 font-sans w-full bg-[#121212] pt-4 pl-24 pr-12 text-white ${inter.className}`}
    >
      <div className="flex flex-row justify-between gap-4">
        <ModalAI />
        <div className="flex flex-row gap-4 items-center">
          <NotificationsPopover />
          
          <div
            className="border border-white/15 text-xl rounded-none p-1 flex items-center justify-center w-8 h-8 cursor-pointer hover:bg-white/10 transition-colors"
            onClick={logout}
            title="Logout"
          >
            <IoMdLogOut />
          </div>

          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
        </div>
      </div>
      <div className="w-full px-4 h-[1px] bg-white/15"></div>
    </div>
  );
}
