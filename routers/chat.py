from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Dict
import models, schemas
from database import get_db
from security import get_current_user

router = APIRouter(prefix="/chat", tags=["Chat"])

# --- WebSocket Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {} # order_id: [websockets]

    async def connect(self, websocket: WebSocket, order_id: int):
        await websocket.accept()
        if order_id not in self.active_connections:
            self.active_connections[order_id] = []
        self.active_connections[order_id].append(websocket)

    def disconnect(self, websocket: WebSocket, order_id: int):
        if order_id in self.active_connections:
            self.active_connections[order_id].remove(websocket)
            if not self.active_connections[order_id]:
                del self.active_connections[order_id]

    async def broadcast(self, message: str, order_id: int):
        if order_id in self.active_connections:
            for connection in self.active_connections[order_id]:
                await connection.send_text(message)

manager = ConnectionManager()

# --- Endpoints ---

@router.get("/{order_id}", response_model=List[schemas.MessageOut])
def get_chat_history(order_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Verify access
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.id != order.customer_id and current_user.id != order.driver_id:
        raise HTTPException(status_code=403, detail="Not allowed")

    return order.messages

@router.websocket("/ws/{order_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, order_id: int, user_id: int, db: Session = Depends(get_db)):
    # Note: WebSocket cannot easily use Depends(get_current_user) with headers, usually done via query param token
    # For simplicity here, we trust the connection or validate token manually if passed in query
    await manager.connect(websocket, order_id)
    try:
        while True:
            data = await websocket.receive_text()
            import json
            try:
                msg_in = json.loads(data)
                content = msg_in.get("content")
                msg_type = msg_in.get("type", "text")
            except:
                content = data
                msg_type = "text"

            # Save to DB
            message = models.Message(
                order_id=order_id,
                sender_id=user_id,
                content=content,
                message_type=msg_type
            )
            db.add(message)
            db.commit()
            db.refresh(message)
            
            # Broadcast
            msg_data = json.dumps({
                "id": message.id,
                "content": message.content,
                "sender_id": message.sender_id,
                "message_type": message.message_type,
                "created_at": str(message.created_at)
            })
            await manager.broadcast(msg_data, order_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, order_id)
