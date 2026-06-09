"use client";
import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";
import {
  ArrowLeft, MapPin, Phone, User, Clock, CheckCircle2,
  AlertCircle, Activity, Save, Edit2, Timer, UserCheck,
  Zap, Navigation2, FileText, Stethoscope, CalendarClock, Camera,
  Star, DownloadCloud, IndianRupee
} from "lucide-react";
import { StatusBadge, ChannelBadge, ServiceTypeBadge } from "../../../components/badges";
import { formatDateTime } from "../../../lib/format";
import { cn, normalizeStatus } from "../../../lib/utils";

function formatSubService(sub?: string | null) {
  if (!sub) return null;
  return sub.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- GPS DISTANCE CALCULATOR (Haversine Formula) ---
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; 
}

export default function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const requestId = unwrappedParams.id;
  
  const [request, setRequest] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [activeRequests, setActiveRequests] = useState<any[]>([]); // NEW: Track all active requests for conflict check
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);

  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [providerId, setProviderId] = useState<string>("");
  const [eta, setEta] = useState("");
  const [isEditingEta, setIsEditingEta] = useState(false);

  const loadData = async () => {
    // 🚀 PRODUCTION FIX: Load both specific request and global requests to check for conflicts
    const [data, provData, allReqs] = await Promise.all([
        api.getRequestById(requestId),
        api.getProviders(),
        api.getRequests()
    ]);

    if (data) {
      setRequest(data);
      if (!isEditingNotes) setNotes(data.notes || "");
      if (!isEditingEta) setEta(data.estimated_arrival || "");
      if (data.provider_id && !providerId) setProviderId(data.provider_id.toString());
    }

    if (provData && provData.providers) setProviders(provData.providers);
    if (Array.isArray(allReqs)) setActiveRequests(allReqs);
    
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 15000);
    return () => clearInterval(interval);
  }, [requestId]);

  const handleUpdateStatus = async (newStatus: string) => {
    await api.updateRequest(requestId, { status: newStatus });
    loadData();
  };

  const confirmCancel = () => {
    if (window.confirm("Are you sure you want to cancel this request?")) {
      handleUpdateStatus("Cancelled");
    }
  };

  const confirmClose = () => {
    if (window.confirm("Are you sure you want to close this case? This will generate the final bill.")) {
      handleUpdateStatus("Completed");
    }
  };

  // --- TRUE GPS AUTO-ASSIGN LOGIC ---
  const handleAutoAssign = async () => {
    const pLat = parseFloat(request.patients?.latitude);
    const pLon = parseFloat(request.patients?.longitude);
    const pAddress = (request.patients?.full_address || "").toLowerCase();

    if (!pLat || !pLon) {
      alert("Patient coordinates missing! Assign manually.");
      return;
    }

    setIsAssigning(true);

    // Filter clinicians who are NOT currently at a house (In Progress)
    const eligibleProviders = providers.filter(p => {
        const matchesService = p.service_type?.toLowerCase() === request.service_type?.toLowerCase();
        const isCurrentlyAtWork = activeRequests.some(r => 
            r.provider_id === p.provider_id && normalizeStatus(r.status) === 'in_progress'
        );
        return matchesService && !isCurrentlyAtWork && p.status !== 'Offline';
    });

    const mappedProviders = eligibleProviders.map(p => {
      let isZoneMatch = false;
      if (Array.isArray(p.service_zone)) {
        isZoneMatch = p.service_zone.some((z: string) => pAddress.includes(z.toLowerCase()));
      }
      const dist = getDistanceFromLatLonInKm(pLat, pLon, parseFloat(p.latitude), parseFloat(p.longitude));
      return { ...p, distance: dist, isZoneMatch };
    });

    const withinRadiusProviders = mappedProviders.filter(p => {
      const radius = p.service_radius ? parseInt(p.service_radius) : 15;
      return p.isZoneMatch || p.distance <= radius;
    });

    if (withinRadiusProviders.length === 0) {
      alert("No clinicians available within range. Try manual assignment.");
      setIsAssigning(false);
      return;
    }

    const closestProvider = withinRadiusProviders.sort((a, b) => {
        if (a.isZoneMatch && !b.isZoneMatch) return -1;
        if (!a.isZoneMatch && b.isZoneMatch) return 1;
        return a.distance - b.distance;
    })[0];

    const targetId = closestProvider.provider_id || closestProvider.id;
    const res = await api.updateRequest(requestId, { provider_id: targetId, status: "Assigned" });
    
    if (res) {
      alert(`Success! Auto-assigned ${closestProvider.name}. Dispatching WhatsApp alert...`);
      setProviderId(targetId.toString());
      loadData();
    }
    setIsAssigning(false);
  };

  const handleAssignProvider = async () => {
    if (!providerId) return;
    const updates: any = { provider_id: providerId, status: "Assigned" };
    if (eta) updates.estimated_arrival = eta;

    const res = await api.updateRequest(requestId, updates);
    if (res) {
      alert(`Manual assignment confirmed.`);
      loadData();
    }
  };

  const handleSaveNotes = async () => {
    await api.updateRequest(requestId, { notes });
    setIsEditingNotes(false);
    loadData();
  };

  const handleSaveEta = async () => {
    await api.updateRequest(requestId, { estimated_arrival: eta });
    setIsEditingEta(false);
    loadData();
  };

  const generateMockHistory = () => {
    if (!request) return [];
    const norm = normalizeStatus(request.status);
    const events = [{ type: 'created' }];
    if (['assigned', 'in_progress', 'completed', 'follow_up'].includes(norm)) events.push({ type: 'assigned' });
    if (['in_progress', 'completed', 'follow_up'].includes(norm)) events.push({ type: 'in_progress' });
    if (norm === 'completed') events.push({ type: 'completed' });
    if (norm === 'cancelled') events.push({ type: 'cancelled' });
    return events;
  };

  if (isLoading) return <div className="p-12 text-center text-slate-400 font-bold">Loading case details...</div>;
  if (!request) return <div className="p-12 text-center text-slate-500">Request not found.</div>;

  const normStatus = normalizeStatus(request.status);
  const isClosed = normStatus === "completed" || normStatus === "cancelled";
  const canReassign = ["pending", "awaiting_dispatch", "assigned"].includes(normStatus);
  
  const currentProvider = providers.find((p) => (p.provider_id || p.id)?.toString() === request.provider_id?.toString());
  
  // 🚀 PRODUCTION RE-ASSIGNMENT LOGIC:
  // Shows Banu even if she is "Assigned" to tomorrow, because she isn't "In Progress" today.
  const availableProviders = providers.filter((p) => {
    const pId = p.provider_id || p.id;
    const matchesService = p.service_type?.toLowerCase() === request.service_type?.toLowerCase();
    
    // Only hide if they are currently AT a house for another mission
    const isCurrentlyBusyAtHouse = activeRequests.some(r => 
        r.provider_id === pId && normalizeStatus(r.status) === 'in_progress'
    );

    // Allow re-selection if they are online and not in the middle of a procedure
    return matchesService && !isCurrentlyBusyAtHouse && p.status !== 'Offline';
  }); 

  const history = generateMockHistory();

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/requests" className="mt-1 flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-200/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-black tracking-tight text-slate-900">{request.request_id}</h1>
              <StatusBadge status={request.status} />
              <ChannelBadge channel={request.source_channel || "phone"} />
            </div>
            <p className="text-slate-500 mt-1 text-sm flex items-center gap-2 font-medium">
              <Activity className="w-4 h-4" />
              <span className="capitalize">{request.service_type}</span>
              {request.specific_procedure && <span className="text-slate-400">/ {formatSubService(request.specific_procedure)}</span>}
            </p>
          </div>
        </div>

        {!isClosed && (
          <div className="flex items-center gap-3 flex-wrap">
            {normStatus === "assigned" && (
              <button onClick={() => handleUpdateStatus("In Progress")} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold shadow-sm flex items-center gap-2 transition-all">
                <Activity className="w-4 h-4" /> Mark In Progress
              </button>
            )}
            {["in_progress", "assigned", "pending", "follow_up"].includes(normStatus) && (
              <button onClick={confirmClose} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold shadow-sm flex items-center gap-2 transition-all">
                <CheckCircle2 className="w-4 h-4" /> Close Case
              </button>
            )}
            <button onClick={confirmCancel} className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-semibold transition-all">
              Cancel Request
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><User className="w-4 h-4 text-slate-500" /> Patient Details</h2>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Name</p>
                <p className="font-black text-lg text-slate-900 uppercase">{request.patients?.name || "Unknown"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone</p>
                <a href={`tel:${request.patients?.phone_number}`} className="font-black text-lg text-slate-700 flex items-center gap-2 hover:text-emerald-600">
                  <Phone className="w-4 h-4 text-slate-400" /> {request.patients?.phone_number || "N/A"}
                </a>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Address</p>
                <p className="font-semibold text-slate-700 flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                  {request.patients?.full_address || "No address provided."}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Activity className="w-4 h-4 text-slate-500" /> Service Details</h2>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Service</p>
                <div className="flex items-center gap-2">
                  <ServiceTypeBadge type={request.service_type} />
                  {request.specific_procedure && <span className="text-sm text-slate-500 font-medium">{formatSubService(request.specific_procedure)}</span>}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Time Slot</p>
                <p className="font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" /> {request.requested_time_slot || "Not specified"}
                </p>
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Timer className="w-3.5 h-3.5" /> Estimated Arrival (ETA)</p>
                  {!isEditingEta && !isClosed && (
                    <button onClick={() => setIsEditingEta(true)} className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"><Edit2 className="w-3 h-3" /> Set ETA</button>
                  )}
                </div>
                {isEditingEta ? (
                  <div className="flex gap-2">
                    <input value={eta} onChange={(e) => setEta(e.target.value)} placeholder="e.g. 30 minutes" className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-emerald-500" />
                    <button onClick={handleSaveEta} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold">Save</button>
                    <button onClick={() => setIsEditingEta(false)} className="border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-bold">Cancel</button>
                  </div>
                ) : (
                  <div className={cn("p-3 rounded-lg border text-sm font-medium", eta ? "bg-slate-50 border-slate-200" : "bg-slate-50/50 border-slate-100 text-slate-400 italic")}>
                    {eta || "No ETA set"}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notes</p>
                  {!isEditingNotes && !isClosed && (
                    <button onClick={() => setIsEditingNotes(true)} className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"><Edit2 className="w-3 h-3" /> Edit</button>
                  )}
                </div>
                {isEditingNotes ? (
                  <div className="space-y-2">
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full min-h-[100px] border border-slate-200 rounded-lg p-3 text-sm outline-none focus:border-emerald-500" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setIsEditingNotes(false)} className="border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-bold">Cancel</button>
                      <button onClick={handleSaveNotes} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"><Save className="w-3 h-3"/> Save</button>
                    </div>
                  </div>
                ) : (
                  <div className={cn("p-3 rounded-lg border text-sm font-medium min-h-[60px]", notes ? "bg-slate-50 border-slate-200" : "bg-slate-50/50 border-slate-100 text-slate-400 italic")}>
                    {notes || "No notes provided."}
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 pt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                  <Camera className="w-3.5 h-3.5" /> Visual Evidence / Report Photo
                </p>
                {request.image_url && request.image_url !== 'NULL' ? (
                  <div className="relative group">
                    <img 
                      src={request.image_url} 
                      alt="Mission Evidence" 
                      className="w-full max-h-[400px] object-contain rounded-xl border border-slate-200 shadow-sm bg-slate-50"
                    />
                    <a 
                      href={request.image_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl text-white font-bold text-sm"
                    >
                      Click to View Full Image
                    </a>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-center text-slate-400 text-xs italic">
                    No visual evidence uploaded yet.
                  </div>
                )}
              </div>

            </div>
          </div>
          
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-blue-50/30">
              <h2 className="text-sm font-bold text-blue-800 flex items-center gap-2"><FileText className="w-4 h-4" /> Case History</h2>
            </div>
            <div className="p-6">
              {normStatus === 'cancelled' ? (
                <div className="relative flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full border-2 border-red-300 bg-red-100 text-red-600 flex items-center justify-center shrink-0 z-10"><AlertCircle className="w-4 h-4"/></div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-1"><p className="text-sm font-bold text-red-600">Request Cancelled</p><span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">Done</span></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[19px] before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-200">
                  <div className="relative flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full border-2 border-blue-300 bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 z-10"><CalendarClock className="w-4 h-4"/></div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1"><p className="text-sm font-bold text-blue-600">Request Created</p><span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">Done</span></div>
                    </div>
                  </div>

                  <div className="relative flex items-start gap-4">
                    <div className={cn("w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 z-10", history.some(h=>h.type==='assigned') ? "border-emerald-300 bg-emerald-100 text-emerald-600" : "border-slate-200 bg-slate-50 text-slate-400")}>
                      <UserCheck className="w-4 h-4"/>
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={cn("text-sm font-bold", history.some(h=>h.type==='assigned') ? "text-emerald-700" : "text-slate-400")}>Provider Assigned</p>
                        {normStatus === "assigned" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">Current</span>}
                      </div>
                    </div>
                  </div>

                  <div className="relative flex items-start gap-4">
                    <div className={cn("w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 z-10", history.some(h=>h.type==='in_progress') ? "border-teal-300 bg-teal-100 text-teal-600" : "border-slate-200 bg-slate-50 text-slate-400")}>
                      <Stethoscope className="w-4 h-4"/>
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={cn("text-sm font-bold", history.some(h=>h.type==='in_progress') ? "text-teal-700" : "text-slate-400")}>Care In Progress</p>
                        {normStatus === "in_progress" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-bold">Current</span>}
                      </div>
                    </div>
                  </div>

                  <div className="relative flex items-start gap-4">
                    <div className={cn("w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 z-10", normStatus === 'completed' ? "border-green-300 bg-green-100 text-green-600" : "border-slate-200 bg-slate-50 text-slate-400")}>
                      <CheckCircle2 className="w-4 h-4"/>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={cn("text-sm font-bold", normStatus === 'completed' ? "text-green-700" : "text-slate-400")}>Service Completed</p>
                        {normStatus === "completed" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">Done</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-emerald-100 shadow-sm rounded-xl overflow-hidden">
            <div className="p-4 border-b border-emerald-50 bg-emerald-50/50">
              <h2 className="text-sm font-bold text-emerald-800 flex items-center gap-2"><UserCheck className="w-4 h-4" /> Provider Assignment</h2>
              <p className="text-xs text-slate-500 mt-1">{isClosed ? "Request is closed" : canReassign ? "Dispatch a provider to this request" : "Provider currently on job"}</p>
            </div>
            <div className="p-5">
              {currentProvider ? (
                <div className="space-y-4">
                  <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Assigned Provider</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
                        {currentProvider.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 leading-tight">{currentProvider.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" />{currentProvider.phone_number}</p>
                      </div>
                      {normStatus === "assigned" && <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> Awaiting</span>}
                      {normStatus === "in_progress" && <span className="shrink-0 text-[10px] px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center gap-1"><Activity className="w-3 h-3 animate-pulse" /> Active</span>}
                    </div>
                  </div>

                  {canReassign && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-2">Reassign to another provider</p>
                      <div className="flex gap-2">
                        <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="flex-1 p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none">
                          {availableProviders.map((p) => {
                            const pId = p.provider_id || p.id;
                            const displayZones = Array.isArray(p.service_zone) ? p.service_zone.join(', ') : (p.service_zone || "Roaming");
                            return (
                              <option key={pId} value={pId}>{p.name} — {displayZones}</option>
                            );
                          })}
                        </select>
                        <button onClick={handleAssignProvider} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm">
                          Reassign
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : !isClosed ? (
                <div className="space-y-4">
                  <button onClick={handleAutoAssign} disabled={isAssigning} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors">
                    <Zap className="w-4 h-4"/> {isAssigning ? "Locating..." : "Auto-assign Nearest Provider"}
                  </button>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1"><Navigation2 className="w-3 h-3"/> Matches Preferred Zones & GPS Radius</p>
                  
                  <div className="flex items-center gap-3 my-2"><div className="flex-1 h-px bg-slate-200" /><span className="text-[10px] text-slate-400 uppercase tracking-widest">or assign manually</span><div className="flex-1 h-px bg-slate-200" /></div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-bold text-slate-700">Select Provider</span>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{availableProviders.length} available</span>
                    </div>
                    <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-emerald-500">
                      <option value="">Choose {request.service_type} to dispatch...</option>
                      {availableProviders.map((p) => {
                        const pId = p.provider_id || p.id;
                        const displayZones = Array.isArray(p.service_zone) ? p.service_zone.join(', ') : (p.service_zone || "Roaming");
                        return (
                          <option key={pId} value={pId}>
                            {p.name} — {displayZones}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  
                  <div>
                    <span className="text-xs font-bold text-slate-700 mb-1 block">ETA for patient</span>
                    <input value={eta} onChange={(e) => setEta(e.target.value)} placeholder="e.g. 30 minutes" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500" />
                  </div>
                  
                  <button onClick={handleAssignProvider} disabled={!providerId} className="w-full border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 disabled:opacity-50 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                    <UserCheck className="w-4 h-4"/> Dispatch Provider
                  </button>
                </div>
              ) : (
                <div className="py-4 text-center text-slate-400 text-sm font-medium italic">No provider assigned — request completed.</div>
              )}
            </div>
          </div>

          <div className={cn("bg-white border shadow-sm rounded-xl overflow-hidden", normStatus === 'completed' ? "border-emerald-200" : "border-slate-200")}>
            <div className={cn("p-4 border-b", normStatus === 'completed' ? "bg-emerald-50/50 border-emerald-100" : "bg-slate-50/50 border-slate-100")}>
              <h2 className={cn("text-sm font-bold flex items-center gap-2", normStatus === 'completed' ? "text-emerald-700" : "text-slate-800")}>
                <IndianRupee className="w-4 h-4" /> Billing & Feedback
              </h2>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mission Cost</p>
                  <p className="text-2xl font-black text-slate-900">₹{request.total_amount || 0}</p>
                </div>
                
                <div className="text-left sm:text-right flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase", request.payment_status === 'Paid' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700")}>
                      {request.payment_status || 'Pending Payment'}
                    </span>
                  </div>
                  
                  {request.payment_status !== 'Paid' && normStatus === 'completed' && (
                    <div className="flex flex-col gap-2 mt-2 w-full sm:items-end">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Log Payment</p>
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <button 
                          onClick={async () => {
                            if(window.confirm(`Confirm ₹${request.total_amount} was collected in Cash?`)) {
                                await api.updateRequest(requestId, { payment_status: "Paid", payment_method: "Cash" });
                                loadData();
                            }
                          }}
                          className="flex-1 sm:flex-none text-[10px] bg-emerald-600 text-white px-3 py-2 rounded hover:bg-emerald-700 transition-all font-bold shadow-sm"
                        >
                          Cash
                        </button>

                        <button 
                          onClick={async () => {
                            if(window.confirm(`Confirm ₹${request.total_amount} was received via Direct UPI?`)) {
                                await api.updateRequest(requestId, { payment_status: "Paid", payment_method: "Direct UPI" });
                                loadData();
                            }
                          }}
                          className="flex-1 sm:flex-none text-[10px] bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition-all font-bold shadow-sm"
                        >
                          Direct UPI
                        </button>

                        <button 
                          onClick={() => {
                            alert("This will generate a Razorpay link and send it to the patient's WhatsApp. (Integration pending)");
                          }}
                          className="flex-1 sm:flex-none text-[10px] bg-slate-900 text-white px-3 py-2 rounded hover:bg-slate-800 transition-all font-bold shadow-sm"
                        >
                          Send Link
                        </button>
                      </div>
                    </div>
                  )}

                  {request.payment_status === 'Paid' && request.payment_method && (
                      <p className="text-xs font-bold text-slate-500 mt-2 bg-slate-50 px-2 py-1 rounded">
                          Paid via: <span className="text-slate-800">{request.payment_method}</span>
                      </p>
                  )}
                </div>
              </div>

              {request.receipt_pdf_url && (
                <a 
                  href={request.receipt_pdf_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-lg text-sm font-bold hover:bg-slate-800 transition-all shadow-md mt-4"
                >
                  <DownloadCloud className="w-4 h-4" /> Download PDF Receipt
                </a>
              )}

              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Patient Feedback</p>
                {request.rating ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={cn("w-4 h-4", i < request.rating ? "fill-amber-400 text-amber-400" : "text-slate-200")} />
                      ))}
                      <span className="ml-2 font-black text-slate-700">{request.rating}/5</span>
                    </div>
                    {request.feedback_text && <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded-lg">"{request.feedback_text}"</p>}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Feedback pending from patient WhatsApp.</p>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}