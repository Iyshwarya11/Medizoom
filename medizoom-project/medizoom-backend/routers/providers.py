import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from supabase import create_client, Client

router = APIRouter()

# 1. Grab your Supabase credentials
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 2. Updated Model to include Arrays for Zones and Service Radius
class ProviderPayload(BaseModel):
    name: str
    phone_number: str
    email: Optional[str] = None
    service_type: str
    service_zone: Optional[List[str]] = [] 
    status: str = "Available"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    service_radius: Optional[int] = 15

@router.get("/")
async def get_all_providers():
    try:
        response = supabase.table('providers').select("*").execute()
        
        # Map database 'status' to frontend 'is_available' for the UI toggles
        data = []
        for p in response.data:
            p['is_available'] = (p.get('status') == 'Available')
            data.append(p)
        return {"providers": data}
    except Exception as e:
        print(f"Error fetching providers: {e}")
        return {"error": str(e)}

# --- NEW: PROVIDER MISSION HISTORY ENDPOINT ---
@router.get("/{provider_id}/missions")
async def get_provider_missions(provider_id: str):
    """
    Fetches all jobs assigned to a specific provider.
    Includes patient names and request IDs for the drawer view.
    """
    try:
        print(f"📋 [SYSTEM] Fetching history for provider: {provider_id}")
        
        # We join with patients to get the name for the history list
        response = supabase.table('service_requests') \
            .select("*, patients(name)") \
            .eq('provider_id', provider_id) \
            .order('created_at', desc=True) \
            .execute()
            
        return response.data
    except Exception as e:
        print(f"Error fetching provider history: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/")
async def create_provider(payload: ProviderPayload):
    try:
        data = payload.dict()
        print(f"Attempting to insert provider: {data['name']} with {len(data['service_zone'])} zones")
        
        response = supabase.table('providers').insert(data).execute()
        
        if response.data:
            print("Provider created successfully.")
            return response.data[0]
        else:
            raise Exception("Insert failed - no data returned.")
            
    except Exception as e:
        print(f"Error creating provider: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/{provider_id}")
async def update_provider(provider_id: str, update_data: Dict[str, Any]):
    try:
        # If the frontend sends 'is_available', we map it to the 'status' column
        if "is_available" in update_data:
            update_data["status"] = "Available" if update_data["is_available"] else "Busy"
            del update_data["is_available"]

        print(f"Updating provider {provider_id} with data keys: {update_data.keys()}")
        response = supabase.table('providers').update(update_data).eq('provider_id', provider_id).execute()
        
        if response.data:
            return response.data[0]
        else:
            raise Exception("Update failed - provider not found.")
            
    except Exception as e:
        print(f"Error updating provider: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{provider_id}")
async def delete_provider(provider_id: str):
    try:
        print(f"Deleting provider: {provider_id}")
        supabase.table('providers').delete().eq('provider_id', provider_id).execute()
        return {"status": "success"}
    except Exception as e:
        print(f"Error deleting provider: {e}")
        raise HTTPException(status_code=400, detail=str(e))