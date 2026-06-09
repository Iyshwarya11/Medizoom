import os
import random
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from supabase import create_client, Client

# --- CRITICAL IMPORTS FOR WHATSAPP & PDF ---
from services.whatsapp_bot import send_job_offer, send_text, send_receipt_pdf, send_star_rating_menu
from services.pdf_generator import create_and_upload_pdf

router = APIRouter()

# 1. Grab your Supabase credentials
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- PYDANTIC MODELS FOR INCOMING DATA ---
class NewRequestPayload(BaseModel):
    patient_name: str
    phone_number: str
    age: int                     # Required for safety
    gender: str                  # Required for safety
    full_address: str
    landmark: Optional[str] = None
    latitude: Optional[float] = None   # Required for Auto-Assign
    longitude: Optional[float] = None  # Required for Auto-Assign
    source_channel: str
    service_type: str
    specific_procedure: str      # Required
    requested_time_slot: str     # Required
    notes: Optional[str] = None
    status: str = "Awaiting Dispatch"

class MissionCheckoutPayload(BaseModel):
    performed_services: List[str]  # e.g. ["Basic Dressing", "IV Injection"]
    payment_method: str            # "Cash", "Direct UPI", or "Link"
    provider_id: str

# --- OFFICIAL MEDIZOOM PRICE CATALOG ---
PRICE_CATALOG = {
    "Basic Dressing": 400,
    "Advanced Wound Care": 700,
    "Catheter Insertion": 600,
    "Catheter Removal": 400,
    "IV Injection": 300,
    "Physiotherapy (1 Hr)": 800,
    "Vitals Check & Consult": 300
}

# --- HELPER: BACKGROUND WORKER FOR POST-MISSION ---
# ⚠️ CRITICAL WINDOWS FIX: Must remain synchronous (no async/await)
def process_post_mission_workflow(request_id: str, patient_phone: str, amount: int):
    """Generates PDF and sends WhatsApps without slowing down the app UI."""
    try:
        print(f"💰 [BILLING] Starting workflow for {request_id} (Amount: ₹{amount})")
        
        # 1. Generate the PDF using modern Playwright and upload to Supabase Storage
        pdf_public_url = create_and_upload_pdf(request_id, amount) 
        
        # 2. Update DB with the PDF link (Keep existing payment_status unchanged)
        supabase.table("service_requests").update({
            "receipt_pdf_url": pdf_public_url,
            "total_amount": amount
        }).eq("request_id", request_id).execute()
        
        # 3. WhatsApp: Send the Document and the Feedback Star Rating
        send_receipt_pdf(patient_phone, pdf_public_url)
        send_star_rating_menu(patient_phone)
        
        print(f"✅ [SUCCESS] Billing & Feedback sent for {request_id}")
    except Exception as e:
        print(f"❌ [ERROR] Post-mission background task failed: {e}")

# --- ENDPOINTS ---

@router.get("/")
async def get_all_requests():
    """Fetch all active and past service requests."""
    try:
        response = supabase.table('service_requests').select(
            "*, patients(*), providers(*)"
        ).order('created_at', desc=True).execute()
        
        return response.data
    except Exception as e:
        return {"error": str(e)}
    

@router.get("/{request_id}")
async def get_request_by_id(request_id: str):
    """Fetch a single request by its MZ-ID to load the details page."""
    try:
        response = supabase.table('service_requests').select(
            "*, patients(*), providers(*)"
        ).eq('request_id', request_id).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]
        else:
            raise HTTPException(status_code=404, detail="Request not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/")
async def create_new_request(payload: NewRequestPayload):
    try:
        print("--- STARTING NEW REQUEST CREATION ---")
        # STEP 1: Check if a patient with this phone number already exists
        existing_patient = supabase.table('patients').select('*').eq('phone_number', payload.phone_number).execute()
        
        if existing_patient.data and len(existing_patient.data) > 0:
            patient_id = existing_patient.data[0].get('patient_id', existing_patient.data[0].get('id'))
            print(f"Found existing patient with ID: {patient_id}")
            
            # Update GPS coordinates if they exist
            if payload.latitude and payload.longitude:
                supabase.table('patients').update({
                    "latitude": payload.latitude,
                    "longitude": payload.longitude,
                    "full_address": payload.full_address
                }).eq('patient_id', patient_id).execute()
        else:
            # Create new patient with GPS
            new_patient_data = {
                "name": payload.patient_name,
                "phone_number": payload.phone_number,
                "age": payload.age,
                "gender": payload.gender,
                "full_address": payload.full_address,
                "landmark": payload.landmark,
                "latitude": payload.latitude,
                "longitude": payload.longitude
            }
            new_patient = supabase.table('patients').insert(new_patient_data).execute()
            patient_id = new_patient.data[0].get('patient_id', new_patient.data[0].get('id'))
            print(f"Created new patient with ID: {patient_id}")

        # STEP 2: Generate a custom Request ID
        request_id_str = f"MZ-{random.randint(10000, 99999)}"

        # STEP 3: Insert the new Service Request
        new_request_data = {
            "request_id": request_id_str,
            "patient_id": patient_id,
            "source_channel": payload.source_channel,
            "service_type": payload.service_type,
            "specific_procedure": payload.specific_procedure,
            "requested_time_slot": payload.requested_time_slot,
            "notes": payload.notes,
            "status": payload.status
        }
        
        new_request = supabase.table('service_requests').insert(new_request_data).execute()
        print("--- REQUEST CREATED SUCCESSFULLY ---")

        return new_request.data[0]
    
    except Exception as e:
        print("!!! SUPABASE INSERT ERROR !!! ->", str(e))
        raise HTTPException(status_code=400, detail=str(e))


# --- NEW: ADVANCED MISSION CHECKOUT ENDPOINT ---
@router.patch("/{request_id}/checkout")
async def mission_checkout(request_id: str, payload: MissionCheckoutPayload, background_tasks: BackgroundTasks):
    """Handles the dynamic billing, upsells, and completion from the Provider's mobile device."""
    try:
        print(f"🏥 [SYSTEM] Mission Checkout Initiated for {request_id}")
        
        # 1. Calculate the exact total based on our Catalog
        final_total = sum(PRICE_CATALOG.get(service, 0) for service in payload.performed_services)
        
        # Join the list into a comma-separated string for the DB
        services_string = ", ".join(payload.performed_services)

        # 2. Update the Database with exact financials and actual procedures done
        update_data = {
            "status": "Completed",
            "payment_status": "Paid" if payload.payment_method in ["Cash", "Direct UPI"] else "Pending Payment",
            "payment_method": payload.payment_method,
            "total_amount": final_total,
            "specific_procedure": services_string 
        }
        
        supabase.table('service_requests').update(update_data).eq('request_id', request_id).execute()

        # 3. Fetch Patient Phone for WhatsApp
        req_data = supabase.table('service_requests').select("*, patients(phone_number)").eq('request_id', request_id).execute()
        if req_data.data and req_data.data[0].get('patients'):
            patient_phone = req_data.data[0]['patients']['phone_number']
            
            # 4. Trigger PDF Generation & WhatsApp Feedback in the background
            background_tasks.add_task(process_post_mission_workflow, request_id, patient_phone, final_total)

        # 5. Free up the Provider!
        supabase.table('providers').update({"status": "Available"}).eq('provider_id', payload.provider_id).execute()
        print(f"✅ Provider {payload.provider_id} is now Available.")

        return {"success": True, "total_charged": final_total, "services": payload.performed_services}

    except Exception as e:
        print(f"Checkout Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{request_id}")
async def update_request(request_id: str, update_data: Dict[str, Any], background_tasks: BackgroundTasks):
    """Standard dashboard updates for dispatchers (Assign, Cancel, Edit Notes)."""
    try:
        # 1. Fetch current data BEFORE updating
        current_req = supabase.table('service_requests').select("*, patients(*), providers(*)").eq('request_id', request_id).execute()
        
        should_notify_provider = False
        notification_type = ""
        old_status = ""
        new_status = str(update_data.get("status", "")).lower()

        if current_req.data:
            old_data = current_req.data[0]
            old_status = str(old_data.get('status', '')).lower()
            
            # If the frontend explicitly sends a 'provider_id', the dispatcher clicked "Dispatch"
            if "provider_id" in update_data and update_data["provider_id"]:
                should_notify_provider = True
                notification_type = "NEW_ASSIGNMENT"

            # Condition: The dispatcher manually marked it "In Progress"
            if new_status == "in progress" and old_status != "in progress":
                should_notify_provider = True
                notification_type = "IN_PROGRESS_ALERT"

        # 2. Update the request in Supabase
        response = supabase.table('service_requests').update(update_data).eq('request_id', request_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Request not found")

        updated_request = response.data[0]

        # 3. Trigger WhatsApp Logic (Dispatch / In Progress)
        if should_notify_provider:
            full_data = supabase.table('service_requests').select("*, patients(*), providers(*)").eq('request_id', request_id).execute()
            if full_data.data:
                req = full_data.data[0]
                if req.get('patients') and req.get('providers'):
                    provider_phone = req['providers'].get('phone_number')
                    patient_name = req['patients'].get('name')
                    service_type = req.get('service_type')
                    procedure = req.get('specific_procedure', '')
                    
                    # --- FIXED: Pulling address and time_slot from join results ---
                    patient_address = req['patients'].get('full_address', 'Address not specified')
                    time_slot = req.get('requested_time_slot', 'ASAP')

                    try:
                        if notification_type == "NEW_ASSIGNMENT":
                            print(f"\n✅ Triggering MANUAL JOB OFFER to: {req['providers'].get('name')}")
                            # --- FIXED: Passing all 7 required arguments ---
                            send_job_offer(
                                to=provider_phone, 
                                req_id=request_id, 
                                patient_name=patient_name, 
                                service_type=service_type, 
                                procedure=procedure, 
                                address=patient_address, 
                                time_slot=time_slot
                            )
                        
                        elif notification_type == "IN_PROGRESS_ALERT":
                            print(f"\n✅ Triggering IN PROGRESS ALERT to: {req['providers'].get('name')}")
                            send_text(provider_phone, f"🚨 *Dispatch Override*\n\nMission {request_id} ({patient_name}) has been marked as *IN PROGRESS* by headquarters.")
                    
                    except Exception as e:
                        print(f"\n❌ Failed to send WhatsApp Webhook: {e}")
                else:
                    print("Warning: Could not send Job Offer. Patient or Provider data missing.")
        
        # 4. FALLBACK BILLING (If Dispatcher forces "Close Case" from dashboard instead of Provider Checkout)
        if new_status == "completed" and old_status != "completed":
            print(f"🏥 [SYSTEM] Dispatcher forced Case Closure for {request_id}.")
            
            if current_req.data and old_data.get('provider_id'):
                prov_id = old_data.get('provider_id')
                supabase.table('providers').update({"status": "Available"}).eq('provider_id', prov_id).execute()
            
            stype = old_data.get('service_type', '').lower()
            amount = 500 if 'nurse' in stype else 800
            
            if current_req.data and old_data.get('patients'):
                patient_phone = old_data['patients']['phone_number']
                background_tasks.add_task(process_post_mission_workflow, request_id, patient_phone, amount)

        return updated_request
    
    except Exception as e:
        print(f"Patch Error: {e}")
        raise HTTPException(status_code=400, detail=str(e))