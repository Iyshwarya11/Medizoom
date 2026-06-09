"use client";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Search, RefreshCw, AlertCircle, CheckCircle2, Activity, UserPlus, FileText, Star, Clock } from "lucide-react";
import { StatusBadge, ChannelBadge, ServiceTypeBadge } from "../../components/badges";
import { normalizeStatus, cn } from "../../lib/utils";
import { api } from "../../lib/api";

function formatSubService(sub?: string | null) {
  if (!sub) return null;
  return sub.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_ORDER: Record<string, number> = {
  pending: 0,           
  awaiting_dispatch: 0, 
  follow_up: 1, 
  assigned: 2, 
  in_progress: 3, 
  completed: 4, 
  cancelled: 5,
};

// 🚀 THE FIX: A bulletproof parser that guarantees chronological sorting
function parseRequestedTime(slotStr: string | null | undefined) {
  if (!slotStr) return Infinity;
  
  try {
    const cleaned = slotStr.toLowerCase();
    let targetDateStr = "";

    // 1. Identify the Date
    if (cleaned.includes('tomorrow')) {
       const tmrw = new Date();
       tmrw.setDate(tmrw.getDate() + 1);
       targetDateStr = tmrw.toISOString().split('T')[0]; // Gets YYYY-MM-DD
    } else if (cleaned.includes('today')) {
       const today = new Date();
       targetDateStr = today.toISOString().split('T')[0];
    } else {
       // Look for explicit YYYY-MM-DD pattern
       const dateMatch = cleaned.match(/(\d{4}-\d{2}-\d{2})/);
       if (dateMatch) targetDateStr = dateMatch[1];
    }

    // 2. Identify the Time & convert to 24hr format
    const timeMatch = cleaned.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i);
    let hours = 0;
    let minutes = 0;

    if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        const ampm = timeMatch[3];

        if (ampm === 'pm' && hours < 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;
    }

    if (targetDateStr) {
        // Construct a safe ISO string (YYYY-MM-DDTHH:MM:00) that NEVER fails
        const h = hours.toString().padStart(2, '0');
        const m = minutes.toString().padStart(2, '0');
        const safeIsoString = `${targetDateStr}T${h}:${m}:00`;
        const finalTime = new Date(safeIsoString).getTime();
        return isNaN(finalTime) ? Infinity : finalTime;
    }

    return Infinity;
  } catch (e) {
    return Infinity;
  }
}

export default function Requests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(""); 
  const [search, setSearch] = useState("");

  const loadData = async (manual = false) => {
    if (manual) setIsRefetching(true);
    const data = await api.getRequests();
    if (Array.isArray(data)) {
      setRequests(data);
    }
    setIsLoading(false);
    setIsRefetching(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 15000);
    return () => clearInterval(interval);
  }, []);

  async function quickComplete(e: React.MouseEvent, requestId: string) {
    e.stopPropagation();
    if (!window.confirm("Mark mission as completed and generate final receipt?")) return;
    
    setRequests(prev => prev.map(r => r.request_id === requestId ? { ...r, status: "Completed" } : r));
    await api.updateRequest(requestId, { status: "Completed" });
    loadData(true); 
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    
    return requests.filter((r) => {
      const matchesSearch = !q || 
        r.patients?.name?.toLowerCase().includes(q) ||
        r.patients?.phone_number?.includes(q) ||
        r.request_id?.toLowerCase().includes(q) ||
        r.patients?.full_address?.toLowerCase().includes(q);
        
      const normStatus = normalizeStatus(r.status);
      const matchesStatus = statusFilter === "all" || normStatus === statusFilter;
      const matchesService = serviceFilter === "all" || r.service_type?.toLowerCase() === serviceFilter;
      const matchesDate = !dateFilter || (r.requested_time_slot && r.requested_time_slot.includes(dateFilter));

      return matchesSearch && matchesStatus && matchesService && matchesDate;
    }).sort((a, b) => {
      const normA = normalizeStatus(a.status);
      const normB = normalizeStatus(b.status);
      
      // 1. Sort by Status Priority (Urgent > Assigned > Completed)
      if ((STATUS_ORDER[normA] ?? 9) !== (STATUS_ORDER[normB] ?? 9)) {
        return (STATUS_ORDER[normA] ?? 9) - (STATUS_ORDER[normB] ?? 9);
      }
      
      // 2. Chronological Sorting (This will now work flawlessly)
      const timeA = parseRequestedTime(a.requested_time_slot);
      const timeB = parseRequestedTime(b.requested_time_slot);

      if (timeA !== timeB) {
        if (normA === 'completed' || normA === 'cancelled') {
           return timeB - timeA; // Newest completed at the top
        }
        return timeA - timeB; // Soonest upcoming at the top
      }
      
      // 3. Fallback
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [requests, search, statusFilter, serviceFilter, dateFilter]);

  return (
    <div className="space-y-6 h-full flex flex-col font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Health Dispatch</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium italic">Monitoring {requests.length} active clinical threads</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => loadData(true)} 
            disabled={isRefetching} 
            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin text-blue-500" : "text-slate-400"}`} />
            Sync Dashboard
          </button>
          <Link
            href="/new"
            className="inline-flex items-center justify-center rounded-xl text-sm font-black transition-all bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 h-10 px-6 active:scale-95"
          >
            <UserPlus className="w-4 h-4 mr-2" /> New Intake
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm shrink-0 overflow-hidden">
        <div className="p-4 flex flex-wrap gap-4 items-end bg-slate-50/50">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search case, patient name, or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all font-medium"
            />
          </div>
          
          <div className="min-w-[150px]">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Schedule Date</label>
            <div className="relative">
              <input 
                type="date" 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none cursor-pointer text-slate-700 focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="min-w-[150px]">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Mission Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none cursor-pointer text-slate-700">
              <option value="all">Full Log</option>
              <option value="pending">🚨 Awaiting Dispatch</option>
              <option value="assigned">✅ Assigned</option>
              <option value="in_progress">🚑 In Progress</option>
              <option value="completed">🏁 Completed</option>
            </select>
          </div>

          <div className="min-w-[150px]">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Service Branch</label>
            <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none cursor-pointer text-slate-700">
              <option value="all">All Specialties</option>
              <option value="nurse">Nursing</option>
              <option value="physiotherapy">Physiotherapy</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white flex-1 flex flex-col overflow-hidden border border-slate-200 rounded-3xl shadow-sm mb-6">
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm text-left border-separate border-spacing-0">
            <thead className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/80 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 border-b border-slate-200">Mission ID</th>
                <th className="px-6 py-4 border-b border-slate-200">Patient Intelligence</th>
                <th className="px-6 py-4 border-b border-slate-200">Clinical Data</th>
                <th className="px-6 py-4 border-b border-slate-200">Status</th>
                <th className="px-6 py-4 border-b border-slate-200 text-center">Billing</th>
                <th className="px-6 py-4 border-b border-slate-200 text-center">Feedback</th>
                <th className="px-6 py-4 border-b border-slate-200 hidden lg:table-cell">Clinician</th>
                <th className="px-6 py-4 border-b border-slate-200 text-right">Rapid Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={8} className="p-24 text-center text-slate-400 font-bold animate-pulse">Establishing secure link to Medi-Zoom core...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-24 text-center text-slate-400 font-medium">No matching medical records found.</td></tr>
              ) : (
                filtered.map((request) => {
                  const normStatus = normalizeStatus(request.status);
                  const isCompleted = normStatus === "completed";
                  const isUrgent = normStatus === 'pending' || normStatus === 'awaiting_dispatch';
                  const isActive = ["assigned", "in_progress", "follow_up"].includes(normStatus);
                  
                  return (
                    <tr
                      key={request.request_id}
                      className={cn(
                        "transition-all cursor-pointer group hover:bg-slate-50/80",
                        isUrgent ? "bg-red-50/30" : ""
                      )}
                      onClick={() => (window.location.href = `/requests/${request.request_id}`)}
                    >
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          <span className="font-black text-emerald-700 text-base">{request.request_id}</span>
                          <ChannelBadge channel={request.source_channel || "phone"} />
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="font-black text-slate-900 leading-tight uppercase tracking-tight">{request.patients?.name || "Unknown"}</div>
                        <div className="text-[11px] text-slate-500 font-bold mt-1 flex items-center gap-1.5">
                           <Clock className="w-3 h-3"/> {request.requested_time_slot}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <ServiceTypeBadge type={request.service_type} />
                        <div className="text-[11px] text-slate-600 mt-1.5 font-bold uppercase tracking-tighter bg-slate-100 inline-block px-1.5 py-0.5 rounded">
                           {formatSubService(request.specific_procedure)}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col items-start gap-1.5">
                          <StatusBadge status={request.status} />
                          {isUrgent && (
                            <span className="animate-pulse flex items-center gap-1 text-[9px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                               <AlertCircle className="w-2.5 h-2.5"/> URGENT DISPATCH
                            </span>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-6 py-5 text-center">
                        {request.total_amount > 0 ? (
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="font-black text-slate-900 text-sm">₹{request.total_amount}</span>
                            {request.receipt_pdf_url && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); window.open(request.receipt_pdf_url); }}
                                className="flex items-center gap-1 text-[9px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100"
                              >
                                <FileText className="w-2.5 h-2.5" /> RECEIPT
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-bold text-[10px]">UNBILLED</span>
                        )}
                      </td>

                      <td className="px-6 py-5 text-center">
                        {request.rating ? (
                          <div className="inline-flex items-center justify-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-full text-amber-600">
                            <Star className="w-3 h-3 fill-current" />
                            <span className="font-black text-xs">{request.rating}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="px-6 py-5 hidden lg:table-cell">
                        {request.providers?.name ? (
                          <div className="flex items-center gap-2.5">
                             <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-[12px] font-black text-slate-500 shadow-sm border border-slate-200">
                               {request.providers.name.charAt(0)}
                             </div>
                             <span className="font-bold text-slate-800 text-xs">{request.providers.name}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] bg-slate-50 px-2 py-1 rounded-lg border border-dashed border-slate-200">
                             <Activity className="w-3 h-3"/> STANDBY
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-5 text-right">
                        {isActive || isUrgent ? (
                          <button
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-black rounded-xl border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-600 hover:text-white transition-all active:scale-95 shadow-sm uppercase tracking-wider"
                            onClick={(e) => quickComplete(e, request.request_id)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Close Case
                          </button>
                        ) : isCompleted ? (
                          <div className="flex items-center justify-end gap-1.5 text-emerald-500 font-black text-[10px] uppercase">
                            <CheckCircle2 className="w-4 h-4" /> Archivd
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Dashboard Footer Analytics */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 flex justify-between items-center shrink-0">
          <div className="flex gap-8">
            <span className="flex items-center gap-2">Visible Cases: <span className="text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">{filtered.length}</span></span>
            <span className="flex items-center gap-2">Awaiting Action: <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 shadow-sm">{requests.filter(r => normalizeStatus(r.status) === 'pending').length}</span></span>
            <span className="flex items-center gap-2">Net Shift Revenue: <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shadow-sm">₹{filtered.reduce((acc, r) => acc + (Number(r.total_amount) || 0), 0)}</span></span>
          </div>
          <div className="hidden sm:flex items-center gap-2 opacity-60">
            <Activity className="w-3 h-3 text-emerald-500 animate-pulse"/>
            MEDIZOOM OPS LIVE
          </div>
        </div>
      </div>
    </div>
  );
}