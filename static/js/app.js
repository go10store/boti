const API_URL = "";

// --- Auth Handling ---
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullname = document.getElementById('reg_fullname').value;
        const phone = document.getElementById('reg_phone').value;
        const password = document.getElementById('reg_password').value;
        const role = document.getElementById('reg_role').value;

        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: fullname, phone, password, role })
            });

            if (!res.ok) throw new Error((await res.json()).detail);

            alert('تم إنشاء الحساب بنجاح! قم بتسجيل الدخول.');
            toggleRegister();
        } catch (err) {
            showError(err.message);
        }
    });
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('phone').value;
        const password = document.getElementById('password').value;

        try {
            const formData = new URLSearchParams();
            formData.append('username', phone);
            formData.append('password', password);

            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });

            if (!res.ok) throw new Error('خطأ في البيانات');

            const data = await res.json();
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('role', data.role);
            localStorage.setItem('userName', data.full_name);
            localStorage.setItem('userId', data.user_id);

            window.location.href = 'dashboard.html';
        } catch (err) {
            showError(err.message);
        }
    });
}

function showError(msg) {
    if (errorMsg) {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
    } else {
        alert(msg);
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// --- Dashboard Handling ---
let map;
let marker;
let watchId;
let selectedDriver = null;

async function initDashboard() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const name = localStorage.getItem('userName');

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = name;

    if (role === 'driver') {
        document.getElementById('driverView').classList.remove('hidden');
        loadDriverData();
        loadDriverOrders();
        // Start updating location if available
        if (localStorage.getItem('isAvailable') === 'true') {
            startLocationTracking();
        }
    } else {
        document.getElementById('customerView').classList.remove('hidden');
        initMap();
        loadCustomerOrders();
    }
}

// DRIVER FUNCTIONS
async function loadDriverData() {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/drivers/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            document.getElementById('driverPrice').value = data.price;
            document.getElementById('driverCapacity').value = data.capacity;
            const toggle = document.getElementById('availabilityToggle');
            toggle.checked = data.is_available;

            document.getElementById('statusText').textContent = data.is_available ? 'متاح للعمل' : 'غير متاح';
            document.getElementById('statusText').className = `mr-3 text-sm font-medium ${data.is_available ? 'text-green-600' : 'text-gray-900'}`;

            if (data.is_available) startLocationTracking();
        }
    } catch (e) {
        console.error(e);
    }
}

async function updateDriverProfile() {
    const token = localStorage.getItem('token');
    const price = document.getElementById('driverPrice').value;
    const capacity = document.getElementById('driverCapacity').value;

    await fetch(`${API_URL}/drivers/profile`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ truck_type: 'Standard', capacity: parseInt(capacity), price: parseFloat(price) })
    });
    alert('تم حفظ البيانات');
}

async function toggleDriverStatus() {
    const token = localStorage.getItem('token');
    const isAvailable = document.getElementById('availabilityToggle').checked;

    await fetch(`${API_URL}/drivers/status?is_available=${isAvailable}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    document.getElementById('statusText').textContent = isAvailable ? 'متاح للعمل' : 'غير متاح';
    document.getElementById('statusText').className = `mr-3 text-sm font-medium ${isAvailable ? 'text-green-600' : 'text-gray-900'}`;
    localStorage.setItem('isAvailable', isAvailable);

    if (isAvailable) {
        startLocationTracking();
    } else {
        stopLocationTracking();
    }
}

function startLocationTracking() {
    if (navigator.geolocation && !watchId) {
        watchId = navigator.geolocation.watchPosition(async (position) => {
            const token = localStorage.getItem('token');
            const { latitude, longitude } = position.coords;
            try {
                await fetch(`${API_URL}/drivers/location`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ lat: latitude, lng: longitude })
                });
            } catch (e) { console.error('Loc error', e); }
        }, (err) => console.error(err), { enableHighAccuracy: true });
    }
}

function stopLocationTracking() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

async function loadDriverOrders() {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/orders/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const orders = await res.json();
    const container = document.getElementById('driverOrdersList');
    container.innerHTML = '';

    if (orders.length === 0) {
        container.innerHTML = '<p class="text-gray-500">لا توجد طلبات</p>';
        return;
    }

    orders.forEach(o => {
        const div = document.createElement('div');
        div.className = 'border p-4 rounded bg-gray-50 flex justify-between items-center';
        div.innerHTML = `
            <div>
                <p class="font-bold">عميل: ${o.customer_name || 'غير معروف'}</p>
                <p class="text-sm">الموقع: ${o.delivery_address || 'تحديد الخريطة'}</p>
                <p class="text-xs text-gray-400">${new Date(o.created_at).toLocaleString()}</p>
            </div>
            <div class="text-left">
                <span class="block font-bold text-blue-600 mb-2">${o.amount} د.ل</span>
                <span class="px-2 py-1 rounded text-xs text-white ${getStatusColor(o.status)}">${o.status}</span>
                ${o.status === 'pending' ? `<button onclick="updateOrderStatus(${o.id}, 'accepted')" class="block mt-2 text-xs bg-green-500 text-white px-2 py-1 rounded">قبول</button>` : ''}
            </div>
        `;
        container.appendChild(div);
    });
}

// CUSTOMER FUNCTIONS
function initMap() {
    // Default to Zintan, Libya
    const zintanCoords = [31.9317, 12.2536];
    map = L.map('map').setView(zintanCoords, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            map.setView([latitude, longitude], 13);
            L.marker([latitude, longitude]).addTo(map).bindPopup('موقعك الحالي').openPopup();
            loadNearbyDrivers(latitude, longitude);
        }, () => {
            // Fallback if denied
            loadNearbyDrivers(zintanCoords[0], zintanCoords[1]);
        });
    } else {
        loadNearbyDrivers(zintanCoords[0], zintanCoords[1]);
    }
}

// --- Rating Handling ---
let currentRating = 0;
let ratingOrderId = null;

function openRatingModal(orderId) {
    ratingOrderId = orderId;
    currentRating = 0;
    setRating(0);
    document.getElementById('ratingComment').value = '';
    document.getElementById('ratingModal').classList.remove('hidden');
}

function closeRatingModal() {
    document.getElementById('ratingModal').classList.add('hidden');
    ratingOrderId = null;
}

function setRating(n) {
    currentRating = n;
    const stars = document.querySelectorAll('.star-btn');
    stars.forEach((star, index) => {
        if (index < n) {
            star.classList.remove('text-gray-300');
            star.classList.add('text-yellow-400');
        } else {
            star.classList.add('text-gray-300');
            star.classList.remove('text-yellow-400');
        }
    });
}

async function submitRating() {
    if (!currentRating || !ratingOrderId) return alert('الرجاء اختيار التقييم');

    const token = localStorage.getItem('token');
    const comment = document.getElementById('ratingComment').value;

    try {
        const res = await fetch(`${API_URL}/reviews/${ratingOrderId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ rating: currentRating, comment })
        });

        if (res.ok) {
            alert('شكراً لتقييمك!');
            closeRatingModal();
        } else {
            const err = await res.json();
            alert(err.detail || 'حدث خطأ');
        }
    } catch (e) {
        console.error(e);
        alert('فشل الاتصال');
    }
}

// Update loadNearbyDrivers to show stars
async function loadNearbyDrivers(lat, lng) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/drivers/nearby?lat=${lat}&lng=${lng}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const drivers = await res.json();
        const list = document.getElementById('nearbyDriversList');
        list.innerHTML = '';

        drivers.forEach(d => {
            if (d.current_lat && d.current_lng) {
                const stars = '★'.repeat(Math.round(d.average_rating || 0)) + '☆'.repeat(5 - Math.round(d.average_rating || 0));

                // Add marker
                L.marker([d.current_lat, d.current_lng])
                    .addTo(map)
                    .bindPopup(`
                        <b>${d.driver_name || 'سائق'}</b><br>
                        <span class="text-yellow-500">${stars}</span> (${d.rating_count})<br>
                        السعر: ${d.price} د.ل<br>
                        <button onclick="openBookingModal(${d.user_id}, '${d.driver_name}', ${d.price})" class="mt-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">طلب الآن</button>
                    `);

                // Add card
                const card = document.createElement('div');
                card.className = "flex-shrink-0 w-48 bg-white border rounded p-3 shadow text-center cursor-pointer hover:bg-gray-50";
                card.onclick = () => map.setView([d.current_lat, d.current_lng], 15);
                card.innerHTML = `
                   <div class="font-bold text-gray-800">${d.driver_name || 'سائق'}</div>
                   <div class="text-yellow-500 text-sm mb-1">${stars} <span class="text-gray-400 text-xs">(${d.rating_count})</span></div>
                   <div class="text-sm text-gray-500">${d.truck_type}</div>
                   <div class="text-green-600 font-bold my-1">${d.price} د.ل</div>
                   <button onclick="openBookingModal(${d.user_id}, '${d.driver_name}', ${d.price})" class="w-full bg-blue-600 text-white text-xs py-1 rounded">طلب</button>
               `;
                list.appendChild(card);
            }
        });
    } catch (e) { console.error('Map error', e); }
}

async function loadCustomerOrders() {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/orders/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const orders = await res.json();
    const container = document.getElementById('customerOrdersList');
    container.innerHTML = '';

    if (orders.length === 0) {
        container.innerHTML = '<p class="text-gray-500">لا توجد طلبات سابقة</p>';
        return;
    }

    orders.forEach(o => {
        const div = document.createElement('div');
        div.className = 'border p-3 rounded bg-white flex justify-between items-center';
        div.innerHTML = `
            <div>
                <p class="font-bold">السائق: ${o.driver_name || 'غير معروف'}</p>
                <p class="text-xs text-gray-500">${new Date(o.created_at).toLocaleDateString()}</p>
            </div>
            <div>
                <span class="px-2 py-1 rounded text-xs text-white ${getStatusColor(o.status)}">${o.status}</span>
                ${o.status === 'completed' ? `<button onclick="openRatingModal(${o.id})" class="block mt-1 text-xs text-blue-600 underline">قيم السائق</button>` : ''}
            </div>
        `;
        container.appendChild(div);
    });
}

function getStatusColor(status) {
    switch (status) {
        case 'pending': return 'bg-yellow-500';
        case 'accepted': return 'bg-blue-500';
        case 'en_route': return 'bg-indigo-500';
        case 'completed': return 'bg-green-600';
        case 'cancelled': return 'bg-red-500';
        default: return 'bg-gray-400';
    }
}

async function updateOrderStatus(id, status) {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/orders/${id}/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
    });
    loadDriverOrders(); // Refresh
    loadCustomerOrders(); // Refresh
}

document.addEventListener('DOMContentLoaded', () => {
    // Only init dashboard if we are on the dashboard page
    if (document.getElementById('driverView') || document.getElementById('customerView')) {
        initDashboard();
    }
});
