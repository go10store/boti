// Global State Management
let allDrivers = [];
let currentOrders = [];

// API Functions
async function getDrivers() {
    try {
        console.log('Fetching drivers from API...');
        const res = await fetch('/api/drivers');
        console.log('Drivers API response status:', res.status);
        const drivers = await res.json();
        console.log('Drivers data received:', JSON.stringify(drivers, null, 2));
        return drivers;
    } catch (err) {
        console.error('Failed to load drivers:', err);
        showNotification('فشل تحميل السائقين', 'error');
        return [];
    }
}

async function getOrders() {
    try {
        const res = await fetch('/api/orders');
        return await res.json();
    } catch (err) {
        console.error('Failed to load orders:', err);
        return [];
    }
}

// Driver Registration
async function addDriver(driverData) {
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(driverData)
        });
        return await res.json();
    } catch (err) {
        console.error('Registration error:', err);
        return { success: false, message: 'فشل الاتصال بالخادم' };
    }
}

// Driver Login
async function loginDriver(phone, password) {
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password })
        });
        const data = await res.json();
        if (data.success) {
            // Store in session storage for persistence
            sessionStorage.setItem('currentDriver', JSON.stringify(data.driver));
            return data.driver;
        }
        showNotification(data.message || 'فشل تسجيل الدخول', 'error');
        return null;
    } catch (err) {
        console.error('Login error:', err);
        showNotification('فشل الاتصال بالخادم', 'error');
        return null;
    }
}

// Get current driver from session
function getCurrentDriver() {
    try {
        const driver = sessionStorage.getItem('currentDriver');
        return driver ? JSON.parse(driver) : null;
    } catch {
        return null;
    }
}

// Clear driver session
function clearDriverSession() {
    sessionStorage.removeItem('currentDriver');
}

// Update Driver Status
async function updateDriverStatus(driverId, status) {
    try {
        const res = await fetch('/api/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: driverId, status })
        });
        const data = await res.json();
        return data.success;
    } catch (err) {
        console.error('Status update error:', err);
        showNotification('فشل تحديث الحالة', 'error');
        return false;
    }
}

// Update Driver Profile
async function updateDriverProfile(driverId, updates) {
    try {
        const res = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: driverId, ...updates })
        });
        const data = await res.json();
        return data.success;
    } catch (err) {
        console.error('Profile update error:', err);
        showNotification('فشل تحديث المعلومات', 'error');
        return false;
    }
}

// Request Account Deletion
async function requestAccountDeletion(driverId) {
    try {
        const res = await fetch('/api/driver/delete-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: driverId })
        });
        return await res.json();
    } catch (err) {
        console.error('Delete request error:', err);
        return { success: false, message: 'فشل الاتصال بالخادم' };
    }
}

// UI Functions
function renderDrivers(drivers, containerId) {
    console.log('Rendering drivers:', drivers);
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (drivers.length === 0) {
        console.log('No drivers to display');
        container.innerHTML = `
            <div style="text-align:center; padding:2rem; grid-column:1/-1; opacity:0; animation:fadeIn 1s forwards;">
                <p style="color:var(--text-sub); font-size:1rem;">لا يوجد سائقين متاحين حالياً.</p>
                <p style="color:var(--text-sub); font-size:0.9rem; margin-top: 0.5rem;">هل أنت سائق؟ <a href="register.html" style="color: var(--accent);">سجل الآن</a></p>
            </div>
        `;
        return;
    }

    console.log('Displaying', drivers.length, 'drivers');
    
    // Sort drivers by priority first, then by status
    drivers.sort((a, b) => {
        // First sort by priority (higher first)
        const priorityDiff = (b.priority || 0) - (a.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        
        // Then sort by status (AVAILABLE first, then EN_ROUTE, then BUSY)
        const statusPriority = { 'AVAILABLE': 1, 'EN_ROUTE': 2, 'BUSY': 3 };
        return (statusPriority[a.workStatus] || 1) - (statusPriority[b.workStatus] || 1);
    });

    drivers.forEach((driver, index) => {
        const status = driver.workStatus || 'AVAILABLE'; // Default

        const card = document.createElement('div');
        card.className = `driver-card ${status === 'BUSY' ? 'card-busy' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;

        // Status Badge Logic
        let statusBadge = '<span class="status-badge status-available">🟢 متاح</span>';
        if (status === 'BUSY') statusBadge = '<span class="status-badge status-busy">🔴 تم البيع / مشغول</span>';
        if (status === 'EN_ROUTE') statusBadge = '<span class="status-badge status-route">🟡 في الطريق</span>';

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:0.5rem;">
                <h3 style="color:var(--text-main); font-size:1.1rem; margin: 0;">${driver.name}</h3>
                <span class="price-tag">${driver.price} د.ل</span>
            </div>
            
            <div style="margin-bottom: 0.8rem;">${statusBadge}</div>

            <div style="color: var(--text-sub); margin-bottom:1rem; font-size:0.85rem; line-height:1.4;">
                <div style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.2rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    <span>${driver.phone}</span>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.4rem;">
                <button onclick="placeOrder('${driver.id}')" class="btn btn-primary" style="width:100%; font-size:0.8rem; padding:0.6rem;">
                   طلب
                </button>
                <a href="tel:${driver.phone}" class="btn btn-secondary" style="width:100%; font-size:0.8rem; padding:0.6rem;">
                   اتصال
                </a>
            </div>
        `;
        container.appendChild(card);
    });
}

// Order Placement Function - Improved Version
function placeOrder(driverId) {
    // Remove any existing modal first
    const existingModal = document.getElementById('orderModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal for order placement
    const modal = document.createElement('div');
    modal.id = 'orderModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
    `;
    
    modal.innerHTML = `
        <div class="driver-card" style="width: 90%; max-width: 400px; margin: 0; animation: slideUp 0.3s ease-out; position: relative;">
            <button onclick="closeOrderModal()" style="position: absolute; top: 10px; left: 10px; background: none; border: none; color: var(--text-sub); font-size: 1.2rem; cursor: pointer;">×</button>
            <h3 style="color: var(--accent); margin-bottom: 1rem; text-align: center;">طلب خدمة</h3>
            <form id="orderForm" style="margin-bottom: 1rem;">
                <input type="hidden" id="driverId" value="${driverId}">
                <div class="form-group">
                    <label>الاسم الكامل</label>
                    <input type="text" id="customerName" class="form-control" required placeholder="أدخل اسمك الكامل">
                </div>
                <div class="form-group">
                    <label>رقم الهاتف</label>
                    <input type="tel" id="customerPhone" class="form-control" required placeholder="09xxxxxxxx">
                </div>
                <div class="form-group">
                    <label>ملاحظات (اختياري)</label>
                    <textarea id="orderNotes" class="form-control" rows="2" placeholder="أي معلومات إضافية..."></textarea>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 1rem;">
                    <button type="button" onclick="closeOrderModal()" class="btn btn-secondary" style="padding: 0.7rem;">إلغاء</button>
                    <button type="submit" class="btn btn-primary" style="padding: 0.7rem;">تأكيد الطلب</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle form submission
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        orderForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const submitBtn = orderForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = 'جاري الإرسال...';
            submitBtn.disabled = true;
            
            try {
                const driverId = document.getElementById('driverId').value;
                const customerName = document.getElementById('customerName').value;
                const customerPhone = document.getElementById('customerPhone').value;
                const orderNotes = document.getElementById('orderNotes').value;
                
                // Validate phone number
                if (!customerPhone.match(/^09[0-9]{8}$/)) {
                    showNotification('رقم الهاتف يجب أن يكون ليبي (09xxxxxxxx)', 'error');
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                    return;
                }
                
                // Submit order
                const orderData = {
                    driverId,
                    customerName,
                    customerPhone,
                    notes: orderNotes,
                    timestamp: new Date().toISOString()
                };
                
                const response = await fetch('/api/place-order', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(orderData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showNotification('تم إرسال الطلب بنجاح!', 'success');
                    closeOrderModal();
                } else {
                    showNotification(result.message || 'حدث خطأ أثناء إرسال الطلب', 'error');
                }
            } catch (error) {
                showNotification('فشل الاتصال بالخادم', 'error');
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
}

// Close order modal
function closeOrderModal() {
    const modal = document.getElementById('orderModal');
    if (modal) {
        modal.remove();
    }
}

// Notification System
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}

// Prevent background scrolling when modal is open
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeOrderModal();
    }
});
