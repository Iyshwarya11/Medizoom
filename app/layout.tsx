"use client";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Activity, ListTodo, Plus, Bell, Stethoscope } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // --- DETECT MISSION PAGE ---
  // If the URL contains /mission, it means a Provider is viewing this on their phone!
  const isMissionPage = pathname?.startsWith("/mission");

  const nav = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "All Requests", href: "/requests", icon: ListTodo },
    { name: "New Intake", href: "/new", icon: Plus },
    { name: "Fleet & Providers", href: "/providers", icon: Users },
    { name: "Analytics", href: "/stats", icon: Activity },
  ];

  return (
    <html lang="en">
      <body className={`${inter.className} flex h-screen overflow-hidden bg-slate-50`}>
        
        {/* CONDITIONAL SIDEBAR: Hidden on Mission Pages */}
        {!isMissionPage && (
          <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col border-r border-slate-800 shadow-2xl z-20 shrink-0">
            <div className="h-20 flex items-center px-6 border-b border-slate-800/50 bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-emerald-400 to-teal-600 p-2 rounded-xl shadow-lg shadow-teal-900/50">
                  <Stethoscope className="w-5 h-5 text-white" />
                </div>
                <span className="font-black tracking-widest text-white text-lg">MEDIZOOM</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto py-8 px-4 space-y-2">
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Command Center</p>
              {nav.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href) && item.href !== "/new" && pathname !== "/new");
                return (
                  <Link key={item.name} href={item.href} className="block">
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                        isActive 
                          ? "bg-slate-800 text-white shadow-inner ring-1 ring-white/10" 
                          : "hover:bg-slate-900/50 hover:text-slate-100"
                      }`}>
                      <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                      {item.name}
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="p-5 border-t border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-xl ring-1 ring-white/5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-inner">OP</div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">Operator #12</span>
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">Active Dispatcher</span>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col min-w-0 relative">
          
          {/* CONDITIONAL TOPBAR: Hidden on Mission Pages */}
          {!isMissionPage && (
            <header className="h-20 border-b border-slate-200 bg-white/70 backdrop-blur-xl flex items-center justify-end px-8 shrink-0 z-10 sticky top-0">
              <button 
                suppressHydrationWarning={true}
                className="relative p-2.5 bg-white rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm transition-all hover:shadow-md hover:border-slate-300 active:scale-95"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
              </button>
            </header>
          )}
          
          {/* CONDITIONAL PADDING: Mission page gets full edge-to-edge mobile feel */}
          <div className={`flex-1 overflow-y-auto ${isMissionPage ? "" : "p-8"}`}>
            {children}
          </div>
        </main>

      </body>
    </html>
  );
}