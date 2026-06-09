"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Activity, Clock, CheckCircle2, AlertCircle, UserCheck, Users, 
  RefreshCw, XCircle, ArrowRight, RotateCcw,
  Zap, Syringe, X, MapPin, Phone, UserPlus, 
  Sun, Moon, Sunrise, Sunset, Navigation, ChevronRight, BarChart3, Fingerprint, Crosshair, CalendarClock
} from "lucide-react";
import { StatusBadge, ServiceTypeBadge } from "@/components/badges";
import { formatTime, formatDateTime } from "@/lib/format";
import { api } from "@/lib/api";
import { cn, normalizeStatus } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

function ServiceIcon({ type, className }: { type: string, className?: string }) {
  if (type?.toLowerCase() === 'nurse') return <Syringe className={cn("w-4 h-4", className)} />;
  return <Crosshair className={cn("w-4 h-4", className)} />;
}

const STATUS_ORDER: Record<string, number> = {
  follow_up: 0, pending: 1, assigned: 2, in_progress: 3, completed: 4, cancelled: 5,
};

const generateActivity = () => Array.from({ length: 12 }).map((_, i) => ({
  time: `${i * 2}:00`,
  activity: Math.floor(Math.random() * 40) + 10
}));

export default function Home() {
  const [summary, setSummary] = useState<any>({ 
    totalRequests: 0, pendingRequests: 0, assignedRequests: 0, inProgressRequests: 0, 
    followUpRequests: 0, completedToday: 0, cancelledToday: 0, 
    totalProviders: 0, availableProviders: 0, busyProviders: 0
  });
  const [requests, setRequests] = useState<any[]>([]);
  const [activityData, setActivityData] = useState(generateActivity());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = currentTime.getHours();
  let greeting = "Good evening";
  let GreetingIcon = Moon;
  if (hours >= 5 && hours < 12) { greeting = "Good morning"; GreetingIcon = Sunrise; }
  else if (hours >= 12 && hours < 17) { greeting = "Good afternoon"; GreetingIcon = Sun; }
  else if (hours >= 17 && hours < 20) { greeting = "Good evening"; GreetingIcon = Sunset; }

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    
    const [reqData, provDataRaw] = await Promise.all([api.getRequests(), api.getProviders()]);
    
    if (Array.isArray(reqData)) {
      let pending = 0, assigned = 0, in_progress = 0, follow_up = 0, completed = 0, cancelled = 0;
      
      reqData.forEach(r => {
        const norm = normalizeStatus(r.status);
        if (norm === 'pending') pending++;
        else if (norm === 'assigned') assigned++;
        else if (norm === 'in_progress') in_progress++;
        else if (norm === 'follow_up') follow_up++;
        else if (norm === 'completed') completed++;
        else if (norm === 'cancelled') cancelled++;
      });

      // EXACT AVAILABILITY CALCULATION
      const providersList = Array.isArray(provDataRaw) ? provDataRaw : (provDataRaw?.providers || []);
      const totalProv = providersList.length || 0;
      
      const busyProviderIds = new Set(
        reqData
          .filter(r => ['assigned', 'in_progress'].includes(normalizeStatus(r.status)))
          .map(r => r.provider_id)
          .filter(id => id != null)
      );
      
      const busyCount = busyProviderIds.size;
      const availableProv = Math.max(0, totalProv - busyCount);

      setSummary({ 
        totalRequests: reqData.length, pendingRequests: pending, assignedRequests: assigned, 
        inProgressRequests: in_progress, followUpRequests: follow_up, completedToday: completed,
        cancelledToday: cancelled, totalProviders: totalProv, availableProviders: availableProv,
        busyProviders: busyCount
      });

      const sorted = [...reqData].sort((a, b) => (STATUS_ORDER[normalizeStatus(a.status)] ?? 9) - (STATUS_ORDER[normalizeStatus(b.status)] ?? 9));
      setRequests(sorted);
      
      if (selectedRequest) {
        const updatedReq = sorted.find(r => r.request_id === selectedRequest.request_id);
        if (updatedReq) setSelectedRequest(updatedReq);
      }
      
      setActivityData(prev => [...prev.slice(1), { time: 'Now', activity: Math.floor(Math.random() * 40) + 15 }]);
    }
    
    setIsLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedRequest(null); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const displayedRequests = requests.filter(req => activeFilter === 'all' || normalizeStatus(req.status) === activeFilter).slice(0, 15);
  const provPct = summary.totalProviders > 0 ? Math.min((summary.availableProviders / summary.totalProviders) * 100, 100) : 0;

  if (isLoading) {
    return (
      <div className="h-[80vh] w-full flex items-center justify-center animate-pulse">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center shadow-2xl shadow-slate-900/20">
            <Fingerprint className="w-8 h-8 text-emerald-400 animate-pulse" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Authenticating Data Stream...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-12 font-sans selection:bg-emerald-500/30">
      
      {/* BENTO HERO SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Welcome Box */}
        <div className="lg:col-span-8 bg-white rounded-[2rem] p-8 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex justify-between items-start relative z-10">
            <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm">
              <GreetingIcon className="w-7 h-7 text-emerald-500" />
            </div>
            <div className="flex items-center gap-3 bg-slate-50/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-100">
              <span className="text-sm font-bold text-slate-500">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              <span className="text-slate-300">•</span>
              <span suppressHydrationWarning className="text-sm font-black text-slate-900 tracking-tight">
                {currentTime.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          
          <div className="mt-12 relative z-10">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              {greeting}.
            </h1>
            <p className="text-slate-500 font-medium mt-2 text-lg">Your network is monitoring {summary.totalRequests} active endpoints.</p>
          </div>
        </div>

        {/* Fleet Readiness Box */}
        <div className="lg:col-span-4 bg-slate-950 rounded-[2rem] p-8 border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col justify-between group">
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-emerald-500/10 to-blue-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
          
          <div className="relative z-10 flex justify-between items-start">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Navigation className="w-4 h-4 text-blue-400"/> Fleet Status</h3>
            <span className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 rounded-lg text-xs font-black text-white">{Math.round(provPct)}% Ready</span>
          </div>

          <div className="relative z-10 mt-10">
            <div className="flex items-end gap-3 mb-4">
              <span className="text-6xl font-black tracking-tighter text-white leading-none">{summary.availableProviders}</span>
              <span className="text-slate-400 font-bold mb-1">/ {summary.totalProviders} Active</span>
            </div>
            
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${provPct}%` }} />
            </div>
            <p className="text-xs font-bold text-slate-500 mt-4 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              {summary.busyProviders} units deployed on missions
            </p>
          </div>
        </div>
      </div>

      {/* ACTION & FILTER RIBBON */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar w-full xl:w-auto pb-2 xl:pb-0">
          <FilterPill label="All Signals" id="all" current={activeFilter} onClick={setActiveFilter} count={summary.totalRequests} />
          <FilterPill label="Action Required" id="pending" current={activeFilter} onClick={setActiveFilter} count={summary.pendingRequests} ping color="orange" />
          <FilterPill label="En Route" id="assigned" current={activeFilter} onClick={setActiveFilter} count={summary.assignedRequests} color="blue" />
          <FilterPill label="On Site" id="in_progress" current={activeFilter} onClick={setActiveFilter} count={summary.inProgressRequests} color="teal" />
          <FilterPill label="Review" id="follow_up" current={activeFilter} onClick={setActiveFilter} count={summary.followUpRequests} color="amber" />
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full xl:w-auto">
          <button onClick={() => loadData(true)} disabled={isRefreshing} className="flex-1 xl:flex-none flex items-center justify-center p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:shadow-md transition-all active:scale-95">
            <RefreshCw className={cn("w-5 h-5", isRefreshing && "animate-spin text-emerald-500")} />
          </button>
          <Link href="/new" className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-8 py-3.5 rounded-2xl text-sm font-black transition-all active:scale-95 shadow-lg shadow-emerald-500/20">
            <Zap className="w-4 h-4" /> Deploy Unit
          </Link>
        </div>
      </div>

      {/* MAIN CONTENT SPLIT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT: Feed (8 Cols) */}
        <div className="xl:col-span-8 flex flex-col gap-4">
          {displayedRequests.length === 0 ? (
            <div className="bg-white rounded-[2rem] border border-slate-200/60 p-16 text-center flex flex-col items-center justify-center shadow-sm h-full min-h-[400px]">
              <div className="w-24 h-24 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-center mb-6 rotate-12 transition-transform hover:rotate-0">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">Zero Pending Signals</h3>
              <p className="text-slate-500 mt-2 font-medium">The grid is clear. All operations are nominal.</p>
            </div>
          ) : (
            displayedRequests.map((request) => {
              const isPending = normalizeStatus(request.status) === "pending";
              
              return (
                <div 
                  key={request.request_id} 
                  onClick={() => setSelectedRequest(request)}
                  className={cn(
                    "bg-white rounded-3xl p-5 border transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center gap-5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative overflow-hidden",
                    selectedRequest?.request_id === request.request_id ? "border-slate-800 shadow-md ring-1 ring-slate-800" : "border-slate-200/60",
                    isPending && !selectedRequest ? "border-orange-200 bg-gradient-to-r from-orange-50/50 to-transparent" : ""
                  )}
                >
                  {isPending && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>}
                  
                  {/* Avatar / Icon */}
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105", isPending ? "bg-orange-100 text-orange-600" : "bg-slate-50 text-slate-600 border border-slate-100")}>
                    <ServiceIcon type={request.service_type} />
                  </div>

                  {/* Core Data */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="font-black text-lg text-slate-900 tracking-tight">{request.patients?.name || "Unknown"}</span>
                      <StatusBadge status={request.status} />
                      {isPending && <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-100 px-2.5 py-1 rounded-lg flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span> Requires Action</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500 font-medium">
                      <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">{request.request_id}</span>
                      <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400"/> {request.patients?.city || "Local Zone"}</span>
                      {request.requested_time_slot && <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400"/> {request.requested_time_slot}</span>}
                    </div>
                  </div>

                  {/* Right Alignment / Assignee */}
                  <div className="shrink-0 flex items-center sm:justify-end border-t sm:border-t-0 pt-4 sm:pt-0 sm:pl-4">
                    {request.provider_id ? (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Unit</span>
                          <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            {request.providers?.name} 
                            <div className="w-6 h-6 bg-slate-900 text-white rounded-md flex items-center justify-center text-[10px]">{request.providers?.name?.charAt(0)}</div>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-700 rounded-xl font-bold text-xs border border-orange-100/50">
                        <UserPlus className="w-4 h-4" /> Unassigned
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT: Telemetry & Mini Bentos (4 Cols) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          
          <div className="grid grid-cols-2 gap-4">
            <BentoMetric title="Total Volume" value={summary.totalRequests} icon={<BarChart3 />} />
            <BentoMetric title="Completed" value={summary.completedToday} icon={<CheckCircle2 />} highlight="emerald" />
          </div>

          <div className="bg-white rounded-[2rem] p-6 border border-slate-200/60 shadow-sm flex flex-col relative overflow-hidden" style={{ minHeight: '340px' }}>
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600"><Activity className="w-5 h-5"/></div>
                <h3 className="font-bold text-slate-900">Network Flow</h3>
              </div>
              <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">Live</span>
            </div>
            
            {/* FIXED RECHARTS WRAPPER */}
            <div className="w-full relative z-10 -ml-4">
              <ResponsiveContainer width="100%" height={220} debounce={50}>
                <AreaChart data={activityData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAct" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <RechartsTooltip 
                    cursor={false}
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#a78bfa' }}
                  />
                  <Area type="monotone" dataKey="activity" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorAct)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* GLASSMORPHIC DRAWER */}
      {selectedRequest && <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity" onClick={() => setSelectedRequest(null)} />}
      
      <div className={cn(
        "fixed inset-y-0 right-0 w-full sm:w-[500px] bg-white/90 backdrop-blur-2xl shadow-2xl z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col border-l border-white/50",
        selectedRequest ? "translate-x-0" : "translate-x-full"
      )}>
        {selectedRequest && (
          <>
            <div className="px-8 py-6 flex items-center justify-between shrink-0 border-b border-slate-200/50">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                  <CalendarClock className="w-3 h-3"/> {formatDateTime(selectedRequest.created_at)}
                </h3>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{selectedRequest.request_id}</h2>
                  <StatusBadge status={selectedRequest.status} />
                </div>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="w-10 h-10 bg-white shadow-sm border border-slate-200 text-slate-400 hover:text-slate-900 rounded-full flex items-center justify-center transition-all active:scale-95"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              
              {/* Profile Bento */}
              <div className="bg-white/80 rounded-3xl p-6 border border-slate-200 shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner">
                    {selectedRequest.patients?.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Patient Details</p>
                    <p className="font-black text-2xl text-slate-900">{selectedRequest.patients?.name || "Unknown"}</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <a href={`tel:${selectedRequest.patients?.phone_number}`} className="flex items-center gap-3 text-sm font-bold text-slate-700 hover:text-emerald-600 transition-colors bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <Phone className="w-4 h-4 text-slate-400"/> {selectedRequest.patients?.phone_number}
                  </a>
                  <p className="flex items-start gap-3 text-sm font-bold text-slate-700 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5"/> {selectedRequest.patients?.full_address || "No address provided"}
                  </p>
                </div>
              </div>

              {/* Mission Details Bento */}
              <div className="bg-white/80 rounded-3xl p-6 border border-slate-200 shadow-sm backdrop-blur-md">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Mission Parameters</h4>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <ServiceTypeBadge type={selectedRequest.service_type} />
                  {selectedRequest.specific_procedure && <span className="text-sm font-bold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg">{selectedRequest.specific_procedure.replace(/_/g, " ")}</span>}
                </div>
                {selectedRequest.notes && (
                  <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/50 text-sm font-semibold text-amber-900 leading-relaxed">
                    "{selectedRequest.notes}"
                  </div>
                )}
              </div>

              {/* Assignment Bento */}
              <div className="bg-white/80 rounded-3xl p-6 border border-slate-200 shadow-sm backdrop-blur-md">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Field Unit</h4>
                {selectedRequest.provider_id ? (
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-xl font-black shadow-md">{selectedRequest.providers?.name?.charAt(0) || "P"}</div>
                    <div>
                      <p className="font-black text-slate-900 text-xl">{selectedRequest.providers?.name}</p>
                      <p className="text-sm font-bold text-slate-500 mt-0.5 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5"/> {selectedRequest.providers?.phone_number}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-orange-50/50 rounded-2xl text-center border border-orange-100 border-dashed">
                    <AlertCircle className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                    <p className="text-sm font-black text-orange-900">Requires Assignment</p>
                    <p className="text-xs text-orange-600/80 font-medium mt-1">Pending dispatch protocol.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-white/90 backdrop-blur-md border-t border-slate-200/50 shrink-0">
              <Link href={`/requests/${selectedRequest.request_id}`} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-slate-900/10">
                Execute Mission Control <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilterPill({ label, id, current, onClick, count, ping, color }: any) {
  const active = current === id;
  const colorMap: any = {
    orange: "text-orange-700 bg-orange-50 border-orange-200",
    blue: "text-blue-700 bg-blue-50 border-blue-200",
    teal: "text-teal-700 bg-teal-50 border-teal-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
  };

  return (
    <button
      onClick={() => onClick(id)}
      className={cn(
        "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-black transition-all shrink-0 border",
        active ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      {ping && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span></span>}
      {label}
      <span className={cn("ml-1.5 px-2 py-0.5 rounded-lg text-[10px] font-black border", active ? "bg-white/20 text-white border-transparent" : colorMap[color] || "bg-slate-100 text-slate-600 border-slate-200")}>
        {count}
      </span>
    </button>
  );
}

function BentoMetric({ title, value, icon, highlight }: any) {
  return (
    <div className="bg-white rounded-[2rem] p-6 border border-slate-200/60 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group">
      <div className="flex items-center justify-between mb-6">
        <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110", highlight === 'emerald' ? "bg-emerald-50 text-emerald-500" : "bg-slate-50 text-slate-500")}>
          {icon}
        </div>
      </div>
      <div>
        <div className={cn("text-4xl font-black tracking-tighter leading-none mb-2", highlight === 'emerald' ? "text-emerald-500" : "text-slate-900")}>
          {value}
        </div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h3>
      </div>
    </div>
  );
}