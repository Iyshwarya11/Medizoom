"use client";
import { useState, useMemo } from "react";
import { ArrowLeft, Save, PhoneCall, User, Activity, MapPin } from "lucide-react";
import Link from "next/link";
import { api } from "../../lib/api";

const SUB_SERVICES: Record<string, { label: string; value: string }[]> = {
  nurse: [
    { label: "Injection", value: "injection" },
    { label: "Dressing / Wound Care", value: "dressing" },
    { label: "Catheter Care", value: "catheter_care" },
    { label: "IV / Cannula", value: "iv_cannula" },
    { label: "Vital Monitoring", value: "vital_monitoring" },
  ],
  physiotherapy: [
    { label: "Mobility Care", value: "mobility_care" },
    { label: "Stroke Rehabilitation", value: "stroke_care" },
    { label: "Post-surgical Rehab", value: "post_surgical_rehab" },
    { label: "Pain Management", value: "pain_management" },
  ],
};

function buildTimeSlots() {
  const now = new Date();
  const slots = [];

  const todayHours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  for (const h of todayHours) {
    if (h > now.getHours()) {
      const suffix = h >= 12 ? "PM" : "AM";
      const display = h > 12 ? h - 12 : h;
      slots.push(`Today ${display}:00 ${suffix}`);
    }
  }

  const tomorrowHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  for (const h of tomorrowHours) {
    const suffix = h >= 12 ? "PM" : "AM";
    const display = h > 12 ? h - 12 : h === 12 ? 12 : h;
    slots.push(`Tomorrow ${display}:00 ${suffix}`);
  }

  slots.push("Schedule Later (will call back)");
  return slots;
}

export default function NewRequest() {
  const [formData, setFormData] = useState({
    patientName: "",
    patientPhone: "",
    patientAge: "",
    patientGender: "",
    channel: "phone",
    patientLocation: "",
    patientLandmark: "",
    serviceType: "nurse",
    subServiceType: "",
    timeSlotLabel: "",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const timeSlots = useMemo(() => buildTimeSlots(), []);
  const subOptions = SUB_SERVICES[formData.serviceType] || [];

  // --- SMART GEOCODING FUNCTION WITH FALLBACK ---
  const geocodeAddress = async (address: string) => {
    try {
      // Attempt 1: Try searching the exact full address
      let query = encodeURIComponent(`${address}, India`);
      let res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
      let data = await res.json();
      
      // Attempt 2: If the map failed (usually due to flat/house numbers), search the broader area
      if (!data || data.length === 0) {
        console.warn("Exact address not found on map, trying broader neighborhood...");
        
        // Split the address by comma and take the last 2 parts (usually Area, City)
        const addressParts = address.split(',');
        const broaderAddress = addressParts.length > 1 
          ? addressParts.slice(-2).join(',').trim() 
          : address;
          
        query = encodeURIComponent(`${broaderAddress}, India`);
        res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`);
        data = await res.json();
      }

      // If we found a result, return it
      if (data && data.length > 0) {
        console.log("📍 Auto-GPS Found:", data[0].lat, data[0].lon);
        return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      } else {
        console.warn("Could not calculate GPS for this address.");
      }
    } catch (err) {
      console.error("Geocoding failed behind the scenes:", err);
    }
    return { lat: null, lon: null }; // Return null if it completely fails
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // 1. Convert the typed address into GPS coordinates
    const coords = await geocodeAddress(formData.patientLocation);

    // 2. Format Phone Number
    let formattedPhone = formData.patientPhone.replace(/\D/g, '');
    if (formattedPhone.length === 10) {
      formattedPhone = `91${formattedPhone}`;
    }

    // 3. Map the form data to the backend payload
    const payload = {
      patient_name: formData.patientName,
      phone_number: formattedPhone,
      age: parseInt(formData.patientAge),
      gender: formData.patientGender,
      full_address: formData.patientLocation,
      landmark: formData.patientLandmark || null,
      
      // Pass the generated GPS coordinates to the backend!
      latitude: coords.lat,
      longitude: coords.lon,
      
      source_channel: formData.channel,
      service_type: formData.serviceType,
      specific_procedure: formData.subServiceType,
      requested_time_slot: formData.timeSlotLabel,
      notes: formData.notes || null,
      status: "Awaiting Dispatch"
    };

    const res = await api.createRequest(payload);
    
    if (res) {
      window.location.href = "/requests"; 
    } else {
      alert("Failed to create request. Please check the browser console or Python terminal.");
      setIsSubmitting(false);
    }
  };

  const inputStyles = "w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-medium text-slate-800 placeholder:text-slate-400";
  const labelStyles = "block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2";

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Link href="/requests" className="bg-white p-3 rounded-full shadow-sm border border-slate-200 text-slate-500 hover:text-slate-900 transition-all hover:shadow-md hover:-translate-x-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">New Request</h1>
          <p className="text-slate-500 mt-1 text-sm font-medium flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-emerald-500" />
            Dispatcher entry — securely log a patient call
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Patient Dossier Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50/80 border-b border-slate-100 p-6 flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-xl text-blue-600 shadow-inner"><User className="w-5 h-5"/></div>
            <h2 className="font-bold text-slate-800 text-lg">Patient Information</h2>
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className={labelStyles}>Full Name <span className="text-red-500">*</span></label>
              <input required value={formData.patientName} onChange={e => setFormData({...formData, patientName: e.target.value})} placeholder="e.g. Rajesh Iyer" className={inputStyles} />
            </div>
            
            <div className="space-y-2">
              <label className={labelStyles}>Phone / WhatsApp <span className="text-red-500">*</span></label>
              <div className="flex">
                <span className="inline-flex items-center px-4 rounded-l-2xl border border-r-0 border-slate-200 bg-slate-100 text-slate-500 font-bold text-sm">
                  +91
                </span>
                <input 
                  required 
                  type="tel" 
                  maxLength={10}
                  value={formData.patientPhone} 
                  onChange={e => setFormData({...formData, patientPhone: e.target.value})} 
                  placeholder="9876543210" 
                  className={`${inputStyles} rounded-l-none`} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={labelStyles}>Age <span className="text-red-500">*</span></label>
                <input required type="number" min="1" max="120" value={formData.patientAge} onChange={e => setFormData({...formData, patientAge: e.target.value})} placeholder="68" className={inputStyles} />
              </div>
              <div className="space-y-2">
                <label className={labelStyles}>Gender <span className="text-red-500">*</span></label>
                <select required value={formData.patientGender} onChange={e => setFormData({...formData, patientGender: e.target.value})} className={`${inputStyles} appearance-none cursor-pointer`}>
                  <option value="" disabled>Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelStyles}>Source Channel <span className="text-red-500">*</span></label>
              <select required value={formData.channel} onChange={e => setFormData({...formData, channel: e.target.value})} className={`${inputStyles} appearance-none cursor-pointer`}>
                <option value="phone">Phone Call</option>
                <option value="whatsapp">WhatsApp (manual)</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className={labelStyles}>Complete Address <span className="text-red-500">*</span></label>
              <div className="relative">
                <MapPin className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                <textarea required value={formData.patientLocation} onChange={e => setFormData({...formData, patientLocation: e.target.value})} placeholder="House/flat no., Street, Area, City" rows={2} className={`${inputStyles} pl-12 resize-none min-h-[80px]`} />
              </div>
              <p className="text-[10px] text-slate-400 italic mt-1">GPS coordinates will be automatically calculated from this address.</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className={labelStyles}>Landmark (Optional)</label>
              <input value={formData.patientLandmark} onChange={e => setFormData({...formData, patientLandmark: e.target.value})} placeholder="e.g. Near BDA Complex, Behind City Hospital" className={inputStyles} />
            </div>
          </div>
        </div>

        {/* Mission Parameters Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50/80 border-b border-slate-100 p-6 flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600 shadow-inner"><Activity className="w-5 h-5"/></div>
            <h2 className="font-bold text-slate-800 text-lg">Service Details</h2>
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className={labelStyles}>Service Type <span className="text-red-500">*</span></label>
              <select required value={formData.serviceType} onChange={e => setFormData({...formData, serviceType: e.target.value, subServiceType: ""})} className={`${inputStyles} appearance-none cursor-pointer`}>
                <option value="nurse">Nurse Visit</option>
                <option value="physiotherapy">Physiotherapy</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className={labelStyles}>Specific Procedure <span className="text-red-500">*</span></label>
              <select required value={formData.subServiceType} onChange={e => setFormData({...formData, subServiceType: e.target.value})} className={`${inputStyles} appearance-none cursor-pointer`}>
                <option value="" disabled>Select procedure...</option>
                {subOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className={labelStyles}>Requested Time Slot <span className="text-red-500">*</span></label>
              <select required value={formData.timeSlotLabel} onChange={e => setFormData({...formData, timeSlotLabel: e.target.value})} className={`${inputStyles} appearance-none cursor-pointer`}>
                <option value="" disabled>When does the patient need this?</option>
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className={labelStyles}>Dispatcher Notes (Optional)</label>
              <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Any critical info for the provider — e.g. diabetic patient, post-surgical, prefers morning visits..." className={`${inputStyles} resize-none min-h-[100px]`} />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4 pt-4">
          <Link href="/requests" className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 hover:text-slate-900 transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={isSubmitting} className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white px-10 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-slate-900/20 transition-all hover:shadow-2xl hover:-translate-y-0.5">
            {isSubmitting ? "Generating..." : <><Save className="w-5 h-5" /> Generate Request</>}
          </button>
        </div>
      </form>
    </div>
  );
}