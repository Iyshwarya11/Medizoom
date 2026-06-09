from pydantic import BaseModel
from typing import Optional
from uuid import UUID

class ServiceRequestCreate(BaseModel):
    request_id: str
    patient_id: UUID
    service_type: str 
    specific_procedure: str
    requested_time_slot: str
    status: str = "Awaiting Dispatch"
    source_channel: str = "WhatsApp"