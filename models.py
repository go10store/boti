from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from database import Base
import enum
from datetime import datetime

class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    DRIVER = "driver"
    ADMIN = "admin"

class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    EN_ROUTE = "en_route"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    phone = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default=UserRole.CUSTOMER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    driver_profile = relationship("DriverProfile", back_populates="user", uselist=False)
    orders_placed = relationship("Order", back_populates="customer", foreign_keys="Order.customer_id")
    orders_received = relationship("Order", back_populates="driver", foreign_keys="Order.driver_id")

class DriverProfile(Base):
    __tablename__ = "driver_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    truck_type = Column(String) # e.g., "12000 Liters", "Small"
    capacity = Column(Integer) # In Liters
    price = Column(Float) # Per Trip or Unit
    is_available = Column(Boolean, default=False)
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    last_location_update = Column(DateTime, nullable=True)
    average_rating = Column(Float, default=0.0)
    rating_count = Column(Integer, default=0)

    user = relationship("User", back_populates="driver_profile")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"))
    driver_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default=OrderStatus.PENDING)
    amount = Column(Float)
    delivery_lat = Column(Float)
    delivery_lng = Column(Float)
    delivery_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("User", foreign_keys=[customer_id], back_populates="orders_placed")
    driver = relationship("User", foreign_keys=[driver_id], back_populates="orders_received")
    review = relationship("Review", back_populates="order", uselist=False)

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    driver_id = Column(Integer, ForeignKey("users.id"))
    rating = Column(Integer) # 1-5
    comment = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="review")

class MessageType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    VOICE = "voice"
    LOCATION = "location"

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    sender_id = Column(Integer, ForeignKey("users.id"))
    content = Column(String) # Text content or URL to media
    message_type = Column(String, default=MessageType.TEXT)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="messages")
    sender = relationship("User")

# Add back_populates to Order
Order.messages = relationship("Message", back_populates="order", order_by="Message.created_at")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    body = Column(String)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

class NotificationSubscription(Base):
    __tablename__ = "notification_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    endpoint = Column(String)
    p256dh = Column(String)
    auth = Column(String)
    
    user = relationship("User")
