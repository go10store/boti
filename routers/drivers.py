from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db
from routers.auth import get_current_user

router = APIRouter(prefix="/drivers", tags=["Drivers"])

@router.get("/profile", response_model=schemas.DriverProfileOut)
def get_my_profile(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != models.UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Not a driver")
    
    profile = db.query(models.DriverProfile).filter(models.DriverProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    profile.driver_name = current_user.full_name
    return profile

@router.put("/profile", response_model=schemas.DriverProfileOut)
def update_profile(
    profile_update: schemas.DriverProfileCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != models.UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Not a driver")
    
    profile = db.query(models.DriverProfile).filter(models.DriverProfile.user_id == current_user.id).first()
    
    profile.truck_type = profile_update.truck_type
    profile.capacity = profile_update.capacity
    profile.price = profile_update.price
    
    db.commit()
    db.refresh(profile)
    return profile

@router.post("/status", response_model=schemas.DriverProfileOut)
def toggle_status(
    is_available: bool,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != models.UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Not a driver")
        
    profile = db.query(models.DriverProfile).filter(models.DriverProfile.user_id == current_user.id).first()
    profile.is_available = is_available
    db.commit()
    db.refresh(profile)
    return profile

@router.post("/location")
def update_location(
    location: schemas.LocationUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != models.UserRole.DRIVER:
        raise HTTPException(status_code=403, detail="Not a driver")
        
    profile = db.query(models.DriverProfile).filter(models.DriverProfile.user_id == current_user.id).first()
    profile.current_lat = location.lat
    profile.current_lng = location.lng
    
    db.commit()
    return {"status": "updated"}

@router.get("/nearby", response_model=List[schemas.DriverProfileOut])
def get_nearby_drivers(lat: float, lng: float, db: Session = Depends(get_db)):
    # Simple bounding box or just return all available for MVP
    # Returning all available drivers
    drivers = db.query(models.DriverProfile).filter(models.DriverProfile.is_available == True).all()
    
    # Enrich with names
    results = []
    for d in drivers:
        d.driver_name = d.user.full_name
        results.append(d)
        
    return results
