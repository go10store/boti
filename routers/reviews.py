from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db
from routers.auth import get_current_user

router = APIRouter(prefix="/reviews", tags=["Reviews"])

@router.post("/{order_id}", response_model=schemas.ReviewOut)
def create_review(
    order_id: int,
    review: schemas.ReviewCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Check if order exists
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # 2. Check permissions (Must be the customer of the order)
    if order.customer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    
    # 3. Check if order is completed
    if order.status != models.OrderStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Order must be completed to review")

    # 4. Check if already reviewed
    if db.query(models.Review).filter(models.Review.order_id == order_id).first():
        raise HTTPException(status_code=400, detail="Already reviewed")

    # 5. Create Review
    new_review = models.Review(
        order_id=order_id,
        driver_id=order.driver_id,
        rating=review.rating,
        comment=review.comment
    )
    db.add(new_review)
    
    # 6. Update Driver's Average Rating
    driver_profile = db.query(models.DriverProfile).filter(models.DriverProfile.user_id == order.driver_id).first()
    if driver_profile:
        # Calculate new average
        # (old_avg * old_count + new_rating) / (old_count + 1)
        current_total = driver_profile.average_rating * driver_profile.rating_count
        driver_profile.rating_count += 1
        driver_profile.average_rating = (current_total + review.rating) / driver_profile.rating_count
    
    db.commit()
    db.refresh(new_review)
    
    return {
        "id": new_review.id,
        "rating": new_review.rating,
        "comment": new_review.comment,
        "driver_id": new_review.driver_id,
        "customer_name": current_user.full_name,
        "created_at": new_review.created_at
    }

@router.get("/driver/{driver_id}", response_model=List[schemas.ReviewOut])
def get_driver_reviews(driver_id: int, db: Session = Depends(get_db)):
    reviews = db.query(models.Review).filter(models.Review.driver_id == driver_id).all()
    
    results = []
    for r in reviews:
        # Fetch customer name manually since it's via order relation
        # Or simplistic approach:
        customer = db.query(models.User).filter(models.User.id == r.order.customer_id).first()
        customer_name = customer.full_name if customer else "Unknown"
        
        results.append({
            "id": r.id,
            "rating": r.rating,
            "comment": r.comment,
            "driver_id": r.driver_id,
            "customer_name": customer_name,
            "created_at": r.created_at
        })
        
    return results
