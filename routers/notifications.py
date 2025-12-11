from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
import models, schemas
from database import get_db
from security import get_current_user
from pywebpush import webpush, WebPushException
import logging
import json

router = APIRouter(prefix="/notifications", tags=["Notifications"])

# --- Configuration ---
VAPID_PRIVATE_KEY = "Z6aNQAJl07qi8ZXtmij0kvwfEJ2bpe54bnOgP7KF9DI"
VAPID_CLAIMS = {"sub": "mailto:admin@example.com"}

@router.get("/public_key")
def get_public_key():
    return {"publicKey": "BO_BbvrccfZ0z9DD5T1sGIhE8uPloM9-HwXgucungbLUSYwIbiC29ll-j9VSPlTFV-u32RipoRw3TYYF20IBbl8"}

@router.post("/subscribe")
def subscribe(subscription: dict = Body(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Check if exists
    existing = db.query(models.NotificationSubscription).filter(
        models.NotificationSubscription.user_id == current_user.id,
        models.NotificationSubscription.endpoint == subscription.get('endpoint')
    ).first()

    if not existing:
        keys = subscription.get('keys', {})
        new_sub = models.NotificationSubscription(
            user_id=current_user.id,
            endpoint=subscription.get('endpoint'),
            p256dh=keys.get('p256dh'),
            auth=keys.get('auth')
        )
        db.add(new_sub)
        db.commit()
    
    return {"status": "success"}

def send_notification_to_user(user_id: int, title: str, body: str, db: Session):
    # 1. Save to database (in-app history)
    notif = models.Notification(user_id=user_id, title=title, body=body)
    db.add(notif)
    db.commit()

    # 2. Send Push
    subs = db.query(models.NotificationSubscription).filter(models.NotificationSubscription.user_id == user_id).all()
    for sub in subs:
        try:
            subscription_info = {
                "endpoint": sub.endpoint,
                "keys": {
                    "p256dh": sub.p256dh,
                    "auth": sub.auth
                }
            }
            webpush(
                subscription_info=subscription_info,
                data=json.dumps({"title": title, "body": body}),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS
            )
        except WebPushException as ex:
            logging.error(f"Push failed for user {user_id}: {ex}")
            # Optionally remove invalid subscription here
