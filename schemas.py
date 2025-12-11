from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from models import UserRole, OrderStatus

# --- User Schemas ---
class UserBase(BaseModel):
    phone: str
    full_name: str

class UserCreate(UserBase):
    password: str
    role: str = "customer"

class UserOut(UserBase):
    id: int
    role: str
    is_active: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_id: int
    full_name: str

class TokenData(BaseModel):
    phone: Optional[str] = None

# --- Driver Schemas ---
class DriverProfileBase(BaseModel):
    truck_type: str
    capacity: int
    price: float

class DriverProfileCreate(DriverProfileBase):
    pass

class DriverProfileOut(DriverProfileBase):
    id: int
    user_id: int
    is_available: bool
    current_lat: Optional[float]
    current_lng: Optional[float]
    average_rating: float = 0.0
    rating_count: int = 0
    driver_name: Optional[str] = None # Enriched field
    phone_number: Optional[str] = None # Enriched field

    class Config:
        from_attributes = True

class LocationUpdate(BaseModel):
    lat: float
    lng: float

# --- Order Schemas ---
class OrderBase(BaseModel):
    driver_id: int
    amount: float
    delivery_lat: float
    delivery_lng: float
    delivery_address: Optional[str] = None

class OrderCreate(OrderBase):
    pass

class OrderOut(OrderBase):
    id: int
    customer_id: int
    status: str
    created_at: datetime
    customer_name: Optional[str] = None # Enriched
    driver_name: Optional[str] = None # Enriched
    driver_lat: Optional[float] = None # Enriched
    driver_lng: Optional[float] = None # Enriched
    driver_capacity: Optional[int] = None # Enriched

    class Config:
        from_attributes = True

class DriverStatsOut(BaseModel):
    orders_today: int
    earnings_today: float
    total_rating: float
    hours_online: float

class OrderStatusUpdate(BaseModel):
    status: str

# --- Review Schemas ---
class ReviewCreate(BaseModel):
    rating: int
    comment: Optional[str] = None

class ReviewOut(ReviewCreate):
    id: int
    driver_id: int
    customer_name: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Chat Schemas ---
class MessageCreate(BaseModel):
    content: str
    message_type: str = "text"

class MessageOut(MessageCreate):
    id: int
    order_id: int
    sender_id: int
    created_at: datetime
    is_read: bool

    class Config:
        from_attributes = True

# --- Notification Schemas ---
class NotificationOut(BaseModel):
    id: int
    title: str
    body: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
