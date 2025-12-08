/* 
  تطبيق بوطي - Boti App Logic
  Developed by Alkow Software
*/

const ICONS = {
    phone: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
    location: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    water: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>',
    check: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    error: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    whatsapp: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>'
};

const API_URL = '/api'; // Use relative path so it works on localhost & Railway

// Enhanced Driver Authentication with Session Storage
async function getDrivers() {
    try {
        const res = await fetch(`${API_URL}/drivers`);
        return await res.json();
    } catch (e) {
        console.error("Error fetching drivers", e);
        return [];
    }
}

async function addDriver(driver) {
    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(driver)
        });

        const data = await res.json();
        return data; // Return full response object with success and message
    } catch (e) {
        console.error("Error saving", e);
        return { success: false, message: 'حدث خطأ في الاتصال' };
    }
}

// Enhanced Login with Better Error Handling
async function loginDriver(phone, password) {
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password })
        });
        const data = await res.json();
        
        if (data.success) {
            // Store driver session
            sessionStorage.setItem('currentDriver', JSON.stringify(data.driver));
            return data.driver;
        }
        return null;
    } catch (e) { 
        console.error("Login error", e);
        return null; 
    }
}

// Check for existing session
function getCurrentDriver() {
    const driverData = sessionStorage.getItem('currentDriver');
    return driverData ? JSON.parse(driverData) : null;
}

// Clear session on logout
function clearDriverSession() {
    sessionStorage.removeItem('currentDriver');
}

async function updateDriverStatus(id, newStatus) {
    try {
        const res = await fetch(`${API_URL}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: newStatus })
        });
        const data = await res.json();
        return data.success;
    } catch (e) { return false; }
}

// Update Driver Profile Function
async function updateDriverProfile(driverId, updates) {
    try {
        const res = await fetch(`${API_URL}/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: driverId, ...updates })
        });
        const data = await res.json();
        return data.success;
    } catch (e) {
        return false;
    }
}

// Delete Request Function
async function requestAccountDeletion(driverId) {
    try {
        const res = await fetch(`${API_URL}/driver/delete-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: driverId })
        });
        const data = await res.json();
        return data;
    } catch (e) {
        return { success: false, message: 'حدث خطأ في الاتصال' };
    }
}

// Notification System
function showNotification(message, type = 'info') {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '';
    if (type === 'success') {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        toast.style.borderRight = '4px solid #2ec4b6';
    } else if (type === 'error') {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
        toast.style.borderRight = '4px solid #e71d36';
    } else {
        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
        toast.style.borderRight = '4px solid var(--accent)';
    }

    toast.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <span style="color: ${type === 'success' ? '#2ec4b6' : type === 'error' ? '#e71d36' : 'var(--accent)'}">${icon}</span>
            <span style="font-weight:600;">${message}</span>
        </div>
    `;

    container.appendChild(toast);

    // Add entrance animation
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function createToastContainer() {
    const el = document.createElement('div');
    el.id = 'toast-container';
    el.style.position = 'fixed';
    el.style.bottom = '30px';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.zIndex = '1000';
    el.style.width = '90%';
    el.style.maxWidth = '400px';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = '10px';
    document.body.appendChild(el);
    return el;
}

// UI Functions
function renderDrivers(drivers, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (drivers.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:2rem; grid-column:1/-1; opacity:0; animation:fadeIn 1s forwards;"><p style="color:var(--text-sub); font-size:1rem;">لا يوجد سائقين حالياً. كن أول المنضمين!</p></div>';
        return;
    }

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

// Order Placement Function
function placeOrder(driverId) {
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
        <div class="driver-card" style="width: 90%; max-width: 400px; margin: 0; animation: slideUp 0.3s ease-out;">
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
    document.getElementById('orderForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const driverId = document.getElementById('driverId').value;
        const customerName = document.getElementById('customerName').value;
        const customerPhone = document.getElementById('customerPhone').value;
        const orderNotes = document.getElementById('orderNotes').value;
        
        // Validate phone number
        if (!customerPhone.match(/^09[0-9]{8}$/)) {
            showNotification('رقم الهاتف يجب أن يكون ليبي (09xxxxxxxx)', 'error');
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
        
        try {
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
                showNotification('حدث خطأ أثناء إرسال الطلب', 'error');
            }
        } catch (error) {
            showNotification('فشل الاتصال بالخادم', 'error');
        }
    });
}

// Close order modal
function closeOrderModal() {
    const modal = document.getElementById('orderModal');
    if (modal) {
        modal.remove();
    }
}
