// --- SUPABASE SETTINGS ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wxfqlqjcormjjpvckgjy.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZnFscWpjb3JtampwdmNrZ2p5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTU1MjIsImV4cCI6MjA5MTA3MTUyMn0.uIW_YsE_m4YKG1XW9Q_zTLl8PCj73tIfbdRtcCn89KU";

const API_BASE_URL = "https://percolable-unfailing-leigha.ngrok-free.dev/api";

const NGROK_HEADERS = {
  "ngrok-skip-browser-warning": "true",
  "Content-Type": "application/json"
};

// --- GPS DISTANCE CALCULATOR (Haversine Formula) ---
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

export const api = {
  // 🚀 Pure REST API Upload for Supabase Storage
  uploadFile: async (file: File, path: string) => {
    try {
      const uploadUrl = `${supabaseUrl}/storage/v1/object/mission-report/${path}`;

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': file.type || 'application/octet-stream',
          'x-upsert': 'true' 
        },
        body: file
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Supabase REST Upload Error:", errorText);
        throw new Error("Failed to upload to Supabase");
      }

      return `${supabaseUrl}/storage/v1/object/public/mission-report/${path}`;
    } catch (e) {
      console.error("Storage Upload Error:", e);
      return null;
    }
  },

  getSummary: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/stats/`, { 
        cache: 'no-store',
        headers: NGROK_HEADERS
      });
      return res.json();
    } catch (e) { console.error(e); return null; }
  },
  
  getRequests: async (filters = "") => {
    try {
      const res = await fetch(`${API_BASE_URL}/requests/${filters}`, { 
        cache: 'no-store',
        headers: NGROK_HEADERS
      });
      if (!res.ok) throw new Error("Failed to fetch requests");
      return await res.json();
    } catch (e) { console.error(e); return []; }
  },
  
  getRequestById: async (id: string) => {
    if (!id || id === "NULL" || id === "null" || id === "undefined") return null;
    try {
      const res = await fetch(`${API_BASE_URL}/requests/${id}`, { 
        cache: 'no-store',
        headers: NGROK_HEADERS
      });
      if (!res.ok) throw new Error("Failed to fetch request details");
      return await res.json();
    } catch (e) { console.error(e); return null; }
  },
  
  getProviders: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/providers/`, { 
        cache: 'no-store',
        headers: NGROK_HEADERS
      });
      if (!res.ok) throw new Error("Failed to fetch providers");
      return await res.json();
    } catch (e) { console.error(e); return { providers: [] }; }
  },
  
  createRequest: async (data: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/requests/`, {
        method: 'POST', 
        headers: NGROK_HEADERS,
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Backend rejected the data");
      return await res.json();
    } catch (e: any) { console.error(e); return null; }
  },
  
  updateRequest: async (id: string, data: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/requests/${id}`, {
        method: 'PATCH', 
        headers: NGROK_HEADERS,
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e) { console.error(e); return null; }
  },
  
  autoAssignRequest: async (requestId: string, serviceType: string, patientLat: number, patientLon: number) => {
    try {
      const provRes = await fetch(`${API_BASE_URL}/providers/`, { 
        cache: 'no-store',
        headers: NGROK_HEADERS
      });
      const provData = await provRes.json();
      const providersList = provData.providers || [];

      const candidates = providersList
        .filter((p: any) => 
          p.status === 'Available' && 
          p.service_type?.toLowerCase() === serviceType?.toLowerCase() &&
          p.latitude && p.longitude
        )
        .map((p: any) => ({
          ...p,
          distance: calculateDistance(patientLat, patientLon, p.latitude, p.longitude)
        }))
        .sort((a: any, b: any) => a.distance - b.distance); 

      if (candidates.length === 0) throw new Error("No available providers found within reach.");

      const bestMatch = candidates[0];

      const updateRes = await fetch(`${API_BASE_URL}/requests/${requestId}`, {
        method: 'PATCH',
        headers: NGROK_HEADERS,
        body: JSON.stringify({ 
          provider_id: bestMatch.provider_id, 
          status: 'Assigned' 
        })
      });

      if (!updateRes.ok) throw new Error("Failed to update assignment in database.");
      return { success: true, provider: bestMatch };
    } catch (e: any) {
      console.error(e);
      return { success: false, error: e.message };
    }
  },
  
  createProvider: async (data: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/providers/`, {
        method: 'POST', 
        headers: NGROK_HEADERS,
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create provider");
      return await res.json();
    } catch (e: any) { console.error(e); return null; }
  },
  
  updateProvider: async (id: string | number, data: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/providers/${id}`, {
        method: 'PATCH', 
        headers: NGROK_HEADERS,
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update provider");
      return await res.json();
    } catch (e: any) { console.error(e); return null; }
  },

  getProviderMissions: async (providerId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/providers/${providerId}/missions`, {
        headers: NGROK_HEADERS
      });
      if (!res.ok) throw new Error("Failed to fetch provider history");
      return await res.json();
    } catch (e) {
      console.error("API Error [getProviderMissions]:", e);
      return [];
    }
  },

  deleteProvider: async (id: string | number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/providers/${id}`, { 
        method: 'DELETE',
        headers: NGROK_HEADERS
      });
      if (!res.ok) throw new Error("Failed to delete provider");
      return true;
    } catch (e: any) { console.error(e); return false; }
  }
};