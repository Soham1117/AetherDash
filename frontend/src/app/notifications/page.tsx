"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDash } from "@/context/DashboardContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Bell,
  Settings,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Check,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

interface Notification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  alert_rule: number;
}

interface AlertConfig {
  id: number;
  alert_type: string;
  threshold_value: number;
  account: number | null;
  account_name: string | null;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [alertConfigs, setAlertConfigs] = useState<AlertConfig[]>([]);
  const { tokens } = useAuth();
  const { accounts } = useDash();
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // New alert form
  const [newAlertType, setNewAlertType] = useState("low_balance");
  const [newThreshold, setNewThreshold] = useState("");
  const [newAccountId, setNewAccountId] = useState("0");

  const fetchData = async () => {
    if (!tokens?.access) return;
    try {
      setLoading(true);
      const [notifsRes, configsRes] = await Promise.all([
        fetch(`${API_URL}/alerts/notifications/`, {
          headers: { Authorization: `Bearer ${tokens.access}` },
        }),
        fetch(`${API_URL}/alerts/`, {
          headers: { Authorization: `Bearer ${tokens.access}` },
        }),
      ]);

      const dataNotifs = await notifsRes.json();
      if (Array.isArray(dataNotifs)) setNotifications(dataNotifs);

      const dataConfigs = await configsRes.json();
      if (Array.isArray(dataConfigs)) setAlertConfigs(dataConfigs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tokens]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  const handleCreateAlert = async () => {
    if (!newThreshold) return;
    try {
      const res = await fetch(`${API_URL}/alerts/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens?.access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alert_type: newAlertType,
          threshold_value: parseFloat(newThreshold),
          account: newAccountId !== "0" ? parseInt(newAccountId) : null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setAlertConfigs([created, ...alertConfigs]);
        setNewThreshold("");
        setNewAccountId("0");
        alert("Alert rule created!");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteConfig = async (id: number) => {
    if (!confirm("Delete this alert rule?")) return;
    try {
      const res = await fetch(`${API_URL}/alerts/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokens?.access}` },
      });
      if (res.ok) {
        setAlertConfigs(alertConfigs.filter((a) => a.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkRead = async () => {
    try {
      const res = await fetch(`${API_URL}/alerts/notifications/mark_all_read/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens?.access}` },
      });
      if (res.ok) {
        setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckNow = async () => {
    try {
      const res = await fetch(`${API_URL}/alerts/check_conditions/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens?.access}` },
      });
      const data = await res.json();
      if (data.notifications_created > 0) {
        alert(`${data.notifications_created} new notifications generated!`);
        fetchData();
      } else {
        alert("Conditions checked. No new alerts triggered.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-[81vh] w-full bg-[#121212] text-white font-sans pt-3 sm:pt-4 mb-20 px-3 sm:px-6 lg:pl-24 lg:pr-12 space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Notifications & Alerts</h1>
          <p className="text-white/60 mt-1">Manage financial monitoring and alerting rules.</p>
        </div>
        <Button onClick={handleCheckNow} className="bg-[#1c1c1c] border border-white/15 text-white hover:bg-[#2b2b2b]">
          Run Checks Now
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-[#1c1c1c] border-white/10">
          <CardContent className="p-4">
            <p className="text-xs text-white/50 uppercase tracking-wide">Unread Alerts</p>
            <p className="text-2xl font-semibold mt-2">{unreadCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1c1c1c] border-white/10">
          <CardContent className="p-4">
            <p className="text-xs text-white/50 uppercase tracking-wide">Total Notifications</p>
            <p className="text-2xl font-semibold mt-2">{notifications.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1c1c1c] border-white/10">
          <CardContent className="p-4">
            <p className="text-xs text-white/50 uppercase tracking-wide">Active Rules</p>
            <p className="text-2xl font-semibold mt-2">{alertConfigs.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="inbox" className="space-y-6">
        <TabsList className="bg-[#1c1c1c] border border-white/10 p-1 h-auto w-full sm:w-fit flex-wrap">
          <TabsTrigger value="inbox" className="data-[state=active]:bg-[#2b2b2b]">
            <Bell className="h-4 w-4 mr-2" />
            Inbox ({unreadCount})
          </TabsTrigger>
          <TabsTrigger value="config" className="data-[state=active]:bg-[#2b2b2b]">
            <Settings className="h-4 w-4 mr-2" />
            Manage Rules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          <div className="flex justify-end mb-2">
            <Button variant="ghost" size="sm" onClick={handleMarkRead} className="text-sm text-white/60 hover:text-white">
              <Check className="h-4 w-4 mr-2" /> Mark all read
            </Button>
          </div>

          {loading ? (
            <div className="bg-[#1c1c1c] rounded-lg p-12 text-center border border-white/10">
              <Loader2 className="h-8 w-8 text-white/40 animate-spin mx-auto mb-3" />
              <p className="text-white/60">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="bg-[#1c1c1c] rounded-lg p-12 text-center border border-white/10">
              <CheckCircle2 className="h-12 w-12 text-green-500/20 mx-auto mb-4" />
              <p className="text-white/50">All clear! No notifications.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`bg-[#1c1c1c] border-l-4 ${notif.is_read ? "border-white/10 opacity-70" : "border-white"} rounded-lg p-4 sm:p-5 flex justify-between items-start gap-3`}
              >
                <div className="flex gap-3 sm:gap-4 items-start min-w-0">
                  <div className={`p-2.5 rounded-md ${notif.is_read ? "bg-white/5" : "bg-white/10"}`}>
                    <AlertTriangle className={`h-5 w-5 ${notif.is_read ? "text-white/40" : "text-white"}`} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold truncate">{notif.title}</h4>
                    <p className="text-sm text-white/80 break-words">{notif.message}</p>
                    <div className="flex items-center gap-2 text-xs text-white/40 mt-2">
                      <Clock className="h-3 w-3" />
                      {new Date(notif.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <div className="bg-[#1c1c1c] border border-white/10 rounded-lg p-5 sm:p-6">
            <h3 className="text-lg font-semibold mb-4">Create New Alert Rule</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label>Alert Type</Label>
                <Select value={newAlertType} onValueChange={setNewAlertType}>
                  <SelectTrigger className="bg-transparent border-white/15">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121212] border-white/15 text-white">
                    <SelectItem value="low_balance">Low Balance</SelectItem>
                    <SelectItem value="large_transaction">Large Transaction</SelectItem>
                    <SelectItem value="budget_exceeded">Budget Exceeded</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Threshold ($)</Label>
                <Input
                  type="number"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  placeholder="e.g. 500"
                  className="bg-transparent border-white/15"
                />
              </div>

              <div className="space-y-2">
                <Label>Account (Optional)</Label>
                <Select value={newAccountId} onValueChange={setNewAccountId}>
                  <SelectTrigger className="bg-transparent border-white/15">
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#121212] border-white/15 text-white">
                    <SelectItem value="0">All Accounts</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id.toString()}>
                        {acc.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleCreateAlert} className="bg-white text-black hover:bg-white/90">
                <Plus className="h-4 w-4 mr-2" /> Add Rule
              </Button>
            </div>
          </div>

          <div className="bg-[#1c1c1c] border border-white/10 rounded-lg overflow-hidden">
            <div className="p-4 bg-white/5 border-b border-white/10">
              <h3 className="font-semibold">Active Rules</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs text-white/40 border-b border-white/10 uppercase">
                    <th className="p-4">Type</th>
                    <th className="p-4">Condition</th>
                    <th className="p-4">Account</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {alertConfigs.map((config) => (
                    <tr key={config.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 capitalize font-medium">{config.alert_type.replace("_", " ")}</td>
                      <td className="p-4">
                        {config.alert_type === "low_balance" ? "<" : ">"} ${config.threshold_value}
                      </td>
                      <td className="p-4 text-white/60">{config.account_name || "Global"}</td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteConfig(config.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
