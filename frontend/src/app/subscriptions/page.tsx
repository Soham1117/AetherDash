"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { 
  Loader2, 
  RefreshCw, 
  CalendarDays, 
  DollarSign, 
  AlertCircle,
  CheckCircle2,
  Ban,
  Trash2,
  Edit2,
  TrendingUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";


interface Insight {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'warning' | 'high';
  metric: string;
}

interface Subscription {
  id: number;
  name: string;
  amount: number;
  frequency: string;
  status: 'active' | 'overdue' | 'cancelled' | 'discontinued';
  next_due_date: string;
  merchant_name: string;
  category_name: string;
  days_until_due?: number;
}

export default function SubscriptionsPage() {
  const { tokens } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  
  // Edit State
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const fetchSubscriptions = async () => {
    if (!tokens?.access) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/recurring_transactions/`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Calculate days until due for sorting
        const withDays = data.map((sub: Subscription) => ({
          ...sub,
          days_until_due: sub.next_due_date ? Math.ceil((new Date(sub.next_due_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 999
        }));
        setSubscriptions(withDays);
      }
    } catch (error) {
      console.error("Failed to fetch subscriptions", error);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (!tokens?.access) return;
    try {
      setScanning(true);
      const res = await fetch(`${API_URL}/recurring_transactions/scan/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Maybe show toast with data.new_subscriptions_found
        fetchSubscriptions();
      }
    } catch (error) {
      console.error("Scan failed", error);
    } finally {
      setScanning(false);
    }
  };

  const fetchInsights = async () => {
     if (!tokens?.access) return;
     try {
        const res = await fetch(`${API_URL}/recurring_transactions/insights/`, {
             headers: { Authorization: `Bearer ${tokens.access}` },
        });
        if (res.ok) setInsights(await res.json());
     } catch (e) {
        console.error("Failed to fetch insights", e);
     }
  };

  const handleDelete = async (id: number) => {
    if (!tokens?.access) return;
    try {
        const res = await fetch(`${API_URL}/recurring_transactions/${id}/`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${tokens.access}` },
        });
        if (res.ok) {
            setSubscriptions(prev => prev.filter(s => s.id !== id));
        }
    } catch (error) {
        console.error("Failed to delete subscription", error);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.access || !editingSub) return;
    try {
        const res = await fetch(`${API_URL}/recurring_transactions/${editingSub.id}/`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `Bearer ${tokens.access}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: editingSub.name,
                amount: editingSub.amount,
                frequency: editingSub.frequency,
                status: editingSub.status,
                merchant_name: editingSub.merchant_name
            })
        });
        if (res.ok) {
            const updated = await res.json();
            setSubscriptions(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
            setIsEditOpen(false);
            setEditingSub(null);
        }
    } catch (error) {
        console.error("Failed to update subscription", error);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
    fetchInsights();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  // Statistics
  const activeSubs = subscriptions.filter(s => s.status === 'active' || s.status === 'overdue');
  const monthlyBurn = activeSubs.reduce((sum, sub) => {
    let monthlyAmount = parseFloat(sub.amount.toString());
    if (sub.frequency === 'yearly') monthlyAmount /= 12;
    if (sub.frequency === 'weekly') monthlyAmount *= 4.33;
    return sum + monthlyAmount;
  }, 0);
  
  const yearlyBurn = monthlyBurn * 12;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'overdue': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'discontinued': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'cancelled': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default: return 'bg-white/10 text-white';
    }
  };

  return (
    <div className="p-8 pl-24 space-y-8 bg-[#0a0a0a] min-h-screen font-poppins text-white">
      {/* Edit Sheet */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="bg-[#121212] border-white/10 text-white">
            <SheetHeader>
                <SheetTitle className="text-white">Edit Subscription</SheetTitle>
            </SheetHeader>
            {editingSub && (
                <form onSubmit={handleUpdate} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Name</Label>
                        <Input 
                            value={editingSub.name} 
                            onChange={(e) => setEditingSub({...editingSub, name: e.target.value})}
                            className="bg-[#0a0a0a] border-white/10 text-white"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Merchant Name (Pattern)</Label>
                        <Input 
                            value={editingSub.merchant_name || ''} 
                            onChange={(e) => setEditingSub({...editingSub, merchant_name: e.target.value})}
                            className="bg-[#0a0a0a] border-white/10 text-white"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Amount</Label>
                        <Input 
                            type="number"
                            step="0.01"
                            value={editingSub.amount} 
                            onChange={(e) => setEditingSub({...editingSub, amount: parseFloat(e.target.value)})}
                            className="bg-[#0a0a0a] border-white/10 text-white"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Frequency</Label>
                        <select
                            className="flex h-10 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                            value={editingSub.frequency}
                            onChange={(e) => setEditingSub({...editingSub, frequency: e.target.value})}
                        >
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Status</Label>
                        <select
                            className="flex h-10 w-full rounded-md border border-white/10 bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                            value={editingSub.status}
                            onChange={(e) => setEditingSub({...editingSub, status: e.target.value as any})}
                        >
                            <option value="active">Active</option>
                            <option value="overdue">Overdue</option>
                            <option value="discontinued">Discontinued</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                    <Button type="submit" className="mt-4">
                        Save Changes
                    </Button>
                </form>
            )}
        </SheetContent>
      </Sheet>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-white/60 mt-2">Manage your recurring expenses and monitor fixed costs.</p>
        </div>
        <Button 
          onClick={handleScan} 
          disabled={scanning}
        >
          {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Scan for Subscriptions
        </Button>
      </div>

       {/* Smart Insights */}
      <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="text-xl font-semibold flex items-center gap-2">
             <TrendingUp className="h-5 w-5 text-yellow-500" />
             Smart Insights
          </h2>
          {insights.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.map(insight => (
                      <div key={insight.id} className="bg-yellow-500/5 border border-yellow-500/20 p-4 rounded-xl flex gap-4 items-start hover:bg-yellow-500/10 transition-colors">
                          <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500 shrink-0">
                             <AlertCircle className="h-5 w-5" />
                          </div>
                          <div>
                              <h3 className="font-semibold text-yellow-500">{insight.title}</h3>
                              <p className="text-sm text-white/60 mt-1">{insight.message}</p>
                              <div className="mt-2 text-xs font-mono font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded w-fit">
                                  {insight.metric} vs usual
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          ) : (
            <div className="bg-[#121212] border border-white/10 p-6 rounded-xl flex items-center gap-4 text-white/40">
                <CheckCircle2 className="h-5 w-5 text-green-500/50" />
                <div>
                   <h3 className="font-medium text-white/80">No anomalies detected</h3>
                   <p className="text-sm">Your subscription costs appear stable.</p>
                </div>
            </div>
          )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#121212] border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/60">Monthly Burn Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${monthlyBurn.toFixed(2)}</div>
            <p className="text-xs text-white/40 mt-1">Estimated fixed monthly costs</p>
          </CardContent>
        </Card>
        
        <Card className="bg-[#121212] border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/60">Yearly Projection</CardTitle>
            <CalendarDays className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${yearlyBurn.toFixed(2)}</div>
            <p className="text-xs text-white/40 mt-1">Total annual cost</p>
          </CardContent>
        </Card>

        <Card className="bg-[#121212] border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white/60">Active Subscriptions</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{activeSubs.length}</div>
            <p className="text-xs text-white/40 mt-1">
              {subscriptions.length - activeSubs.length} inactive or cancelled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions List */}
      <div className="grid grid-cols-1 gap-6">
        {loading ? (
           <div className="flex justify-center p-12">
             <Loader2 className="h-8 w-8 animate-spin text-white/20" />
           </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-xl bg-white/5">
            <p className="text-white/40">No subscriptions found.</p>
            <Button variant="link" onClick={handleScan} className="mt-2 text-blue-400">
              Run a scan to find them
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subscriptions.sort((a,b) => {
               // Sort: Active first, then by amount desc
               if (a.status === 'active' && b.status !== 'active') return -1;
               if (a.status !== 'active' && b.status === 'active') return 1;
               return parseFloat(b.amount.toString()) - parseFloat(a.amount.toString());
            }).map((sub) => (
              <Card key={sub.id} className={cn("bg-[#121212] border-white/10 hover:border-white/20 transition-all group", sub.status !== 'active' && "opacity-60")}>
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                   <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center text-lg font-bold text-white/80">
                        {sub.name.charAt(0)}
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {sub.name}
                        </CardTitle>
                        <p className="text-xs text-white/40 capitalize">{sub.frequency} • {sub.category_name || 'Uncategorized'}</p>
                      </div>
                   </div>
                  <div className="text-right flex items-center gap-1">
                      <div className="text-lg font-bold text-white mr-2">${parseFloat(sub.amount.toString()).toFixed(2)}</div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSub(sub);
                          setIsEditOpen(true);
                        }}
                        className="h-8 w-8 text-white/40 hover:text-blue-500 hover:bg-blue-500/10"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if(confirm('Are you sure you want to delete this subscription?')) handleDelete(sub.id);
                        }}
                        className="h-8 w-8 text-white/40 hover:text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                   </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mt-4">
                    <Badge variant="outline" className={cn("capitalize border", getStatusColor(sub.status))}>
                      {sub.status}
                    </Badge>
                    
                    {sub.next_due_date && sub.status === 'active' && (
                       <div className="text-xs text-white/40">
                          Due {format(new Date(sub.next_due_date), "MMM d")}
                       </div>
                    )}
                    {sub.status === 'discontinued' && (
                       <div className="text-xs text-red-500/50 flex items-center gap-1">
                          <Ban className="h-3 w-3" /> Discontinued
                       </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
