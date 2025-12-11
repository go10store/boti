from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, schemas
from database import get_db
from security import get_current_user
from routers.notifications import send_notification_to_user

router = APIRouter(prefix="/safety", tags=["Safety"])

@router.post("/sos")
def trigger_sos(
    lat: float, 
    lng: float, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Log the SOS
    # For MVP, we just create a critical notification for the system admin (if exists) 
    # OR since we don't have Admin panel yet, we will just Log it and maybe notify the user "Help requested"
    
    # Send notification to User confirming
    # send_notification_to_user(current_user.id, "تم استلام استغاثة", "تم إبلاغ فريق الدعم وسنتواصل معك فوراً", db)
    
    # In real app: Notify Admin, Send SMS, etc.
    # For now: Log to console
    print(f"SOS TRIGGERED by User {current_user.id} ({current_user.full_name}) at {lat}, {lng}")
    
    return {"status": "sos_received", "message": "تم إرسال طلب الاستغاثة بنجاح"}
