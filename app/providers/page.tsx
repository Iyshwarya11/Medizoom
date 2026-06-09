"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Plus, Phone, MapPin, CheckCircle2, XCircle, ExternalLink, 
  Trash2, Users, X, Activity, Mail, Map, Save, RefreshCw, Map as MapIcon,
  CalendarDays, History
} from "lucide-react";
import { api } from "../../lib/api";
import { normalizeStatus, cn } from "../../lib/utils";

// --- ALL MAJOR PUDUCHERRY ZONES ---
const PONDICHERRY_ZONES = [
  "White Town / Heritage Town", "Lawspet", "Muthialpet", "Mudaliarpet", "Nellithope",
  "Reddiarpalayam", "Orleanpet", "Kamaraj Nagar", "Gorimedu / JIPMER", "Thattanchavady",
  "Koundanpalayam", "Kalapet", "Ariyankuppam", "Villianur", "Thavalakuppam", "Bahour"
];

export default function Providers() {
  const [providers, setProviders] = useState<any[]>([]);
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for specific provider history
  const [providerMissions, setProviderMissions] = useState<any[]>([]);
  const [isLoadingMissions, setIsLoadingMissions] = useState(false);

  // Modal & Add Form State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const initialFormState = {
    name: "", email: "", phone_number: "91", service_type: "Nurse", service_zone: [] as string[]
  };
  const [formData, setFormData] = useState(initialFormState);

  // Edit Drawer State
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState(initialFormState);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Filters
  const [serviceFilter, setServiceFilter] = useState("all");
  const [availFilter, setAvailFilter] = useState("all");

  const loadData = async () => {
    const [provData, reqData] = await Promise.all([api.getProviders(), api.getRequests()]);
    if (provData && provData.providers) setProviders(provData.providers);
    if (Array.isArray(reqData)) setActiveRequests(reqData);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedProvider(null); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleZone = (zone: string, isEditMode: boolean = false) => {
    if (isEditMode) {
      setEditFormData(prev => {
        const currentZones = prev.service_zone || [];
        const newZones = currentZones.includes(zone) 
          ? currentZones.filter(z => z !== zone) 
          : [...currentZones, zone];
        return { ...prev, service_zone: newZones };
      });
    } else {
      setFormData(prev => {
        const currentZones = prev.service_zone || [];
        const newZones = currentZones.includes(zone) 
          ? currentZones.filter(z => z !== zone) 
          : [...currentZones, zone];
        return { ...prev, service_zone: newZones };
      });
    }
  };

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.service_zone.length === 0) {
        alert("Please select at least one operational zone.");
        return;
    }
    setIsSubmitting(true);
    await api.createProvider({ ...formData, status: "Available" });
    setIsSubmitting(false);
    setIsAddOpen(false);
    setFormData(initialFormState);
    loadData();
  };

  const handleUpdateProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider) return;
    if (editFormData.service_zone.length === 0) {
        alert("Please select at least one operational zone.");
        return;
    }
    setIsSavingEdit(true);
    await api.updateProvider(selectedProvider.provider_id, editFormData);
    setIsSavingEdit(false);
    setSelectedProvider(null);
    loadData();
  };

  const toggleAvailability = async (id: string, currentStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = currentStatus === "Available" ? "Offline" : "Available";
    await api.updateProvider(id, { status: newStatus });
    loadData();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure? This cannot be undone.")) {
      await api.deleteProvider(id);
      loadData();
    }
  };

  const openEditDrawer = async (provider: any) => {
    setSelectedProvider(provider);
    setIsLoadingMissions(true);
    setProviderMissions([]);

    let zones = Array.isArray(provider.service_zone) ? provider.service_zone : [];
    setEditFormData({
      name: provider.name || "",
      email: provider.email || "",
      phone_number: provider.phone_number || "91",
      service_type: provider.service_type || "Nurse",
      service_zone: zones
    });

    try {
      const missions = await api.getProviderMissions(provider.provider_id);
      setProviderMissions(missions || []);
    } catch (err) {
      console.error("Failed to load mission history");
    } finally {
      setIsLoadingMissions(false);
    }
  };

  // --- DERIVED STATE ---
  const providersWithLiveStatus = providers.map(p => {
    const activeJob = activeRequests.find(r => 
      r.provider_id === p.provider_id && 
      ['assigned', 'in_progress'].includes(normalizeStatus(r.status))
    );
    return { ...p, liveJob: activeJob, isActuallyOnJob: !!activeJob };
  });

  const availableCount = providersWithLiveStatus.filter(p => p.status === "Available" && !p.isActuallyOnJob).length;
  const onJobCount = providersWithLiveStatus.filter(p => p.isActuallyOnJob).length;

  const filtered = providersWithLiveStatus.filter(p => {
    if (availFilter === "available" && (p.status !== "Available" || p.isActuallyOnJob)) return false;
    if (availFilter === "busy" && !p.isActuallyOnJob) return false;
    const type = (p.service_type || "").toLowerCase();
    if (serviceFilter !== "all" && type !== serviceFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 relative font-sans selection:bg-emerald-500/30">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Fleet Operations</h1>
          <p className="text-slate-500 font-medium mt-1">Manage Puducherry clinicians & track status</p>
        </div>
        <button onClick={() => setIsAddOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2 transition-all active:scale-95">
          <Plus className="w-5 h-5" /> Onboard Provider
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-[2rem] p-6 border shadow-sm bg-white border-slate-200">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Units</p>
            <p className="text-4xl font-black tracking-tight mt-2 text-slate-900">{providers.length}</p>
        </div>
        <div className="rounded-[2rem] p-6 border shadow-sm bg-emerald-50 border-emerald-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Standby (Ready)</p>
            <p className="text-4xl font-black tracking-tight mt-2 text-emerald-600">{availableCount}</p>
        </div>
        <div className="rounded-[2rem] p-6 border shadow-sm bg-blue-50 border-blue-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active on Job</p>
            <p className="text-4xl font-black tracking-tight mt-2 text-blue-600">{onJobCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-200/60">
        <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="w-48 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none shadow-sm cursor-pointer">
          <option value="all">All Services</option>
          <option value="nurse">Nurses</option>
          <option value="physiotherapy">Physiotherapy</option>
        </select>
        <select value={availFilter} onChange={(e) => setAvailFilter(e.target.value)} className="w-48 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none shadow-sm cursor-pointer">
          <option value="all">Global Roster</option>
          <option value="available">Available Now</option>
          <option value="busy">Busy / On Mission</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((provider) => {
          const isAvail = provider.status === "Available" && !provider.isActuallyOnJob;
          let displayZones = "No zones set";
          if (Array.isArray(provider.service_zone) && provider.service_zone.length > 0) {
              displayZones = provider.service_zone.length > 2 
                ? `${provider.service_zone[0]}, ${provider.service_zone[1]} +${provider.service_zone.length - 2} more`
                : provider.service_zone.join(', ');
          }

          return (
            <div 
              key={provider.provider_id} 
              onClick={() => openEditDrawer(provider)}
              className={cn(
                "bg-white rounded-3xl overflow-hidden border shadow-sm flex flex-col transition-all hover:shadow-md cursor-pointer group",
                provider.isActuallyOnJob ? "border-blue-200 ring-1 ring-blue-50" : "border-slate-200/60"
              )}
            >
              <div className="p-6 flex gap-5 items-start flex-1">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl shrink-0 shadow-inner",
                  provider.isActuallyOnJob ? "bg-blue-500" : (isAvail ? 'bg-emerald-500' : 'bg-slate-300')
                )}>
                  {provider.name?.charAt(0) || "P"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-black text-slate-900 text-lg truncate group-hover:text-emerald-600 transition-colors">{provider.name}</h3>
                    <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-widest">{provider.service_type}</span>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm text-slate-500 font-medium">
                    <p className="flex items-center gap-2 truncate"><Phone className="w-3.5 h-3.5" /> {provider.phone_number}</p>
                    <p className="flex items-start gap-2 text-xs leading-snug"><MapIcon className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" /> {displayZones}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3">
                  {provider.isActuallyOnJob ? (
                    <span className="flex items-center gap-1.5 text-xs font-black text-blue-600 uppercase bg-blue-100/50 px-2.5 py-1 rounded-lg">
                      <Activity className="w-3.5 h-3.5 animate-pulse"/> Active
                    </span>
                  ) : isAvail ? (
                    <span className="flex items-center gap-1.5 text-xs font-black text-emerald-600 uppercase bg-emerald-100/50 px-2.5 py-1 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5"/> Ready</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-black text-slate-500 uppercase bg-slate-200/50 px-2.5 py-1 rounded-lg"><XCircle className="w-3.5 h-3.5"/> Offline</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={provider.status === "Available"} disabled={provider.isActuallyOnJob} onChange={(e) => toggleAvailability(provider.provider_id, provider.status, e as any)} />
                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                  <button onClick={(e) => handleDelete(provider.provider_id, e)} className="text-slate-300 hover:text-red-500 transition-colors bg-white p-1.5 rounded-lg border border-slate-200"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- ADD PROVIDER MODAL --- */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-100">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-900">Onboard Provider</h2>
                <p className="text-xs font-bold text-slate-500 mt-0.5">Register a new Puducherry unit</p>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="w-10 h-10 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 rounded-full flex items-center justify-center"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAddProvider} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Full Name *</label>
                  <input required value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} className="w-full p-3.5 border border-slate-200 rounded-2xl outline-none focus:border-emerald-500 text-sm bg-slate-50" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Specialty *</label>
                  <select required value={formData.service_type} onChange={e=>setFormData({...formData, service_type:e.target.value})} className="w-full p-3.5 border border-slate-200 rounded-2xl text-sm font-bold bg-slate-50">
                    <option value="Nurse">Nurse</option>
                    <option value="Physiotherapy">Physiotherapy</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Phone *</label>
                  <input required type="tel" pattern="^91[0-9]{10}$" maxLength={12} value={formData.phone_number} onChange={e=>setFormData({...formData, phone_number:e.target.value})} className="w-full p-3.5 border border-slate-200 rounded-2xl text-sm bg-slate-50" placeholder="91..." />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Email *</label>
                  <input required type="email" value={formData.email} onChange={e=>setFormData({...formData, email:e.target.value})} className="w-full p-3.5 border border-slate-200 rounded-2xl text-sm bg-slate-50" />
                </div>
              </div>
              <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 max-h-64 overflow-y-auto">
                <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 sticky top-0 bg-blue-50/90 py-1">Select Service Zones *</label>
                <div className="grid grid-cols-2 gap-3">
                  {PONDICHERRY_ZONES.map(zone => (
                    <label key={zone} className={cn("flex items-start gap-2 p-2 rounded-xl cursor-pointer border", formData.service_zone.includes(zone) ? "bg-white border-blue-300 shadow-sm" : "bg-transparent border-transparent")}>
                      <input type="checkbox" checked={formData.service_zone.includes(zone)} onChange={() => toggleZone(zone, false)} className="mt-0.5 accent-blue-600 rounded" />
                      <span className="text-[11px] font-bold text-slate-700">{zone}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="bg-slate-900 hover:bg-slate-800 text-white font-black py-4 px-6 rounded-2xl w-full flex justify-center items-center gap-2">
                {isSubmitting ? "Syncing..." : "Register Provider"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT PROVIDER SLIDE-OVER DRAWER --- */}
      {selectedProvider && <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={() => setSelectedProvider(null)} />}
      <div className={cn(
        "fixed inset-y-0 right-0 w-full sm:w-[500px] bg-white/95 backdrop-blur-2xl shadow-2xl z-50 transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col border-l border-slate-200",
        selectedProvider ? "translate-x-0" : "translate-x-full"
      )}>
        {selectedProvider && (
          <>
            <div className="px-8 py-6 flex items-center justify-between shrink-0 border-b border-slate-100 bg-white">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Clinician Profile</h3>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selectedProvider.name}</h2>
              </div>
              <button onClick={() => setSelectedProvider(null)} className="w-10 h-10 bg-slate-50 border border-slate-200 text-slate-400 rounded-full flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleUpdateProvider} className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users className="w-3.5 h-3.5"/> Personnel Data</h4>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-600 mb-1">Email</label>
                        <input value={editFormData.email} onChange={e=>setEditFormData({...editFormData, email:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Phone</label>
                        <input value={editFormData.phone_number} onChange={e=>setEditFormData({...editFormData, phone_number:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Specialty</label>
                        <select value={editFormData.service_type} onChange={e=>setEditFormData({...editFormData, service_type:e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold">
                            <option value="Nurse">Nurse</option>
                            <option value="Physiotherapy">Physiotherapy</option>
                        </select>
                    </div>
                 </div>
              </div>

              {/* MISSION HISTORY & SCHEDULE SECTION */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                   <span className="flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5 text-blue-500"/> Schedule & History</span>
                   {isLoadingMissions && <RefreshCw className="w-3 h-3 animate-spin text-slate-300"/>}
                </h4>
                <div className="space-y-3">
                  {providerMissions.length === 0 && !isLoadingMissions ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <History className="w-8 h-8 text-slate-200 mx-auto mb-2"/>
                        <p className="text-xs text-slate-400 font-medium">No missions assigned yet.</p>
                    </div>
                  ) : (
                    providerMissions.slice(0, 5).map((m) => (
                      <div key={m.request_id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                           <span className="text-xs font-black text-slate-900">Case #{m.request_id}</span>
                           <span className={cn(
                             "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase",
                             normalizeStatus(m.status) === 'completed' ? "bg-emerald-100 text-emerald-600" : 
                             normalizeStatus(m.status) === 'in_progress' ? "bg-blue-100 text-blue-600 animate-pulse" : "bg-amber-100 text-amber-600"
                           )}>
                             {m.status}
                           </span>
                        </div>
                        <p className="text-xs font-bold text-slate-700">{m.patients?.name || "Patient"}</p>
                        <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5"><Activity className="w-3 h-3"/> {m.requested_time_slot}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-emerald-500"/> Service Coverage</h4>
                <div className="grid grid-cols-2 gap-2">
                    {PONDICHERRY_ZONES.map(z => (
                        <label key={z} className={cn(
                            "p-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer",
                            editFormData.service_zone?.includes(z) ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                        )}>
                            <input type="checkbox" className="hidden" checked={editFormData.service_zone?.includes(z)} onChange={() => toggleZone(z, true)} />
                            {z}
                        </label>
                    ))}
                </div>
              </div>

              <div className="pt-4 pb-12">
                <button type="submit" disabled={isSavingEdit} className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-slate-900/10">
                  {isSavingEdit ? "Updating..." : "Save Profile Changes"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}