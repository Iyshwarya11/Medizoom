"use client";
import React, { useState, useEffect } from "react";
import { Activity, CheckCircle2, Users, XCircle, Clock, TrendingUp } from "lucide-react";
import { api } from "../../lib/api";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

export default function StatsPage() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = async () => {
    try {
      const data = await api.getSummary();
      // Debug log to verify data arrival in browser console
      console.log("Analytics Data Received:", data);
      if (data && !data.error) {
        setStats(data);
      }
    } catch (err) {
      console.error("Dashboard Sync Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    // Refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Guard Clause: Prevents Recharts from loading with null data/dimensions
  if (isLoading || !stats) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Aggregating Health Analytics...</p>
      </div>
    );
  }

  // Data mapping with safety fallbacks
  const barData = Object.keys(stats.service_breakdown || {}).map(key => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    total: stats.service_breakdown[key]?.total || 0,
    completed: stats.service_breakdown[key]?.completed || 0
  }));

  const pieData = [
    { name: 'Completed', value: stats.summary?.completed || 0 },
    { name: 'Assigned', value: stats.summary?.assigned || 0 },
    { name: 'Pending', value: stats.summary?.pending || 0 },
    { name: 'Cancelled', value: stats.summary?.cancelled || 0 },
  ].filter(item => item.value > 0);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Stats & Analytics</h1>
          <p className="text-slate-500 font-medium mt-1">Real-time platform performance and operational health</p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-100">
           <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
           Live Feed Active
        </div>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard label="System Status" value="Operational" color="text-emerald-600" icon={<Activity className="text-emerald-500"/>} />
        <StatsCard label="Completion Rate" value={stats.summary?.completion_rate || "0%"} color="text-blue-600" icon={<TrendingUp className="text-blue-500"/>} />
        <StatsCard label="Provider Utilization" value={stats.summary?.utilization || "100%"} color="text-purple-600" icon={<Users className="text-purple-500"/>} />
        <StatsCard label="Pending Cases" value={stats.summary?.pending || 0} color="text-orange-600" icon={<Clock className="text-orange-500"/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bar Chart Section */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Volume by Service Category</h2>
          
          <div className="w-full" style={{ minHeight: '350px' }}>
            <ResponsiveContainer width="99%" aspect={2.5}>
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 800}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                />
                <Bar dataKey="total" fill="#0f172a" radius={[6, 6, 0, 0]} name="Requested" barSize={32} />
                <Bar dataKey="completed" fill="#10b981" radius={[6, 6, 0, 0]} name="Finished" barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart Section */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Status Breakdown</h2>
          
          <div className="relative w-full flex justify-center items-center" style={{ minHeight: '350px' }}>
            <ResponsiveContainer width="99%" aspect={1}>
              <PieChart>
                <Pie 
                    data={pieData} 
                    innerRadius="70%" 
                    outerRadius="90%" 
                    paddingAngle={8} 
                    dataKey="value"
                    stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-slate-900 leading-none">{stats.summary?.total || 0}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-1">Total Cases</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dispatch Timeline */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500" /> Dispatch Timeline
            </h2>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Last 10 Events</span>
        </div>
        <div className="divide-y divide-slate-100">
            {stats.activity_log?.length > 0 ? stats.activity_log.map((log: any) => (
                <div key={log.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-all group">
                    <div className="flex items-center gap-6">
                        <div className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md group-hover:bg-white transition-colors">
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800 leading-snug">{log.description}</p>
                            <p className="text-[10px] font-black text-emerald-600 uppercase mt-1 tracking-wider">Case ID: {log.request_id}</p>
                        </div>
                    </div>
                </div>
            )) : (
                <div className="p-16 text-center text-slate-400 italic text-sm font-medium">No system activity captured in this period.</div>
            )}
        </div>
      </div>
    </div>
  );
}

function StatsCard({ label, value, color, icon }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <div className="p-2 bg-slate-50 rounded-xl">{icon}</div>
      </div>
      <p className={`text-2xl font-black tracking-tight ${color}`}>{value}</p>
    </div>
  );
}