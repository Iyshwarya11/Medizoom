import os
import tempfile
from datetime import datetime
from database import db # ⚠️ IMPORTANT: Ensure your standardized variable is 'db'
from jinja2 import Template
from playwright.sync_api import sync_playwright

def create_and_upload_pdf(request_id: str, amount: int) -> str:
    """Production-grade PDF generation using Synchronous Headless Chromium."""
    temp_pdf_path = None
    try:
        print(f"📄 [PDF] Fetching data for {request_id}...")
        
        # 1. FETCH FULL DATA
        res = db.table("service_requests").select("*, patients(*), providers(*)").eq("request_id", request_id).execute()
        if not res.data:
            raise Exception(f"Data missing for {request_id}")
            
        req_data = res.data[0]
        pat_data = req_data.get("patients") or {}
        prov_data = req_data.get("providers") or {}

        payment_status = req_data.get("payment_status") or "Pending Payment"
        balance_due = 0 if payment_status.lower() == "paid" else amount
        pay_method = req_data.get("payment_method") or ""

        # --- TIMESTAMPS FOR TIMELINE ---
        created_time = "--:--"
        if req_data.get("created_at"):
            try:
                # Clean up Supabase ISO string and format it
                raw_date = req_data["created_at"]
                if "." in raw_date: 
                    raw_date = raw_date.split(".")[0]
                raw_date = raw_date.replace("Z", "")
                dt = datetime.fromisoformat(raw_date)
                created_time = dt.strftime("%I:%M %p")
            except Exception as e:
                print(f"Time parsing error: {e}")
                
        completed_time = datetime.now().strftime("%I:%M %p")

        # 2. MAP DATA SAFELY
        context = {
            "request_id": request_id,
            "patient_name": pat_data.get("name") or "Unknown Patient",
            "age": pat_data.get("age") or "--",
            "address": pat_data.get("full_address") or "Address not recorded",
            "phone": pat_data.get("phone_number") or "--",
            "service_type": req_data.get("service_type") or "Medical Service",
            "provider_name": prov_data.get("name") or "Unassigned",
            "procedure": req_data.get("specific_procedure") or "Standard Care",
            "date": datetime.now().strftime("%B %d, %Y"),
            "amount": amount,
            "status": payment_status,
            "payment_method": pay_method,
            "transaction_id": req_data.get("transaction_id") or "--",
            "balance": balance_due,
            
            # Inject timeline variables
            "created_time": created_time,
            "completed_time": completed_time
        }

        # 3. RENDER HTML TEMPLATE
        template_path = os.path.join(os.getcwd(), "templates", "receipt_template.html")
        with open(template_path, "r", encoding="utf-8") as f:
            template_str = f.read()
            
        jinja_template = Template(template_str)
        html_content = jinja_template.render(context)

        # 4. GENERATE PDF WITH PLAYWRIGHT (Synchronous)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
            temp_pdf_path = tmp_file.name

        print("🌐 [PDF] Launching headless browser engine...")
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.set_content(html_content, wait_until="networkidle")
            page.pdf(
                path=temp_pdf_path,
                format="A4",
                print_background=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}
            )
            browser.close()

        # 5. UPLOAD TO SUPABASE STORAGE
        file_name = f"{request_id}_bill.pdf"
        bucket_name = "mission-report" 
        
        with open(temp_pdf_path, "rb") as f:
            db.storage.from_(bucket_name).upload(file_name, f, {"upsert": "true", "content-type": "application/pdf"})
            
        # 6. GET PUBLIC URL
        public_url = db.storage.from_(bucket_name).get_public_url(file_name)
        
        print(f"✅ [PDF] Successfully generated and uploaded: {public_url}")
        return public_url

    except Exception as e:
        print(f"❌ [PDF ERROR]: {e}")
        raise e
    finally:
        # 7. CLEANUP
        if temp_pdf_path and os.path.exists(temp_pdf_path):
            os.remove(temp_pdf_path)