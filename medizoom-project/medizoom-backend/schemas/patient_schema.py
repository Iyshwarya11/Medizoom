from pydantic import BaseModel
from typing import Optional

class PatientBase(BaseModel):
    phone_number: str
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    full_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    context: Optional[str] = "START"