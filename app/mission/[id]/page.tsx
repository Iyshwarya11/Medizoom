"use client";
import React, { useState, useEffect, use } from "react";
import { api } from "../../../lib/api";
import { MapPin, Phone, User, Clock, CheckCircle2, Activity, ClipboardList, Navigation, Camera, FileImage, Lock, ClipboardCheck } from "lucide-react";
import { formatDateTime } from "../../../lib/format";
import { cn, normalizeStatus } from "../../../lib/utils";

// --- SERVICES ONLY (No prices exposed to provider) ---
const AVAILABLE_SERVICES = [
  "Basic Dressing",
  "Advanced Wound Care",
  "Catheter Insertion",
  "Catheter Removal",
  "IV Injection",
  "Physiotherapy (1 Hr)",
  "Vitals Check & Consult"
];

export default function MobileMissionControl({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const requestId = unwrappedParams.id;
  
  const [request, setRequest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reportNotes, setReportNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [hasInitializedServices, setHasInitializedServices] = useState(false); 

  const loadData = async () => {
    const data = await api.getRequestById(requestId);
    if (data) {
      setRequest(data);
      if (data.notes && !reportNotes) setReportNotes(data.notes);
      
      // Auto-select the initially requested service ONLY ONCE so it doesn't vanish
      if (data.specific_procedure && !hasInitializedServices) {
        const procedures = data.specific_procedure.split(",").map((s: string) => s.trim().replace(/_/g, ' '));
        setSelectedServices(procedures);
        setHasInitializedServices(true);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 10000); 
    return () => clearInterval(interval);
  }, [requestId, hasInitializedServices]);

  const toggleService = (name: string) => {
    setSelectedServices(prev => 
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  // --- ACTIONS ---
  const handleStartMission = async () => {
    setIsSubmitting(true);
    await api.updateRequest(requestId, { status: "In Progress" });
    await loadData();
    setIsSubmitting(false);
  };

  const handleNavigate = () => {
    if (!request?.patients?.full_address) {
      alert("No address available to navigate to.");
      return;
    }
    const encodedAddress = encodeURIComponent(request.patients.full_address);
    window.open(`http://googleusercontent.com/maps.google.com/?q=${encodedAddress}`, "_blank");
  };

  const initiateCheckout = () => {
      setIsCheckoutOpen(true);
  };

  // The Final Submission Flow
  const finalizeCheckoutAndComplete = async () => {
    if (selectedServices.length === 0) return alert("Please select at least one service performed.");
    if (!window.confirm(`Confirm mission completion? The final bill will be calculated and sent to the patient (Method: ${paymentMethod}).`)) return;
    
    setIsSubmitting(true);

    try {
      let imageUrl = request.image_url;

      // 1. Upload photo if selected
      if (selectedFile) {
        const fileName = `${requestId}-${Date.now()}.${selectedFile.name.split('.').pop()}`;
        const uploadedUrl = await api.uploadFile(selectedFile, fileName);
        if (uploadedUrl) imageUrl = uploadedUrl;
      }

      // 2. Save Notes and Image first via standard patch
      if (reportNotes !== request.notes || imageUrl !== request.image_url) {
          await api.updateRequest(requestId, { notes: reportNotes, image_url: imageUrl });
      }

      // 3. Hit the new Checkout Endpoint to handle pricing, DB update, and PDF generation
      const checkoutRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/requests/${requestId}/checkout`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performed_services: selectedServices,
          payment_method: paymentMethod,
          provider_id: request.provider_id
        })
      });

      if (!checkoutRes.ok) throw new Error("Checkout failed on backend");

      setIsCheckoutOpen(false);
      await loadData(); // This will trigger the Locked Screen view
      
    } catch (error) {
      console.error("Completion error:", error);
      alert("Failed to complete mission. Please check your connection.");
      setIsSubmitting(false);
    } 
  };

  if (isLoading) return <div className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading Mission Data...</div>;
  if (!request) return <div className="p-8 text-center text-red-500 font-bold">Mission not found.</div>;

  const normStatus = normalizeStatus(request.status);
  const isCompleted = normStatus === "completed" || normStatus === "cancelled";
  const provider = request.providers;

  // 🛡️ SECURITY OVERRIDE
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <Lock className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Mission Securely Closed</h1>
        <p className="text-slate-500 mb-8 max-w-sm text-sm leading-relaxed">
          This mission was successfully completed. For patient privacy and data security, this link has expired and patient details are no longer accessible.
        </p>
        <div className="bg-slate-200/50 px-4 py-2 rounded-lg">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            ID: {request.request_id}
          </p>
        </div>
      </div>
    );
  }

  // --- ACTIVE MISSION VIEW ---
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      
      {/* Mobile Header */}
      <div className="bg-slate-900 text-white p-6 shadow-md rounded-b-3xl pt-8">
        {provider && (
          <div className="flex items-center gap-3 mb-6 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center text-slate-900 font-black text-lg shadow-inner">
              {provider.name.charAt(0)}
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Active Provider</p>
              <p className="font-bold text-white text-sm">{provider.name}</p>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Mission File</span>
          <span className="text-xs text-slate-400">{formatDateTime(request.created_at)}</span>
        </div>
        <h1 className="text-3xl font-black">{request.request_id}</h1>
        <p className="text-slate-300 mt-1 flex items-center gap-2 font-medium">
          <Activity className="w-4 h-4 text-emerald-400" /> {request.service_type} {request.specific_procedure && `- ${request.specific_procedure.replace(/_/g, ' ')}`}
        </p>
      </div>

      <div className="p-4 space-y-4 -mt-4 relative z-10">
        
        {/* ACTION CENTER CARD */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-500"/> Deployment Status</h2>
            
            {normStatus === "assigned" && (
                <button 
                    onClick={handleStartMission} 
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 active:bg-blue-700 text-white py-4 rounded-xl font-black text-lg shadow-md transition-all flex items-center justify-center gap-2"
                >
                    <Activity className="w-6 h-6" /> Start Care (Mark In Progress)
                </button>
            )}

            {normStatus === "in_progress" && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                    <span className="relative flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span></span>
                    <p className="font-bold text-blue-800">Care currently in progress</p>
                </div>
            )}
        </div>

        {/* PATIENT & ROUTING CARD */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 space-y-5">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3"><User className="w-5 h-5 text-slate-500"/> Patient & Location</h2>
          
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name</p>
            <p className="font-black text-xl text-slate-900">{request.patients?.name || "Unknown"}</p>
          </div>
          
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Address</p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-slate-700">{request.patients?.full_address || "No address provided."}</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <a href={`tel:${request.patients?.phone_number}`} className="flex-1 bg-emerald-50 text-emerald-700 py-3 rounded-xl font-bold border border-emerald-100 active:bg-emerald-100 flex items-center justify-center gap-2">
              <Phone className="w-5 h-5" /> Call
            </a>
            <button onClick={handleNavigate} className="flex-1 bg-blue-50 text-blue-700 py-3 rounded-xl font-bold border border-blue-100 active:bg-blue-100 flex items-center justify-center gap-2">
              <Navigation className="w-5 h-5" /> Navigate
            </button>
          </div>
        </div>

        {/* POST-MISSION REPORT & UPLOAD */}
        {normStatus === "in_progress" && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 space-y-4 shadow-blue-900/5 border-blue-100">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-slate-500"/> Post-Mission Report</h2>
                <p className="text-xs text-slate-500">Add medical notes and upload visual evidence before completing.</p>
                
                <textarea 
                    value={reportNotes}
                    onChange={(e) => setReportNotes(e.target.value)}
                    placeholder="E.g., Patient vitals stable, dressing changed successfully..."
                    className="w-full min-h-[100px] p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:border-blue-500 focus:bg-white outline-none resize-none transition-all"
                />

                <label className={cn(
                    "flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all",
                    selectedFile ? "border-emerald-400 bg-emerald-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
                )}>
                  <input 
                    type="file" 
                    accept="image/*,application/pdf" 
                    className="hidden" 
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} 
                  />
                  {selectedFile ? (
                    <>
                      <FileImage className="w-8 h-8 text-emerald-500 mb-2" />
                      <span className="text-sm font-bold text-emerald-800 text-center">{selectedFile.name}</span>
                      <span className="text-xs text-emerald-600 mt-1">Tap to change file</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-slate-400 mb-2" />
                      <span className="text-sm font-bold text-slate-700">Attach Photo or Document</span>
                      <span className="text-xs text-slate-400 mt-1">Images or PDFs up to 5MB</span>
                    </>
                  )}
                </label>

                <button 
                    onClick={initiateCheckout} 
                    className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-4 rounded-xl font-black text-lg shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <ClipboardCheck className="w-6 h-6" /> Log Services & Close
                </button>
            </div>
        )}
      </div>

      {/* --- CHECKOUT MODAL --- */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 bg-blue-600 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-xl">Mission Report</h3>
                <p className="text-xs font-medium text-blue-200">Select performed tasks</p>
              </div>
              <button onClick={() => setIsCheckoutOpen(false)} className="bg-blue-700 p-2 rounded-full active:scale-95 text-white">X</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* STEP 1: SELECT SERVICES */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">1. Services Performed</p>
                <div className="space-y-2">
                  {AVAILABLE_SERVICES.map(serviceName => (
                    <label key={serviceName} className={cn("flex items-center p-3 border-2 rounded-xl cursor-pointer transition-all", selectedServices.includes(serviceName) ? "border-blue-500 bg-blue-50" : "border-slate-100 hover:bg-slate-50")}>
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 accent-blue-600 rounded-md"
                          checked={selectedServices.includes(serviceName)}
                          onChange={() => toggleService(serviceName)}
                        />
                        <span className={cn("font-bold text-sm", selectedServices.includes(serviceName) ? "text-blue-900" : "text-slate-700")}>{serviceName}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* STEP 2: PAYMENT METHOD */}
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">2. Payment Collection Method</p>
                <select 
                  value={paymentMethod} 
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full p-4 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 bg-white"
                >
                  <option value="Cash">💵 Cash Collected</option>
                  <option value="Direct UPI">📱 Direct UPI (Scan QR)</option>
                  <option value="Link">🔗 Send Online Payment Link</option>
                </select>
              </div>

              {/* DYNAMIC QR CODE DISPLAY */}
              {paymentMethod === "Direct UPI" && (
                <div className="mt-2 p-4 border-2 border-blue-200 bg-blue-50 rounded-xl flex flex-col items-center justify-center text-center animate-in zoom-in duration-200">
                  <p className="text-xs font-black text-blue-800 uppercase tracking-widest mb-3">Patient Scan & Pay</p>
                  
                  {/* Lifecore Pharma QR Code Image */}
                  <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 mb-3 w-48 h-48 flex items-center justify-center overflow-hidden">
                    <img src="/lifecore-qr.png" alt="Lifecore QR" className="w-full h-full object-contain" />
                  </div>
                  
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Lifecore Pharma UPI ID</p>
                  <p className="text-sm font-black text-slate-900 select-all">lifecorepharma@idfcbank</p>
                  <p className="text-xs font-medium text-slate-600 mt-2">Show this screen to the patient so they can pay via GPay, PhonePe, or Paytm.</p>
                </div>
              )}

              {/* SUBMIT (No final total shown) */}
              <div className="pt-4 border-t border-slate-200 flex flex-col gap-4">
                <button 
                  onClick={finalizeCheckoutAndComplete} 
                  disabled={isSubmitting || selectedServices.length === 0}
                  className="w-full bg-slate-900 text-white font-black px-6 py-4 rounded-2xl active:scale-95 disabled:bg-slate-300 disabled:active:scale-100 transition-all flex justify-center items-center gap-2"
                >
                  {isSubmitting ? (
                    <span className="animate-pulse">Securing Data...</span>
                  ) : (
                    <><CheckCircle2 className="w-5 h-5"/> Confirm & Close Case</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}