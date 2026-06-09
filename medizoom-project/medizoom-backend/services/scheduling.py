from datetime import datetime

class SchedulingService:
    @staticmethod
    def get_time_slots(selected_date_str: str):
        """Generates 9 AM to 6 PM slots to perfectly match WhatsApp's 10-row limit."""
        # WhatsApp STRICTLY limits lists to a maximum of 10 items.
        slots = [
            ("09:00 AM", 9), ("10:00 AM", 10), ("11:00 AM", 11), ("12:00 PM", 12), 
            ("01:00 PM", 13), ("02:00 PM", 14), ("03:00 PM", 15), ("04:00 PM", 16), 
            ("05:00 PM", 17), ("06:00 PM", 18)
        ]
        
        now = datetime.now()
        is_today = selected_date_str == now.strftime('%Y-%m-%d')
        
        available_slots = []
        for label, hr in slots:
            # Deduce past times if the date is Today
            if is_today and hr <= now.hour:
                continue
            
            available_slots.append({
                "id": f"TIME_{label.replace(' ', '')}", 
                "title": label
            })
            
        # Failsafe: Ensure we never ever send more than 10 to Meta
        return available_slots[:10]