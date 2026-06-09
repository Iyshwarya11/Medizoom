"use client";
import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Calendar, MessageSquare } from "lucide-react";
import Link from "next/link";
import { cn } from "../lib/utils";

export function AlertBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Static fallback data until the Python /api/alerts endpoint is built
  useEffect(() => {
    setAlerts([
      { id: 1, type: "pre_appointment", title: "Upcoming Appointment", message: "Patient is scheduled in 1 hour.", isRead: false, createdAt: new Date().toISOString(), requestId: "MZ-F47305" },
      { id: 2, type: "provider_update", title: "Provider Update", message: "Provider has arrived at the location.", isRead: false, createdAt: new Date().toISOString(), requestId: "MZ-BB905F" }
    ]);
  }, []);

  const unreadCount = alerts.filter(a => !a.isRead).length;

  const markAllRead = () => {
    setAlerts(alerts.map(a => ({ ...a, isRead: true })));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2.5 bg-white rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm transition-all hover:shadow-md focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 mt-2 w-96 rounded-3xl border border-slate-200 bg-white/90 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden z-50">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                  {unreadCount} New
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] font-bold text-slate-500 hover:text-emerald-600 uppercase tracking-widest flex items-center gap-1 transition-colors">
                <CheckCheck className="w-3 h-3" /> Mark Read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto p-2">
            {alerts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium">No new notifications.</div>
            ) : (
              alerts.map((alert) => (
                <div key={alert.id} className={cn("p-4 mb-2 rounded-2xl transition-all border", !alert.isRead ? "bg-white border-slate-100 shadow-sm" : "bg-transparent border-transparent hover:bg-slate-50")}>
                  <div className="flex gap-4">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", alert.type === "pre_appointment" ? "bg-amber-50 text-amber-500" : "bg-blue-50 text-blue-500")}>
                      {alert.type === "pre_appointment" ? <Calendar className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <p className={cn("text-sm font-bold", !alert.isRead ? "text-slate-900" : "text-slate-600")}>{alert.title}</p>
                        {!alert.isRead && <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5"></span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{alert.message}</p>
                      {alert.requestId && (
                        <Link href={`/requests/${alert.requestId}`} onClick={() => setOpen(false)} className="inline-block mt-3 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors">
                          View Mission →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}