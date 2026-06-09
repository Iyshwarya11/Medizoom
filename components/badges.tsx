import { cn, normalizeStatus } from "@/lib/utils";

export function Badge({ className, variant = "default", ...props }: any) {
  return <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors", className)} {...props} />
}

export function StatusBadge({ status }: { status: string }) {
  const norm = normalizeStatus(status);
  let colorClass = "";
  let label = status; 

  switch (norm) {
    case "pending": colorClass = "bg-amber-100 text-amber-800 border-amber-200"; label = "Awaiting Dispatch"; break;
    case "assigned": colorClass = "bg-blue-100 text-blue-800 border-blue-200"; label = "Assigned"; break;
    case "in_progress": colorClass = "bg-teal-100 text-teal-800 border-teal-200"; label = "In Progress"; break;
    case "follow_up": colorClass = "bg-orange-100 text-orange-800 border-orange-300 font-bold"; label = "↩ Follow Up"; break;
    case "completed": colorClass = "bg-green-100 text-green-800 border-green-200"; label = "Completed"; break;
    case "cancelled": colorClass = "bg-red-100 text-red-800 border-red-200"; label = "Cancelled"; break;
    default: colorClass = "bg-slate-100 text-slate-800 border-slate-200"; label = status;
  }

  return <Badge className={colorClass}>{label}</Badge>;
}

export function ChannelBadge({ channel }: { channel: string }) {
  if (channel?.toLowerCase() === "whatsapp") {
    return <Badge className="bg-[#25D366]/10 text-[#128C7E] border-[#25D366]/30 font-medium">WhatsApp</Badge>;
  }
  return <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-medium">Phone</Badge>;
}

export function ServiceTypeBadge({ type }: { type: string }) {
  let label = type ? type.charAt(0).toUpperCase() + type.slice(1) : "Unknown";
  return <Badge className="bg-slate-100 text-slate-800 border-slate-200">{label}</Badge>;
}