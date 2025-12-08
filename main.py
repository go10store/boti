import os
import json
import uuid
import requests
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Env Vars (Set these in Railway or your environment)
BIN_ID = os.environ.get("JSONBIN_ID", "675494d6ad19ca34f8d5f306") 
API_KEY = os.environ.get("JSONBIN_KEY", "$2a$10$wK1y/wQo/uX.T/Q.q/Q.qO")
ADMIN_PASS = os.environ.get("ADMIN_PASS", "admin123")

# Orders BIN Configuration
ORDERS_BIN_ID = os.environ.get("ORDERS_JSONBIN_ID", "")
ORDERS_API_KEY = os.environ.get("ORDERS_JSONBIN_KEY", "")

# Local storage file paths
DRIVERS_FILE = "drivers_local.json"
ORDERS_FILE = "orders_local.json"

print(f"BIN_ID: {BIN_ID}")
print(f"API_KEY: {API_KEY[:5]}...{API_KEY[-5:] if len(API_KEY) > 10 else ''}")
print(f"ORDERS_BIN_ID: {ORDERS_BIN_ID}")
print(f"ORDERS_API_KEY: {ORDERS_API_KEY[:5]}...{ORDERS_API_KEY[-5:] if len(ORDERS_API_KEY) > 10 else ''}")

# File-based storage helpers
def load_from_file(filename, default_value):
    """Load data from local file, return default if file doesn't exist"""
    try:
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            # Create file with default value
            save_to_file(filename, default_value)
            return default_value
    except Exception as e:
        print(f"Error loading from file {filename}: {e}")
        return default_value

def save_to_file(filename, data):
    """Save data to local file"""
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving to file {filename}: {e}")
        return False

# JSONBin Helpers
def get_db():
    try:
        url = f"https://api.jsonbin.io/v3/b/{BIN_ID}/latest"
        headers = {'X-Master-Key': API_KEY}
        print(f"Fetching drivers from: {url}")
        resp = requests.get(url, headers=headers)
        print(f"Response status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json().get('record', [])
            print(f"Retrieved {len(data)} drivers from JSONBin")
            # Also save to local file as backup
            save_to_file(DRIVERS_FILE, data)
            return data
        elif resp.status_code == 404:
            print(f"BIN not found. Loading from local file.")
            # Load from local file
            data = load_from_file(DRIVERS_FILE, [])
            return data
        else:
            print(f"Failed to fetch drivers: {resp.text}")
            # Load from local file as fallback
            data = load_from_file(DRIVERS_FILE, [])
            return data
    except Exception as e:
        print(f"Error getting drivers DB: {e}")
        # Load from local file as fallback
        data = load_from_file(DRIVERS_FILE, [])
        return data

def save_db(data):
    try:
        url = f"https://api.jsonbin.io/v3/b/{BIN_ID}"
        headers = {
            'Content-Type': 'application/json',
            'X-Master-Key': API_KEY
        }
        print(f"Saving {len(data)} drivers to: {url}")
        response = requests.put(url, json=data, headers=headers)
        print(f"Save response status: {response.status_code}")
        if response.status_code in [200, 201]:
            print("Successfully saved to JSONBin")
            # Also save to local file as backup
            save_to_file(DRIVERS_FILE, data)
            return True
        elif response.status_code == 401:
            print("Invalid API key. Saving to local file only.")
            save_to_file(DRIVERS_FILE, data)
            return True
        elif response.status_code == 404:
            print("BIN not found. Saving to local file only.")
            save_to_file(DRIVERS_FILE, data)
            return True
        else:
            print(f"Failed to save drivers: {response.text}")
            # Save to local file as fallback
            save_to_file(DRIVERS_FILE, data)
            return True
    except Exception as e:
        print(f"Error saving drivers DB: {e}")
        # Save to local file as fallback
        save_to_file(DRIVERS_FILE, data)
        return True

# Orders JSONBin Helpers
def get_orders_db():
    # If no orders BIN is configured, fallback to local file
    if not ORDERS_BIN_ID or not ORDERS_API_KEY:
        print("Orders BIN not configured, using local file storage")
        return load_from_file(ORDERS_FILE, [])
    
    try:
        url = f"https://api.jsonbin.io/v3/b/{ORDERS_BIN_ID}/latest"
        headers = {'X-Master-Key': ORDERS_API_KEY}
        print(f"Fetching orders from: {url}")
        resp = requests.get(url, headers=headers)
        print(f"Orders response status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json().get('record', [])
            print(f"Retrieved {len(data)} orders from JSONBin")
            # Also save to local file as backup
            save_to_file(ORDERS_FILE, data)
            return data
        elif resp.status_code == 404:
            print(f"Orders BIN not found. Loading from local file.")
            # Load from local file
            data = load_from_file(ORDERS_FILE, [])
            return data
        else:
            print(f"Failed to fetch orders: {resp.text}")
            # Load from local file as fallback
            data = load_from_file(ORDERS_FILE, [])
            return data
    except Exception as e:
        print(f"Error getting orders DB: {e}")
        # Load from local file as fallback
        data = load_from_file(ORDERS_FILE, [])
        return data

def save_orders_db(data):
    # If no orders BIN is configured, fallback to local file
    if not ORDERS_BIN_ID or not ORDERS_API_KEY:
        save_to_file(ORDERS_FILE, data)
        return True
    
    try:
        url = f"https://api.jsonbin.io/v3/b/{ORDERS_BIN_ID}"
        headers = {
            'Content-Type': 'application/json',
            'X-Master-Key': ORDERS_API_KEY
        }
        print(f"Saving {len(data)} orders to: {url}")
        response = requests.put(url, json=data, headers=headers)
        print(f"Save orders response status: {response.status_code}")
        if response.status_code in [200, 201]:
            print("Successfully saved orders to JSONBin")
            # Also save to local file as backup
            save_to_file(ORDERS_FILE, data)
            return True
        elif response.status_code == 401:
            print("Invalid orders API key. Saving to local file only.")
            save_to_file(ORDERS_FILE, data)
            return True
        elif response.status_code == 404:
            print("Orders BIN not found. Saving to local file only.")
            save_to_file(ORDERS_FILE, data)
            return True
        else:
            print(f"Failed to save orders: {response.text}")
            # Save to local file as fallback
            save_to_file(ORDERS_FILE, data)
            return True
    except Exception as e:
        print(f"Error saving orders DB: {e}")
        # Save to local file as fallback
        save_to_file(ORDERS_FILE, data)
        return True

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

# API: Admin Set Driver Priority
@app.route('/api/admin/priority', methods=['POST'])
def set_priority():
    data = request.json
    driver_id = data.get('id')
    priority = data.get('priority', 0)
    
    drivers = get_db()
    for d in drivers:
        if d['id'] == driver_id:
            d['priority'] = priority
            save_db(drivers)
            return jsonify({"success": True})
            
    return jsonify({"success": False}), 404

# API: Update Driver Profile
@app.route('/api/profile', methods=['POST'])
def update_profile():
    data = request.json
    driver_id = data.get('id')
    updates = {k: v for k, v in data.items() if k != 'id'}
    
    drivers = get_db()
    for d in drivers:
        if d['id'] == driver_id and d.get('approvalStatus') == 'APPROVED':
            # Update allowed fields
            for key, value in updates.items():
                if key in ['phone', 'price']:
                    d[key] = value
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


# In-memory storage for orders (in production, this should be in a database)
orders = []

# API: Place Order
@app.route('/api/place-order', methods=['POST'])
def place_order():
    data = request.json
    
    # Validate required fields
    if not all(k in data for k in ('driverId', 'customerName', 'customerPhone')):
        return jsonify({"success": False, "message": "جميع الحقول مطلوبة"}), 400
    
    # Validate phone number
    phone = data.get('customerPhone', '').strip()
    if not (phone.startswith('09') and len(phone) == 10 and phone.isdigit()):
        return jsonify({"success": False, "message": "رقم الهاتف يجب أن يكون ليبي (09xxxxxxxx)"}), 400
    
    # Get existing orders
    orders = get_orders_db()
    
    # Create order
    order = {
        "id": str(uuid.uuid4()),
        "driverId": data.get('driverId'),
        "customerName": data.get('customerName'),
        "customerPhone": phone,
        "notes": data.get('notes', ''),
        "timestamp": data.get('timestamp'),
        "status": "PENDING",  # PENDING, APPROVED, REJECTED
        "response": ""
    }
    
    orders.append(order)
    save_orders_db(orders)
    
    return jsonify({"success": True, "message": "تم إرسال الطلب بنجاح"}), 201

# API: Get Orders (for admin)
@app.route('/api/orders', methods=['GET'])
def get_orders():
    orders = get_orders_db()
    return jsonify(orders)

# API: Respond to Order
@app.route('/api/respond-order', methods=['POST'])
def respond_order():
    data = request.json
    order_id = data.get('orderId')
    response = data.get('response')  # APPROVE or REJECT
    message = data.get('message', '')
    
    # Get existing orders
    orders = get_orders_db()
    
    for order in orders:
        if order['id'] == order_id:
            order['status'] = 'APPROVED' if response == 'APPROVE' else 'REJECTED'
            order['response'] = message
            
            # Save updated orders
            save_orders_db(orders)
            
            # In a real application, we would send an SMS or push notification to the customer
            # For this demo, we'll just log the action
            print(f"Order {order_id} {order['status']} with message: {message}")
            
            return jsonify({"success": True, "message": "تم تحديث حالة الطلب"})
    
    return jsonify({"success": False, "message": "الطلب غير موجود"}), 404

if __name__ == '__main__':
    # Test the database connection
    print("Testing database connection...")
    drivers = get_db()
    print(f"Current drivers count: {len(drivers)}")
    
    # Add a test driver if database is empty
    if len(drivers) == 0:
        print("Adding test driver...")
        test_driver = {
            "id": str(uuid.uuid4()),
            "name": "اختبار السائق",
            "phone": "0912345678",
            "password": "test123",
            "price": "50",
            "workStatus": "AVAILABLE",
            "approvalStatus": "APPROVED",  # Already approved for testing
            "priority": 0,
            "deletionRequested": False,
            "createdAt": datetime.now().isoformat()
        }
        drivers.append(test_driver)
        if save_db(drivers):
            print("Test driver added successfully!")
        else:
            print("Failed to add test driver!")
    
    app.run(debug=True, port=5000)

