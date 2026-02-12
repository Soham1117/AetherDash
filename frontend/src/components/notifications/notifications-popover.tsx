"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { IoIosNotificationsOutline } from "react-icons/io";
import { AlertTriangle, Check, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Notification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export function NotificationsPopover() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { tokens } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchNotifications = async () => {
    if (!tokens?.access) return;
    try {
      const res = await fetch(`${API_URL}/alerts/notifications/`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setNotifications(data.slice(0, 5)); // Show only latest 5
        setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Optional: Poll every 60s
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [tokens]);

  const handleMarkRead = async () => {
    if (!tokens?.access) return;
    try {
      await fetch(`${API_URL}/alerts/notifications/mark_all_read/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative border border-white/15 text-xl rounded-none p-1 flex items-center justify-center w-8 h-8 cursor-pointer hover:bg-white/10">
          <IoIosNotificationsOutline />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-none bg-red-500 text-[10px] text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-[#121212] border-white/15 text-white" align="end">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkRead} className="h-auto p-0 text-xs text-blue-400 hover:text-blue-300">
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-white/50 text-sm">
              No notifications
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`border-b border-white/5 p-4 transition-colors hover:bg-white/5 ${!notif.is_read ? 'bg-white/[0.02]' : ''}`}
              >
                <div className="flex gap-3">
                  <div className={`mt-0.5 ${!notif.is_read ? 'text-yellow-500' : 'text-white/20'}`}>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className={`text-sm ${!notif.is_read ? 'font-medium text-white' : 'text-white/60'}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-white/50 leading-relaxed">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-white/30">
                      <Clock className="h-3 w-3" />
                      {new Date(notif.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-white/10 p-2">
          <Button 
            variant="ghost" 
            className="w-full justify-center text-xs text-white/50 hover:text-white"
            onClick={() => {
                setOpen(false);
                router.push("/notifications");
            }}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
