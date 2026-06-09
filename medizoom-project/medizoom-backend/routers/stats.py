import os
from fastapi import APIRouter
from supabase import create_client, Client
from datetime import datetime, timezone

# Initialize router BEFORE using it in decorators
router = APIRouter()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@router.get("/")
async def get_platform_stats():
    try:
        # 1. Fetch live data from Supabase
        req_res = supabase.table('service_requests').select("*").execute()
        prov_res = supabase.table('providers').select("*").execute()
        
        requests = req_res.data or []
        providers = prov_res.data or []

        # 2. Status Breakdown logic
        total = len(requests)
        completed = len([r for r in requests if r['status'] == 'Completed'])
        pending = len([r for r in requests if r['status'] == 'Awaiting Dispatch'])
        assigned = len([r for r in requests if r['status'] == 'Assigned'])
        in_progress = len([r for r in requests if r['status'] == 'In Progress'])
        cancelled = len([r for r in requests if r['status'] == 'Cancelled'])

        # 3. Dynamic Completion Rate
        rate = 0
        valid_cases_count = total - cancelled
        if valid_cases_count > 0:
            rate = round((completed / valid_cases_count) * 100)

        # 4. Dynamic Provider Utilization
        utilization_pct = 0
        if len(providers) > 0:
            active_provider_ids = {r['provider_id'] for r in requests if r['status'] in ['Assigned', 'In Progress'] and r['provider_id']}
            utilization_pct = round((len(active_provider_ids) / len(providers)) * 100)

        # 5. Service Breakdown for Bar Chart
        breakdown = {}
        for r in requests:
            s_type = r['service_type']
            if s_type not in breakdown:
                breakdown[s_type] = {"total": 0, "completed": 0}
            breakdown[s_type]["total"] += 1
            if r['status'] == 'Completed':
                breakdown[s_type]["completed"] += 1

        # 6. Activity Log
        log_res = supabase.table('activity_log').select("*").order('created_at', desc=True).limit(10).execute()

        return {
            "summary": {
                "total": total,
                "completed": completed,
                "pending": pending,
                "assigned": assigned,
                "in_progress": in_progress,
                "cancelled": cancelled,
                "completion_rate": f"{rate}%",
                "utilization": f"{utilization_pct}%"
            },
            "service_breakdown": breakdown,
            "activity_log": log_res.data or []
        }
    except Exception as e:
        print(f"Stats API Error: {e}")
        return {"error": str(e)}