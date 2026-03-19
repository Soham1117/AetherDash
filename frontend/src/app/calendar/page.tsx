"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { format, isSameDay, startOfMonth, endOfMonth, isAfter, isBefore, startOfDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, Calendar as CalendarIcon, AlertTriangle } from "lucide-react";
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
        setEvents(Array.isArray(data) ? data : []);
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

  const selectedEvents = date ? events.filter((e) => isSameDay(new Date(e.date), date)) : [];

  const monthStats = useMemo(() => {
    const now = startOfDay(new Date());
    const totalDue = events.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const overdueCount = events.filter((e) => e.status === "overdue" || isBefore(new Date(e.date), now)).length;
    const upcomingCount = events.filter(
      (e) => isAfter(new Date(e.date), now) || isSameDay(new Date(e.date), now)
    ).length;

    return { totalDue, overdueCount, upcomingCount };
  }, [events]);

  return (
    <div className="min-h-[81vh] w-full bg-[#121212] text-white font-sans pt-3 sm:pt-4 mb-20 px-3 sm:px-6 lg:pl-24 lg:pr-12 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Bill Calendar</h1>
        <p className="text-white/60">Visualize upcoming payments and review due amounts by day.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-[#1c1c1c] border-white/10">
          <CardContent className="p-4">
            <p className="text-xs text-white/50 uppercase tracking-wide">Month Total Due</p>
            <p className="text-2xl font-semibold mt-2">${monthStats.totalDue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1c1c1c] border-white/10">
          <CardContent className="p-4">
            <p className="text-xs text-white/50 uppercase tracking-wide">Upcoming Payments</p>
            <p className="text-2xl font-semibold mt-2">{monthStats.upcomingCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1c1c1c] border-white/10">
          <CardContent className="p-4">
            <p className="text-xs text-white/50 uppercase tracking-wide">Overdue / Passed</p>
            <p className="text-2xl font-semibold mt-2 text-red-400">{monthStats.overdueCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card className="xl:col-span-8 bg-[#1c1c1c] border-white/10 rounded-xl">
          <CardContent className="p-3 sm:p-5">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              className="w-full h-full min-h-[380px]"
              classNames={{
                month: "w-full",
                caption: "flex justify-center pt-1 relative items-center mb-4",
                caption_label: "text-base sm:text-lg font-semibold text-white",
                nav: "space-x-1 flex items-center",
                nav_button:
                  "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-white hover:bg-white/10 rounded-md transition-colors",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse border border-white/10 rounded-md overflow-hidden",
                head_row: "flex w-full",
                head_cell:
                  "text-white/40 font-medium text-[10px] sm:text-xs py-2 w-[14.28%] border-b border-r border-white/10 uppercase tracking-widest text-center",
                row: "flex w-full mt-0",
                cell:
                  "relative p-0 text-center text-sm w-[14.28%] border-b border-r border-white/10 h-24 sm:h-28 md:h-32 focus-within:relative focus-within:z-20",
                day: "h-full w-full p-0 hover:bg-white/5 transition-colors text-left align-top",
                day_selected: "bg-white/10",
                day_today: "bg-white/5",
                day_outside: "text-muted-foreground opacity-30 bg-[#151515]",
                day_disabled: "text-muted-foreground opacity-50",
                day_hidden: "invisible",
              }}
              components={{
                DayContent: (props) => {
                  const { date } = props;
                  const dayEvents = events.filter((e) => isSameDay(new Date(e.date), date));
                  const total = dayEvents.reduce((sum, e) => sum + Number(e.amount || 0), 0);
                  const hasOverdue = dayEvents.some((e) => e.status === "overdue");
                  const isToday = isSameDay(date, new Date());
                  const isPast = isBefore(date, startOfDay(new Date())) && !isToday;

                  return (
                    <div className="flex flex-col items-start justify-start h-full w-full p-1.5 sm:p-2">
                      <span
                        className={cn(
                          "text-[11px] sm:text-xs font-semibold h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center rounded-full mb-1",
                          isToday ? "bg-blue-600 text-white" : "text-white/80",
                          !isToday && isPast && "text-white/30"
                        )}
                      >
                        {format(date, "d")}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="w-full space-y-1">
                          <div
                            className={cn(
                              "text-[9px] sm:text-[10px] font-bold px-1.5 py-1 rounded w-full truncate text-left",
                              hasOverdue
                                ? "bg-red-500/20 text-red-400 border border-red-500/20"
                                : "bg-blue-500/20 text-blue-300 border border-blue-500/20"
                            )}
                          >
                            ${Math.round(total)}
                          </div>
                          {dayEvents.length > 1 && (
                            <div className="text-[9px] text-white/40 pl-1">+{dayEvents.length - 1} more</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                },
              }}
            />
          </CardContent>
        </Card>

        <Card className="xl:col-span-4 bg-[#1c1c1c] border-white/10 h-fit xl:sticky xl:top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-white/60" />
              {date ? format(date, "EEEE, MMM d") : "Select a date"}
            </CardTitle>
            {date && (
              <p className="text-sm text-white/50">
                {selectedEvents.length} payment{selectedEvents.length !== 1 && "s"} due
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                </div>
              ) : selectedEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-[#151515] border border-white/10 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 shrink-0">
                          <DollarSign className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate">{event.title}</div>
                          <div className="text-xs text-white/50 capitalize">{event.type}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <div className="font-semibold text-white">${Number(event.amount).toFixed(2)}</div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 h-5 border-white/20 text-white/70 capitalize",
                            event.status === "overdue" && "text-red-400 border-red-500/30"
                          )}
                        >
                          {event.status === "overdue" && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {event.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-white/40 text-sm">No payments due on this date.</div>
              )}

              {date && (
                <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center text-sm">
                  <span className="text-white/60">Total Due</span>
                  <span className="text-xl font-semibold text-white">
                    ${selectedEvents.reduce((sum, e) => sum + Number(e.amount || 0), 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
