"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { format, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight, DollarSign, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  amount: number;
  type: string;
  status: string;
}

export default function CalendarPage() {
  const { tokens } = useAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchEvents = async (monthDate: Date) => {
    if (!tokens?.access) return;
    try {
      setLoading(true);
      const start = format(startOfMonth(monthDate), "yyyy-MM-dd");
      const end = format(endOfMonth(monthDate), "yyyy-MM-dd");
      
      const res = await fetch(`${API_URL}/recurring_transactions/calendar_events/?start=${start}&end=${end}`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (error) {
      console.error("Failed to fetch events", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(currentMonth);
  }, [tokens, currentMonth]);

  // Modifiers for the calendar to highlight dates with events
  const eventDays = events.map(e => new Date(e.date));
  
  const handleMonthChange = (newMonth: Date) => {
    setCurrentMonth(newMonth);
    // Don't auto-select date to keep view clean? Or keep it?
  };

  const selectedEvents = date 
    ? events.filter(e => isSameDay(new Date(e.date), date))
    : [];

  // Group events by date for rendering dots?
  // Custom Day render is hard with shadcn Calendar wrapper without fully overriding.
  // We'll use the 'modifiers' prop to style event days.

  return (
    <div className="p-8 pl-24 space-y-8 bg-[#0a0a0a] min-h-screen font-poppins text-white">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bill Calendar</h1>
          <p className="text-white/60 mt-2">Visualize your upcoming payments and cash flow.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calendar Card */}
        <div className="lg:col-span-8 bg-[#121212] border border-white/10 rounded-xl p-6">
                 <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    month={currentMonth}
                    onMonthChange={handleMonthChange}
                    className="w-full h-full min-h-[400px]"
                    classNames={{
                        month: "w-full",
                        caption: "flex justify-center pt-1 relative items-center mb-6",
                        caption_label: "text-xl font-bold text-white",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-white hover:bg-white/10 rounded-md transition-colors",
                        nav_button_previous: "absolute left-2",
                        nav_button_next: "absolute right-2",
                        table: "w-full border-collapse border-t border-l border-white/10",
                        head_row: "flex w-full",
                        head_cell: "text-white/40 font-medium text-xs py-3 w-[14.28%] border-b border-r border-white/10 uppercase tracking-widest text-center",
                        row: "flex w-full mt-0",
                        cell: "relative p-0 text-center text-sm w-[14.28%] border-b border-r border-white/10 h-32 focus-within:relative focus-within:z-20",
                        day: "h-full w-full p-0 hover:bg-white/5 transition-colors text-left align-top",
                        day_selected: "bg-white/10",
                        day_today: "bg-white/5",
                        day_outside: "text-muted-foreground opacity-30 bg-[#0a0a0a]",
                        day_disabled: "text-muted-foreground opacity-50",
                        day_hidden: "invisible",
                    }}
                    components={{
                        DayContent: (props) => {
                            const { date } = props;
                            const dayEvents = events.filter(e => isSameDay(new Date(e.date), date));
                            const total = dayEvents.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0);
                            const hasOverdue = dayEvents.some(e => e.status === 'overdue');
                            const isToday = isSameDay(date, new Date());
                            const isPast = date < new Date() && !isToday;

                            return (
                                <div className="flex flex-col items-start justify-start h-full w-full p-2">
                                    <span className={cn(
                                        "text-xs font-semibold h-6 w-6 flex items-center justify-center rounded-full mb-1", 
                                        isToday ? "bg-blue-600 text-white" : "text-white/80",
                                        !isToday && isPast && "text-white/30"
                                    )}>
                                        {format(date, 'd')}
                                    </span>
                                    {dayEvents.length > 0 && (
                                        <div className="w-full space-y-1">
                                            <div className={cn(
                                                "text-[10px] font-bold px-1.5 py-1 rounded w-full truncate text-left flex items-center overflow-hidden",
                                                hasOverdue ? "bg-red-500/20 text-red-500 border border-red-500/20" : "bg-blue-500/20 text-blue-400 border border-blue-500/20"
                                            )}>
                                                <span className="truncate">${Math.round(total)}</span>
                                            </div>
                                            {dayEvents.length > 1 && (
                                                <div className="text-[9px] text-white/30 pl-1">
                                                    +{dayEvents.length - 1} more
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        }
                    }}
                 />
        </div>

        {/* Side Panel: Selected Date Details */}
        <Card className="lg:col-span-4 bg-[#121212] border-white/10 h-fit">
            <CardHeader>
                <CardTitle className="text-lg">
                    {date ? format(date, 'EEEE, MMM d') : 'Select a date'}
                </CardTitle>
                {date && <p className="text-sm text-white/40">
                    {selectedEvents.length} payment{selectedEvents.length !== 1 && 's'} due
                </p>}
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-white/20"/>
                        </div>
                    ) : selectedEvents.length > 0 ? (
                        <div className="space-y-3">
                            {selectedEvents.map(event => (
                                <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0a] border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                                            <DollarSign className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-white">{event.title}</div>
                                            <div className="text-xs text-white/40 capitalize">{event.type}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-white">${parseFloat(event.amount.toString()).toFixed(2)}</div>
                                        <Badge variant="outline" className={cn("text-[10px] px-1 py-0 h-4 border-white/10 text-white/60 capitalize", event.status === 'overdue' && "text-red-500 border-red-500/20")}>
                                            {event.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-white/20 text-sm">
                            No payments due on this date.
                        </div>
                    )}
                    
                    {date && (
                         <div className="mt-6 pt-6 border-t border-white/10">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-white/60">Total Due</span>
                                <span className="text-xl font-bold text-white">
                                    ${selectedEvents.reduce((sum, e) => sum + parseFloat(e.amount.toString()), 0).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
