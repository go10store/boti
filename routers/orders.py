from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db
from routers.auth import get_current_user

router = APIRouter(prefix="/orders", tags=["Orders"])

@router.post("/", response_model=schemas.OrderOut)
def create_order(
    order: schemas.OrderCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != models.UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can order")
        
    new_order = models.Order(
        customer_id=current_user.id,
        driver_id=order.driver_id,
        amount=order.amount,
        delivery_lat=order.delivery_lat,
        delivery_lng=order.delivery_lng,
        delivery_address=order.delivery_address
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order

@router.get("/my", response_model=List[schemas.OrderOut])
def get_my_orders(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == models.UserRole.DRIVER:
        orders = db.query(models.Order).filter(models.Order.driver_id == current_user.id).all()
        # Enrich
        for o in orders:
             o.customer_name = o.customer.full_name
    else:
        orders = db.query(models.Order).filter(models.Order.customer_id == current_user.id).all()
        # Enrich
        for o in orders:
            o.driver_name = o.driver.full_name
            
    return orders

@router.get("/active", response_model=Optional[schemas.OrderOut])
def get_active_order(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Find active order (not completed or cancelled)
    statuses = [models.OrderStatus.PENDING, models.OrderStatus.ACCEPTED, models.OrderStatus.EN_ROUTE]
    
    if current_user.role == models.UserRole.CUSTOMER:
        order = db.query(models.Order).filter(
            models.Order.customer_id == current_user.id,
            models.Order.status.in_(statuses)
        ).first()
        if order:
             order.driver_name = order.driver.full_name
             if order.driver_id:
                 profile = db.query(models.DriverProfile).filter(models.DriverProfile.user_id == order.driver_id).first()
                 if profile:
                     order.driver_lat = profile.current_lat
                     order.driver_lng = profile.current_lng
                     order.driver_capacity = profile.capacity
    else:
        # For driver
        order = db.query(models.Order).filter(
            models.Order.driver_id == current_user.id,
            models.Order.status.in_(statuses)
        ).first()
        if order:
            order.customer_name = order.customer.full_name
            
    return order

@router.put("/{order_id}/status")
def update_order_status(
    order_id: int,
    status_update: schemas.OrderStatusUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    # Verify permission
    if current_user.role == models.UserRole.DRIVER and order.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your order")
    if current_user.role == models.UserRole.CUSTOMER and order.customer_id != current_user.id:
        # Customers can only cancel
        if status_update.status != models.OrderStatus.CANCELLED:
             raise HTTPException(status_code=403, detail="Customers can only cancel")
             
    order.status = status_update.status
    db.commit()

    # --- Trigger Notification ---
    from routers.notifications import send_notification_to_user
    
    # Notify Customer
    if current_user.role == models.UserRole.DRIVER:
        msg = f"تم تحديث حالة طلبك إلى: {status_update.status}"
        send_notification_to_user(order.customer_id, "تحديث الطلب", msg, db)
    
    # Notify Driver (if customer cancels)
    elif current_user.role == models.UserRole.CUSTOMER and status_update.status == models.OrderStatus.CANCELLED:
        send_notification_to_user(order.driver_id, "إلغاء الطلب", "قام العميل بإلغاء الطلب", db)

    return {"status": "updated"}
