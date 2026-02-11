"use client";

import { useEffect, useState } from "react";
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
  Check
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";

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

  // New alert form
  const [newAlertType, setNewAlertType] = useState("low_balance");
  const [newThreshold, setNewThreshold] = useState("");
  const [newAccountId, setNewAccountId] = useState("0");

  const fetchData = async () => {
    if (!tokens?.access) return;
    try {
      // Fetch Notifications
      const resNotifs = await fetch("http://localhost:8000/alerts/notifications/", {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      const dataNotifs = await resNotifs.json();
      if (Array.isArray(dataNotifs)) setNotifications(dataNotifs);

      // Fetch Configs
      const resConfigs = await fetch("http://localhost:8000/alerts/", {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      const dataConfigs = await resConfigs.json();
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

  const handleCreateAlert = async () => {
    if (!newThreshold) return;
    try {
      const res = await fetch("http://localhost:8000/alerts/", {
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
      const res = await fetch(`http://localhost:8000/alerts/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tokens?.access}` },
      });
      if (res.ok) {
        setAlertConfigs(alertConfigs.filter(a => a.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkRead = async () => {
    try {
      const res = await fetch("http://localhost:8000/alerts/notifications/mark_all_read/", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens?.access}` },
      });
      if (res.ok) {
        setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckNow = async () => {
    try {
      const res = await fetch("http://localhost:8000/alerts/check_conditions/", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens?.access}` },
      });
      const data = await res.json();
      if (data.notifications_created > 0) {
        alert(`${data.notifications_created} new notifications generated!`);
        fetchData(); // Refresh list
      } else {
        alert("Conditions checked. No new alerts triggered.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white p-8 pl-24 pt-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Notifications & Alerts</h1>
          <p className="text-white/60 mt-1">
            Manage your automated financial monitors.
          </p>
        </div>
        <Button onClick={handleCheckNow} className="bg-[#1c1c1c] border border-white/15 text-white hover:bg-[#2b2b2b]">
          Run Checks Now
        </Button>
      </div>

      <Tabs defaultValue="inbox" className="space-y-6">
        <TabsList className="bg-[#1c1c1c] border-white/10 p-1">
          <TabsTrigger value="inbox" className="data-[state=active]:bg-[#2b2b2b]">
            <Bell className="h-4 w-4 mr-2" />
            Inbox ({notifications.filter(n => !n.is_read).length})
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
          
          {notifications.length === 0 ? (
            <div className="bg-[#1c1c1c] rounded-none p-12 text-center border border-white/10">
              <CheckCircle2 className="h-12 w-12 text-green-500/20 mx-auto mb-4" />
              <p className="text-white/50">All clear! No notifications.</p>
            </div>
          ) : (
            notifications.map(notif => (
              <div 
                key={notif.id} 
                className={`bg-[#1c1c1c] border-l-4 ${notif.is_read ? 'border-white/10 opacity-60' : 'border-white'} rounded-lg p-5 flex justify-between items-center`}
              >
                <div className="flex gap-4 items-center">
                  <div className={`p-3 rounded-none ${notif.is_read ? 'bg-white/5' : 'bg-white/10'}`}>
                    <AlertTriangle className={`h-5 w-5 ${notif.is_read ? 'text-white/40' : 'text-white'}`} />
                  </div>
                  <div>
                    <h4 className="font-bold">{notif.title}</h4>
                    <p className="text-sm text-white/80">{notif.message}</p>
                    <div className="flex items-center gap-2 text-xs text-white/40 mt-1">
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
          <div className="bg-[#1c1c1c] border border-white/10 rounded-none p-6">
            <h3 className="text-lg font-bold mb-4">Create New Alert Rule</h3>
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
                  onChange={e => setNewThreshold(e.target.value)}
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
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id.toString()}>{acc.account_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleCreateAlert} className="bg-white text-black hover:bg-white/90">
                <Plus className="h-4 w-4 mr-2" /> Add Rule
              </Button>
            </div>
          </div>

          <div className="bg-[#1c1c1c] border border-white/10 rounded-none overflow-hidden">
             <div className="p-4 bg-white/5 border-b border-white/10">
               <h3 className="font-bold">Active Rules</h3>
             </div>
             <table className="w-full">
               <thead>
                 <tr className="text-left text-xs text-white/40 border-b border-white/10 uppercase">
                   <th className="p-4">Type</th>
                   <th className="p-4">Condition</th>
                   <th className="p-4">Account</th>
                   <th className="p-4 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody>
                 {alertConfigs.map(config => (
                   <tr key={config.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                     <td className="p-4 capitalize font-medium">{config.alert_type.replace('_', ' ')}</td>
                     <td className="p-4">
                       {config.alert_type === 'low_balance' ? '<' : '>'} ${config.threshold_value}
                     </td>
                     <td className="p-4 text-white/60">{config.account_name || 'Global'}</td>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
