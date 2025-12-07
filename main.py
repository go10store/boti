import os
import json
import uuid
import requests
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Env Vars (Set these in Railway)
BIN_ID = os.environ.get("JSONBIN_ID", "675494d6ad19ca34f8d5f306") 
API_KEY = os.environ.get("JSONBIN_KEY", "$2a$10$wK1y/wQo/uX.T/Q.q/Q.qO")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "admin123")

# JSONBin Helpers
def get_db():
    try:
        url = f"https://api.jsonbin.io/v3/b/{BIN_ID}/latest"
        headers = {'X-Master-Key': API_KEY}
        resp = requests.get(url, headers=headers)
        if resp.status_code == 200:
            return resp.json().get('record', [])
        return []
    except:
        return []

def save_db(data):
    try:
        url = f"https://api.jsonbin.io/v3/b/{BIN_ID}"
        headers = {
            'Content-Type': 'application/json',
            'X-Master-Key': API_KEY
        }
        requests.put(url, json=data, headers=headers)
        return True
    except:
        return False

# Routes
@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# API: Register (Status = PENDING)
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    drivers = get_db()
    
    # Validation: Triple Name (at least 3 parts)
    name = data.get('name', '').strip()
    if len(name.split()) < 3:
        return jsonify({"success": False, "message": "يجب إدخال الاسم الثلاثي كاملاً"}), 400
    
    # Validation: Libyan Phone (09xxxxxxxx - 10 digits starting with 09)
    phone = data.get('phone', '').strip()
    if not (phone.startswith('09') and len(phone) == 10 and phone.isdigit()):
        return jsonify({"success": False, "message": "رقم الهاتف يجب أن يكون ليبي (09xxxxxxxx)"}), 400
    
    # Validation: Password (alphanumeric, min 4 chars)
    password = data.get('password', '').strip()
    if len(password) < 4:
        return jsonify({"success": False, "message": "كلمة المرور يجب أن تكون 4 أحرف على الأقل"}), 400
    
    new_driver = {
        "id": str(uuid.uuid4()),
        "name": name,
        "phone": phone,
        "password": password, # Changed from 'pin' to 'password'
        "price": data.get('price'),
        "source": data.get('source'),
        "location": data.get('location'),
        "bio": data.get('bio', ''),
        "truckType": data.get('truckType', ''),
        "capacity": data.get('capacity', ''),
        "workHours": data.get('workHours', ''),
        "workStatus": "AVAILABLE", # AVAILABLE, BUSY, EN_ROUTE
        "approvalStatus": "PENDING", # PENDING, APPROVED, REJECTED
        "priority": 0, # 0 = Normal, 10 = Top/First
        "deletionRequested": False,
        "createdAt": datetime.now().isoformat()
    }
    
    drivers.append(new_driver)
    save_db(drivers)
    
    return jsonify({"success": True, "message": "تم إرسال طلبك للإدارة للمراجعة"}), 201

# API: Public Drivers (Only APPROVED)
@app.route('/api/drivers', methods=['GET'])
def get_public_drivers():
    drivers = get_db()
    # Filter only approved and not deletion requested
    approved = [d for d in drivers if d.get('approvalStatus') == 'APPROVED' and not d.get('deletionRequested', False)]
    
    # Sort by priority (higher first), then by creation date
    approved.sort(key=lambda x: (-x.get('priority', 0), x.get('createdAt', '')))
    
    # Don't leak passwords/pins to public
    for d in approved:
        if 'pin' in d: del d['pin']
        if 'password' in d: del d['password']
        
    return jsonify(approved)

# API: Driver Login (Check Phone + Password)
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    phone = data.get('phone')
    password = data.get('password')
    
    drivers = get_db()
    driver = next((d for d in drivers if d.get('phone') == phone and d.get('password') == password), None)
    
    if driver:
        if driver.get('approvalStatus') != 'APPROVED':
             return jsonify({"success": False, "message": "حسابك قيد المراجعة من الإدارة"}), 403
        if driver.get('deletionRequested', False):
             return jsonify({"success": False, "message": "تم طلب حذف حسابك"}), 403
        return jsonify({"success": True, "driver": driver})
    
    return jsonify({"success": False, "message": "بيانات خاطئة"}), 401

# API: Update Status (Driver)
@app.route('/api/status', methods=['POST'])
def update_status():
    data = request.json
    driver_id = data.get('id')
    new_status = data.get('status')
    
    drivers = get_db()
    for d in drivers:
        if d['id'] == driver_id:
            d['workStatus'] = new_status
            save_db(drivers)
            return jsonify({"success": True})
            
    return jsonify({"success": False}), 404

# --- ADMIN ROUTES ---

@app.route('/admin')
def admin_page():
    # In a real app, use session auth. For MVP, we'll do simple JS/API auth.
    return send_from_directory('.', 'admin.html')

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.json
    if data.get('password') == ADMIN_PASS:
        return jsonify({"success": True, "token": "admin-token-demo"})
    return jsonify({"success": False}), 401

@app.route('/api/admin/drivers', methods=['GET'])
def get_all_drivers():
    # Protected endpoint (check token in headers in real app)
    # For MVP we trust the caller knows the hidden route or add simple check
    drivers = get_db()
    return jsonify(drivers)

@app.route('/api/admin/approve', methods=['POST'])
def approve_driver():
    data = request.json
    driver_id = data.get('id')
    action = data.get('action') # APPROVE or REJECT
    priority = data.get('priority', 0) # 0 = Normal, 10 = Top
    
    drivers = get_db()
    for d in drivers:
        if d['id'] == driver_id:
            d['approvalStatus'] = 'APPROVED' if action == 'APPROVE' else 'REJECTED'
            if action == 'APPROVE':
                d['priority'] = priority
            save_db(drivers)
            return jsonify({"success": True})
            
    return jsonify({"success": False}), 404

# API: Driver Request Account Deletion
@app.route('/api/driver/delete-request', methods=['POST'])
def request_deletion():
    data = request.json
    driver_id = data.get('id')
    
    drivers = get_db()
    for d in drivers:
        if d['id'] == driver_id:
            d['deletionRequested'] = True
            save_db(drivers)
            return jsonify({"success": True, "message": "تم إرسال طلب الحذف للإدارة"})
            
    return jsonify({"success": False}), 404

# API: Admin Delete Driver Permanently
@app.route('/api/admin/delete', methods=['POST'])
def delete_driver():
    data = request.json
    driver_id = data.get('id')
    
    drivers = get_db()
    drivers = [d for d in drivers if d['id'] != driver_id]
    save_db(drivers)
    
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)

