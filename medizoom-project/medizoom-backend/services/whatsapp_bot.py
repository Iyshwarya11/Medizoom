import os
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv
from services.scheduling import SchedulingService

# CRITICAL: Load the .env file BEFORE grabbing the token
load_dotenv()

ACCESS_TOKEN = os.environ.get("META_ACCESS_TOKEN")
PHONE_NUMBER_ID = os.environ.get("META_PHONE_NUMBER_ID")
FB_URL = f"https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages"

# --- CORE META API SENDER ---

def send_meta(payload):
    """Base function to send any payload to the Meta WhatsApp Business API."""
    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}", 
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(FB_URL, json=payload, headers=headers)
        if response.status_code != 200:
            print(f"❌ META API ERROR: {response.status_code} | Details: {response.json()}")
        return response
    except Exception as e:
        print(f"❌ Network Error calling Meta: {e}")
        return None

def send_text(to, msg):
    """Sends a standard text message."""
    send_meta({
        "messaging_product": "whatsapp", 
        "to": to, 
        "type": "text", 
        "text": {"body": msg}
    })

# --- PATIENT ONBOARDING & BOOKING FLOW ---

def ask_gender(to):
    """Asks the patient to select their gender via buttons."""
    send_meta({
        "messaging_product": "whatsapp", 
        "to": to, 
        "type": "interactive", 
        "interactive": {
            "type": "button", 
            "body": {"text": "To provide the most suitable care provider, please select the patient's gender:"},
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": "GENDER_MALE", "title": "Male"}}, 
                    {"type": "reply", "reply": {"id": "GENDER_FEMALE", "title": "Female"}}
                ]
            }
        }
    })

def ask_location(to):
    """Instructions for location sharing."""
    send_text(to, "📍 *Location Required*\n\nPlease share your current location (tap 📎 > Location) or type your complete home address for our team to reach you.")

def send_service_menu(to):
    """Main service selection menu."""
    send_meta({
        "messaging_product": "whatsapp", 
        "to": to, 
        "type": "interactive", 
        "interactive": {
            "type": "button", 
            "body": {"text": "*Clinical Requirement*\n\nWhat type of healthcare professional do you require?"},
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": "MAIN_NURSE", "title": "Nursing Care"}}, 
                    {"type": "reply", "reply": {"id": "MAIN_PHYSIO", "title": "Physiotherapy"}}
                ]
            }
        }
    })

def send_procedure_list(to, stype):
    """Sends an expanded list of specific procedures based on service type."""
    title = "Nursing Procedures" if stype == "NURSE" else "Physiotherapy Care"
    body_text = "Please select the specific clinical procedure required for the patient:"
    
    if stype == "NURSE":
        rows = [
            {"id": "PROC_INJECTION", "title": "Injection Service", "description": "IM/SC Injections"},
            {"id": "PROC_IV_CANNULA", "title": "IV / Cannula", "description": "Drip/IV Line Insertion"},
            {"id": "PROC_VITALS", "title": "Vital Monitoring", "description": "BP, Sugar, SpO2 Check"},
            {"id": "PROC_DRESSING", "title": "Wound Care/Dressing", "description": "Post-op/Injury Care"},
            {"id": "PROC_CATHETER", "title": "Catheter Management", "description": "Insertion/Removal"}
        ]
    else:
        rows = [
            {"id": "PROC_MOBILITY", "title": "Mobility Training", "description": "Walking/Movement Support"},
            {"id": "PROC_POST_SURGICAL", "title": "Post-surgical Rehab", "description": "Recovery after surgery"},
            {"id": "PROC_STROKE", "title": "Stroke Rehabilitation", "description": "Post-stroke neuro care"},
            {"id": "PROC_PAIN", "title": "Pain Management", "description": "Chronic pain relief"}
        ]

    send_meta({
        "messaging_product": "whatsapp", 
        "to": to, 
        "type": "interactive", 
        "interactive": {
            "type": "list", 
            "header": {"type": "text", "text": title}, 
            "body": {"text": body_text}, 
            "action": {
                "button": "Select Procedure", 
                "sections": [
                    {
                        "title": "Available Services", 
                        "rows": rows
                    }
                ]
            }
        }
    })

def send_date_picker(to):
    """Standard date options."""
    today = datetime.now()
    rows = [
        {"id": "DATE_TODAY", "title": "Schedule for Today", "description": today.strftime("%A, %d %b")},
        {"id": "DATE_TOMORROW", "title": "Schedule Tomorrow", "description": (today + timedelta(days=1)).strftime("%A, %d %b")},
        {"id": "DATE_LATER", "title": "Custom Schedule", "description": "Speak with a coordinator"}
    ]
    send_meta({
        "messaging_product": "whatsapp", 
        "to": to, 
        "type": "interactive", 
        "interactive": {
            "type": "list", 
            "header": {"type": "text", "text": "Scheduling"}, 
            "body": {"text": "When would you like our professional to visit your location?"}, 
            "action": {
                "button": "Select Date", 
                "sections": [{"title": "Available Dates", "rows": rows}]
            }
        }
    })

def send_time_slots(to, date_str):
    """Fetches and displays available time slots."""
    rows = SchedulingService.get_time_slots(date_str)
    
    if not rows:
        send_text(to, "⚠️ Our clinicians are currently fully booked for this date. Please select an alternative date.")
        return send_date_picker(to)
        
    send_meta({
        "messaging_product": "whatsapp", 
        "to": to, 
        "type": "interactive", 
        "interactive": {
            "type": "list", 
            "header": {"type": "text", "text": "Select Time Slot"}, 
            "body": {"text": f"Confirmed clinical slots for {date_str}:"},
            "action": {
                "button": "View Hourly Slots", 
                "sections": [{"title": "Preferred Time", "rows": rows}]
            }
        }
    })

# --- PROVIDER ALERTS & MAGIC LINKS ---

def send_job_offer(to, req_id, patient_name, service_type, procedure, address, time_slot):
    """Sends a professional dispatch alert to the Provider."""
    text = (
        f"🚨 *NEW MISSION DISPATCH*\n\n"
        f"*Mission ID:* {req_id}\n"
        f"*Clinician Needed:* {service_type}\n"
        f"*Procedure:* {procedure}\n\n"
        f"📍 *Patient Address:*\n{address}\n\n"
        f"⏰ *Requested Slot (ETA):*\n{time_slot}\n\n"
        f"Do you confirm your availability for this mission?"
    )
    
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": text},
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": f"ACCEPT_{req_id}", "title": "✅ Accept Mission"}},
                    {"type": "reply", "reply": {"id": f"REJECT_{req_id}", "title": "❌ Decline"}}
                ]
            }
        }
    }
    return send_meta(payload)

def send_magic_link(to, req_id):
    """Sends the secure mission link to the provider."""
    # Production Next.js URL
    link = f"https://lifecorepharma.in/medizoom/mission/{req_id}"
    
    msg = (
        f"Mission Confirmed! ✅\n\n"
        f"Your deployment for Case *#{req_id}* is now active. "
        f"Access patient vitals, history, and report tools here:\n\n"
        f"🔗 {link}\n\n"
        f"_Please mark 'In Progress' upon arrival._"
    )
    send_text(to, msg)

# --- PATIENT CONFIRMATION (PRODUCTION-GRADE FORMATTING) ---

def send_assignment_confirmation(to, req_id, provider_name, eta):
    """
    Sends a high-end professional mission confirmation to the Patient 
    once a clinician accepts the job.
    """
    text = (
        f"🌟 *MISSION CONFIRMED*\n\n"
        f"Good news! Your Medi-Zoom care request *#{req_id}* has been accepted. "
        f"Our professional is now preparing for transit.\n\n"
        f"👨‍⚕️ *Clinician:* {provider_name}\n"
        f"⏱️ *Estimated Arrival:* {eta}\n\n"
        f"--- \n"
    
    )
    
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text}
    }
    return send_meta(payload)

# --- POST-MISSION BILLING & FEEDBACK ---

def send_receipt_pdf(to, pdf_url):
    """Sends the generated PDF bill to the patient."""
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "document",
        "document": {
            "link": pdf_url,
            "filename": "MediZoom_Invoice.pdf",
            "caption": "🩺 *Medi-Zoom Care Summary*\n\nThank you for choosing Medi-Zoom. Please find your official service report and digital receipt attached below."
        }
    }
    return send_meta(payload)

def send_star_rating_menu(to):
    """Sends the interactive 5-Star menu to the patient for feedback."""
    payload = {
        "messaging_product": "whatsapp", 
        "to": to, 
        "type": "interactive", 
        "interactive": {
            "type": "list", 
            "header": {
                "type": "text",
                "text": "Care Feedback 🩺"
            },
            "body": {
                "text": "Your session has been successfully closed and payment recorded.\n\nWe value your health—how would you rate the quality of care provided by our professional today?"
            },
            "footer": {
                "text": "Select your rating below"
            },
            "action": {
                "button": "Submit Rating", 
                "sections": [
                    {
                        "title": "Clinical Experience",
                        "rows": [
                            {"id": "rate_5", "title": "⭐⭐⭐⭐⭐", "description": "Excellent Professional Care"},
                            {"id": "rate_4", "title": "⭐⭐⭐⭐", "description": "Good & Satisfactory"},
                            {"id": "rate_3", "title": "⭐⭐⭐", "description": "Average Experience"},
                            {"id": "rate_2", "title": "⭐⭐", "description": "Below Expectations"},
                            {"id": "rate_1", "title": "⭐", "description": "Unsatisfied with service"}
                        ]
                    }
                ]
            }
        }
    }
    return send_meta(payload)