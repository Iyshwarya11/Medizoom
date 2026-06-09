import os
import uuid
import traceback
from datetime import datetime, timedelta
from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse
from services.whatsapp_bot import *
from database import db  # Ensure your database.py exports 'db'

router = APIRouter()

@router.get("/whatsapp")
async def verify_webhook(request: Request):
    """Verifies the webhook for Meta API setup."""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    if mode == "subscribe" and token == os.environ.get("META_VERIFY_TOKEN"):
        return PlainTextResponse(challenge)
    return {"status": "error"}

@router.post("/whatsapp")
async def handle_whatsapp(request: Request):
    """Main handler for all incoming WhatsApp messages (Patients & Providers)."""
    data = await request.json()
    try:
        val = data['entry'][0]['changes'][0]['value']
        if 'messages' not in val: return {"ok": True}
        
        msg = val['messages'][0]
        phone = msg['from']

        # ==========================================
        # 🛡️ IDENTITY GATEKEEPER: CHECK PROVIDERS
        # ==========================================
        prov_res = db.table("providers").select("*").eq("phone_number", phone).execute()
        
        if prov_res.data and len(prov_res.data) > 0:
            provider = prov_res.data[0]
            p_id_val = provider["provider_id"]
            
            if msg.get("type") == "interactive":
                choice = msg['interactive'][msg['interactive']['type']]['id']
                
                # --- Accept Mission ---
                if choice.startswith("ACCEPT_"):
                    req_id = choice.replace("ACCEPT_", "")
                    
                    # 1. Fetch Full Data including Time Slot
                    req_res = db.table("service_requests").select("*, patients(*)").eq("request_id", req_id).execute()
                    if req_res.data:
                        req = req_res.data[0]
                        slot = req.get('requested_time_slot', '').lower()
                        today_str = datetime.now().strftime("%Y-%m-%d")

                        # 2. Update Request Status
                        db.table("service_requests").update({
                            "status": "Assigned", 
                            "provider_id": p_id_val
                        }).eq("request_id", req_id).execute()
                        
                        # 3. SMART BUSY LOGIC: Only block provider if job is for TODAY
                        if "today" in slot or today_str in slot:
                            db.table("providers").update({"status": "Busy"}).eq("provider_id", p_id_val).execute()
                        else:
                            # Keep them available for other immediate jobs if it's a future booking
                            db.table("providers").update({"status": "Available"}).eq("provider_id", p_id_val).execute()
                        
                        # 4. Confirm to Provider
                        send_magic_link(phone, req_id)
                        
                        # 5. Notify Patient with Advanced ETA Format
                        arrival_time = req.get('estimated_arrival') or "30 - 45 Minutes"
                        send_assignment_confirmation(
                            to=req['patients']['phone_number'],
                            req_id=req_id,
                            provider_name=provider['name'],
                            eta=arrival_time
                        )
                
                # --- Reject Mission ---
                elif choice.startswith("REJECT_"):
                    req_id = choice.replace("REJECT_", "")
                    db.table("service_requests").update({
                        "provider_id": None, 
                        "status": "Pending"
                    }).eq("request_id", req_id).execute()
                    
                    db.table("providers").update({"status": "Available"}).eq("provider_id", p_id_val).execute()
                    send_text(phone, "Mission declined. You remain *Available* for other nearby alerts. 🟢")
            
            # --- Provider Status Dashboard ---
            elif msg.get("type") == "text":
                active_res = db.table("service_requests").select("*").eq("provider_id", p_id_val).in_("status", ["Assigned", "In Progress", "Follow Up"]).execute()
                is_busy = len(active_res.data) > 0
                status_emoji = "🔴" if is_busy else "🟢"
                
                job_info = ""
                if is_busy:
                    mission = active_res.data[0]
                    job_info = f"\n\n📍 *Current Mission:* {mission.get('request_id')}\n🩺 *Service:* {mission.get('specific_procedure')}"
                
                send_text(phone, f"🏥 *Medizoom Dashboard*\n\nHello {provider['name']}!\nStatus: {status_emoji} *{'Busy' if is_busy else 'Available'}*{job_info}\n\nKeep this chat open for alerts.")
            
            return {"ok": True}

        # ==========================================
        # 🏥 PATIENT FLOW: BOOKING & FEEDBACK
        # ==========================================
        res = db.table("patients").select("*").eq("phone_number", phone).execute()
        patient = res.data[0] if res.data else db.table("patients").insert({"phone_number": phone, "context": "START"}).execute().data[0]
        p_id, ctx = patient['patient_id'], patient.get('context', 'START')

        # 1. Handle Location
        if msg.get("type") == "location":
            db.table("patients").update({
                "latitude": msg['location']['latitude'], 
                "longitude": msg['location']['longitude'], 
                "context": "AWAITING_SERVICE"
            }).eq("patient_id", p_id).execute()
            send_service_menu(phone)
            return {"ok": True}

        # 2. Handle Text
        if msg.get("type") == "text":
            text = msg['text']['body'].strip()
            
            if text.lower() in ["hi", "hello", "start"]:
                if patient.get("name"):
                    send_text(phone, f"Welcome back to MEDIZOOM, {patient['name']}! 👋")
                    send_service_menu(phone)
                    db.table("patients").update({"context": "AWAITING_SERVICE"}).eq("patient_id", p_id).execute()
                else:
                    send_text(phone, "Welcome to Medizoom! What is your full name?")
                    db.table("patients").update({"context": "AWAITING_NAME"}).eq("patient_id", p_id).execute()
            
            elif ctx == "AWAITING_NAME":
                db.table("patients").update({"name": text, "context": "AWAITING_AGE"}).eq("patient_id", p_id).execute()
                send_text(phone, "How old are you?")
                
            elif ctx == "AWAITING_AGE" and text.isdigit():
                db.table("patients").update({"age": int(text), "context": "AWAITING_GENDER"}).eq("patient_id", p_id).execute()
                ask_gender(phone)
                
            elif ctx == "AWAITING_LOCATION":
                db.table("patients").update({"full_address": text, "context": "AWAITING_SERVICE"}).eq("patient_id", p_id).execute()
                send_service_menu(phone)
                
            elif ctx.startswith("CUSTOM_DATE|"):
                parts = ctx.split("|")
                # Safety check
                if len(parts) >= 3:
                    db.table("patients").update({"context": f"SLOT_PICK|{parts[1]}|{text}|{parts[2]}"}).eq("patient_id", p_id).execute()
                    send_time_slots(phone, text)
                else:
                    send_text(phone, "Session expired. Please type 'Hi' to start over.")

        # 3. Handle Buttons
        elif msg.get("type") == "interactive":
            choice = msg['interactive'][msg['interactive']['type']]['id']
            
            if choice.startswith("rate_"):
                rating_val = int(choice.split("_")[1])
                recent = db.table("service_requests").select("*").eq("patient_id", p_id).eq("status", "Completed").order("created_at", desc=True).limit(1).execute()
                if recent.data:
                    db.table("service_requests").update({"rating": rating_val}).eq("request_id", recent.data[0]['request_id']).execute()
                send_text(phone, f"Thank you for your {rating_val}-Star rating! 🌟")

            elif choice.startswith("GENDER_"):
                db.table("patients").update({"gender": choice.split("_")[1], "context": "AWAITING_LOCATION"}).eq("patient_id", p_id).execute()
                ask_location(phone)
            
            elif choice.startswith("MAIN_"):
                db.table("patients").update({"context": f"SELECTING_{choice.split('_')[1]}"}).eq("patient_id", p_id).execute()
                send_procedure_list(phone, choice.split("_")[1])
            
            elif choice.startswith("PROC_"):
                cat = "Nurse" if "NURSE" in ctx else "Physiotherapy"
                proc_name = choice.replace('PROC_', '').replace('_', ' ').capitalize()
                db.table("patients").update({"context": f"DATE_PICK|{proc_name}|{cat}"}).eq("patient_id", p_id).execute()
                send_date_picker(phone)
            
            elif choice.startswith("DATE_"):
                parts = ctx.split("|") # Expected: DATE_PICK | proc | cat
                
                # 🛡️ SAFETY GUARD: Prevent IndexError
                if len(parts) < 3:
                    db.table("patients").update({"context": "START"}).eq("patient_id", p_id).execute()
                    send_text(phone, "Session expired. Please type 'Hi' to restart. 👋")
                    return {"ok": True}

                if choice == "DATE_LATER":
                    db.table("patients").update({"context": f"CUSTOM_DATE|{parts[1]}|{parts[2]}"}).eq("patient_id", p_id).execute()
                    send_text(phone, "Please type the specific date (e.g., '15 April'):")
                else:
                    d_val = datetime.now().strftime("%Y-%m-%d") if choice == "DATE_TODAY" else (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
                    db.table("patients").update({"context": f"SLOT_PICK|{parts[1]}|{d_val}|{parts[2]}"}).eq("patient_id", p_id).execute()
                    send_time_slots(phone, d_val)
            
            elif choice.startswith("TIME_"):
                t_val = choice.replace('TIME_', '')
                parts = ctx.split("|") # Expected: SLOT_PICK | proc | d_val | cat
                
                # 🛡️ SAFETY GUARD: Prevent IndexError
                if len(parts) < 4:
                    db.table("patients").update({"context": "START"}).eq("patient_id", p_id).execute()
                    send_text(phone, "Session expired or interrupted. Please type 'Hi' to restart your booking. 🔄")
                    return {"ok": True}
                
                proc = parts[1]
                d_val = parts[2]
                category = parts[3]
                
                mz_id = f"MZ-{uuid.uuid4().hex[:6].upper()}"
                
                db.table("service_requests").insert({
                    "request_id": mz_id, 
                    "patient_id": p_id, 
                    "service_type": category,
                    "specific_procedure": proc, 
                    "requested_time_slot": f"{d_val} at {t_val}", 
                    "status": "Pending", 
                    "source_channel": "WhatsApp"
                }).execute()
                
                db.table("patients").update({"context": "COMPLETED"}).eq("patient_id", p_id).execute()
                send_text(phone, f"✅ *Request Created!*\n\n🆔 ID: {mz_id}\n🩺 Service: {proc}\n📅 Date: {d_val}\n⏰ Time: {t_val}\n\nA clinician will be assigned shortly.")

    except Exception as e: 
        traceback.print_exc()
        print(f"❌ Webhook Error: {e}")
        
    return {"ok": True}