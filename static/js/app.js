const API_URL = "";

// Helper to show toasts
function showToast(msg, type = 'info') {
    let bg = "#2563EB"; // Blue
    if (type === 'error') bg = "#DC2626"; // Red
    if (type === 'success') bg = "#10B981"; // Green

    Toastify({
        text: msg,
        duration: 3000,
        gravity: "top",
        position: "center",
        style: {
            background: bg,
            borderRadius: "10px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            fontFamily: "Tajawal, sans-serif"
        },
    }).showToast();
}

// Replaces showError
function showError(msg) {
    const errorMsg = document.getElementById('errorMsg');
    if (errorMsg) {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
    }
    showToast(msg, 'error');
}

// --- Auth Handling ---
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');

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

            showToast('تم إنشاء الحساب بنجاح! قم بتسجيل الدخول.', 'success');
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

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// --- Dashboard Handling ---
let map;
let marker;
let watchId;
let selectedDriver = null;
let driverMarkers = {}; // Store markers by driver ID

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
        // Wait for DOM to render before initializing map
        setTimeout(() => {
            initMap();
            loadCustomerOrders();
        }, 100);
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
    showToast('تم حفظ البيانات', 'success');
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
                ${['accepted', 'en_route'].includes(o.status) ? `<button onclick="openChatModal(${o.id})" class="block mt-2 text-xs bg-blue-500 text-white px-2 py-1 rounded"><i class="fas fa-comments"></i> محادثة</button>` : ''}
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

    // Initial load and polling
    const updateLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                const { latitude, longitude } = pos.coords;
                // Only center map on first load
                if (!window.hasCenteredMap) {
                    map.setView([latitude, longitude], 13);
                    L.marker([latitude, longitude]).addTo(map).bindPopup('موقعك الحالي').openPopup();
                    window.hasCenteredMap = true;
                }
                loadNearbyDrivers(latitude, longitude);
            }, () => loadNearbyDrivers(zintanCoords[0], zintanCoords[1]));
        } else {
            loadNearbyDrivers(zintanCoords[0], zintanCoords[1]);
        }
    };

    updateLocation();
    setInterval(updateLocation, 5000);
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
    if (!currentRating || !ratingOrderId) return showToast('الرجاء اختيار التقييم', 'error');

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
            showToast('شكراً لتقييمك!', 'success');
            closeRatingModal();
        } else {
            const err = await res.json();
            showToast(err.detail || 'حدث خطأ', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('فشل الاتصال', 'error');
    }
}

// Update loadNearbyDrivers to use existing markers and show phone number
async function loadNearbyDrivers(lat, lng) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/drivers/nearby?lat=${lat}&lng=${lng}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const drivers = await res.json();
        const list = document.getElementById('nearbyDriversList');
        // Clear list to update cards (simple approach)
        list.innerHTML = '';

        const activeDriverIds = new Set();

        drivers.forEach(d => {
            if (d.current_lat && d.current_lng) {
                activeDriverIds.add(d.user_id);
                const stars = '★'.repeat(Math.round(d.average_rating || 0)) + '☆'.repeat(5 - Math.round(d.average_rating || 0));

                const popupContent = `
                    <div class="text-right">
                        <b>${d.driver_name || 'سائق'}</b><br>
                        <span class="text-gray-600 text-xs block my-1"><i class="fas fa-phone-alt ml-1"></i> ${d.phone_number || 'غير متوفر'}</span>
                        <span class="text-yellow-500">${stars}</span> (${d.rating_count})<br>
                        السعر: ${d.price} د.ل<br>
                        <button onclick="openBookingModal(${d.user_id}, '${d.driver_name}', ${d.price})" class="mt-2 bg-blue-500 text-white px-2 py-1 rounded text-xs w-full">طلب الآن</button>
                    </div>
                `;

                // Update or Create Marker
                if (driverMarkers[d.user_id]) {
                    driverMarkers[d.user_id].setLatLng([d.current_lat, d.current_lng]);
                    driverMarkers[d.user_id].getPopup().setContent(popupContent);
                } else {
                    const marker = L.marker([d.current_lat, d.current_lng], {
                        icon: L.divIcon({
                            className: 'custom-driver-icon',
                            html: `<div style="background-color: #2563EB; color: white; padding: 5px; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><i class="fas fa-truck"></i></div>`,
                            iconSize: [30, 30],
                            iconAnchor: [15, 15]
                        })
                    }).addTo(map).bindPopup(popupContent);
                    driverMarkers[d.user_id] = marker;
                }

                // Add card
                const card = document.createElement('div');
                card.className = "flex-shrink-0 w-48 bg-white border rounded-xl p-3 shadow-sm text-center cursor-pointer hover:shadow-md transition-all";
                card.onclick = () => {
                    map.setView([d.current_lat, d.current_lng], 15);
                    driverMarkers[d.user_id].openPopup();
                };
                card.innerHTML = `
                   <div class="flex items-center justify-between mb-2">
                       <div class="font-bold text-gray-800 text-sm">${d.driver_name || 'سائق'}</div>
                       <span class="px-2 py-0.5 rounded-full text-xs ${d.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">${d.is_available ? 'نشط' : 'غير نشط'}</span>
                   </div>
                   <div class="text-xs text-gray-500 mb-1 flex items-center justify-center gap-1" dir="ltr">
                       <i class="fas fa-phone"></i> ${d.phone_number || 'غير متوفر'}
                       ${d.phone_number ? `<a href="https://wa.me/${d.phone_number.replace(/\D/g, '')}" target="_blank" class="text-green-600 hover:text-green-700"><i class="fab fa-whatsapp"></i></a>` : ''}
                   </div>
                   <div class="text-yellow-500 text-xs mb-1">${stars} <span class="text-gray-400">(${d.rating_count})</span></div>
                   <div class="text-green-600 font-bold my-1 text-sm">${d.price} د.ل</div>
                   <button onclick="openBookingModal(${d.user_id}, '${d.driver_name}', ${d.price})" class="w-full bg-brand-600 text-white text-xs py-1.5 rounded-lg hover:bg-brand-700 ${!d.is_available ? 'opacity-50' : ''}">طلب</button>
                `;
                list.appendChild(card);
            }
        });

        // Remove old markers
        for (const id in driverMarkers) {
            if (!activeDriverIds.has(parseInt(id))) {
                map.removeLayer(driverMarkers[id]);
                delete driverMarkers[id];
            }
        }

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
                ${['accepted', 'en_route'].includes(o.status) ? `<button onclick="openChatModal(${o.id})" class="block mt-1 text-xs bg-blue-500 text-white px-2 py-1 rounded"><i class="fas fa-comments"></i> محادثة</button>` : ''}
                ${o.status === 'completed' ? `<button onclick="openRatingModal(${o.id})" class="block mt-1 text-xs text-blue-600 underline">قيم السائق</button>` : ''}
            </div>
        `;
        container.appendChild(div);
    });

    // Start Live Tracking if active order exists
    trackActiveOrder();
}

let activeOrderInterval = null;
async function trackActiveOrder() {
    if (activeOrderInterval) clearInterval(activeOrderInterval);

    const checkOrder = async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_URL}/orders/active`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const order = await res.json();
                if (order && order.status === 'en_route' && order.driver_lat && order.driver_lng) {
                    updateLiveMap(order);
                }
            }
        } catch (e) { console.error(e); }
    };

    checkOrder();
    activeOrderInterval = setInterval(checkOrder, 10000); // Poll every 10s
}

let driverMarker = null;
function updateLiveMap(order) {
    if (!map) return;

    const lat = order.driver_lat;
    const lng = order.driver_lng;

    if (!driverMarker) {
        const icon = L.icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/741/741407.png', // Tanker icon
            iconSize: [40, 40]
        });
        driverMarker = L.marker([lat, lng], { icon: icon }).addTo(map);
    } else {
        driverMarker.setLatLng([lat, lng]);
    }

    // Calculate Distance & ETA
    // Simple Euclidean for demo (Haversine better but lazy) or use Leaflet distanceTo
    const driverLL = L.latLng(lat, lng);
    const destLL = L.latLng(order.delivery_lat, order.delivery_lng);
    const distMeters = driverLL.distanceTo(destLL);

    // Assume 40km/h avg speed => 666 m/min
    const etaMins = Math.ceil(distMeters / 666);

    // Show info (Floating Card?)
    showLiveInfoCard(distMeters, etaMins, order.driver_capacity);
}

function showLiveInfoCard(dist, eta, capacity) {
    let card = document.getElementById('liveInfoCard');
    if (!card) {
        card = document.createElement('div');
        card.id = 'liveInfoCard';
        card.className = "absolute bottom-20 left-4 right-4 bg-white p-4 rounded-xl shadow-lg z-[1000] animate__animated animate__slideInUp";
        document.getElementById('customerView').appendChild(card); // Append to view, assuming map is visible
    }

    card.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <p class="text-xs text-gray-500">المسافة المتبقية</p>
                <p class="font-bold text-lg">${(dist / 1000).toFixed(1)} كم</p>
            </div>
             <div>
                <p class="text-xs text-gray-500">وقت الوصول</p>
                <p class="font-bold text-lg text-brand-600">~${eta} دقيقة</p>
            </div>
             <div class="text-center">
                <p class="text-xs text-gray-500">الحمولة</p>
                <p class="font-bold text-sm">${capacity || '?'} لتر</p>
            </div>
        </div>
    `;
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

// Modal Global Functions
function openBookingModal(driverId, driverName, price) {
    document.getElementById('modalDriverName').textContent = driverName;
    document.getElementById('modalPrice').textContent = price;
    document.getElementById('bookingModal').classList.remove('hidden');

    // Remove old listeners to avoid duplicates (naive approach, better to separate init)
    const btn = document.getElementById('confirmOrderBtn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', async () => {
        const token = localStorage.getItem('token');
        const deliveryDetails = document.getElementById('deliveryDetails').value;
        const center = map.getCenter();

        try {
            const res = await fetch(`${API_URL}/orders/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    driver_id: driverId,
                    amount: price,
                    delivery_lat: center.lat,
                    delivery_lng: center.lng,
                    delivery_address: deliveryDetails
                })
            });

            if (res.ok) {
                showToast('تم إرسال طلبك بنجاح!', 'success');
                closeModal();
                loadCustomerOrders();
            } else {
                throw new Error('فشل الطلب');
            }
        } catch (e) {
            showToast(e.message, 'error');
        }
    });
}

function closeModal() {
    document.getElementById('bookingModal').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    // Only init dashboard if we are on the dashboard page
    if (document.getElementById('driverView') || document.getElementById('customerView')) {
        initDashboard();
    }
});

// --- Chat Handling ---
let chatSocket = null;
let currentChatOrderId = null;
let currentUserId = localStorage.getItem('userId');

function openChatModal(orderId) {
    currentChatOrderId = orderId;
    document.getElementById('chatMessages').innerHTML = ''; // Clear old messages
    document.getElementById('chatModal').classList.remove('hidden');
    loadChatHistory(orderId);
    connectWebSocket(orderId);
}

function closeChatModal() {
    document.getElementById('chatModal').classList.add('hidden');
    if (chatSocket) {
        chatSocket.close();
        chatSocket = null;
    }
    currentChatOrderId = null;
}

async function loadChatHistory(orderId) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/chat/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const messages = await res.json();
            const container = document.getElementById('chatMessages');
            container.innerHTML = '';
            messages.forEach(msg => appendMessage(msg));
            scrollToBottom();
        }
    } catch (e) { console.error(e); }
}

function connectWebSocket(orderId) {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/chat/ws/${orderId}/${currentUserId}`;

    chatSocket = new WebSocket(wsUrl);

    chatSocket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        appendMessage(msg);
        scrollToBottom();
    };

    chatSocket.onclose = () => {
        console.log("WebSocket Disconnected");
    };
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const content = input.value.trim();
    if (content && chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(JSON.stringify({ content: content, type: 'text' }));
        input.value = '';
    }
}

function sendLocation() {
    if (!navigator.geolocation) return showToast('غير مدعوم', 'error');
    navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
            chatSocket.send(JSON.stringify({ content: `${latitude},${longitude}`, type: 'location' }));
        }
    }, err => showToast('تعذر تحديد الموقع', 'error'));
}

function appendMessage(msg) {
    const container = document.getElementById('chatMessages');
    const isMe = msg.sender_id == currentUserId;

    const div = document.createElement('div');
    div.className = `flex ${isMe ? 'justify-start' : 'justify-end'} mb-2`;

    const bubble = document.createElement('div');
    bubble.className = `max-w-xs px-4 py-2 rounded-lg ${isMe ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`;

    if (msg.message_type === 'location') {
        const [lat, lng] = msg.content.split(',');
        bubble.innerHTML = `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" class="underline flex items-center gap-1"><i class="fas fa-map-marker-alt"></i> موقع</a>`;
    } else {
        bubble.textContent = msg.content;
    }

    div.appendChild(bubble);
    container.appendChild(div);
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

// --- Push Notifications ---
if ('serviceWorker' in navigator && 'PushManager' in window) {
    navigator.serviceWorker.register('sw.js').then(async swReg => {
        console.log('Service Worker Registered', swReg);

        // Ask for permission and subscribe
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            subscribeUserToPush(swReg);
        }
    }).catch(error => {
    }).catch(error => {
        console.error('Service Worker Error', error);
    });
}

async function triggerSOS() {
    if (!confirm('هل أنت متأكد من طلب الاستغاثة الطارئة؟')) return;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const token = localStorage.getItem('token');
            const { latitude, longitude } = pos.coords;
            try {
                const res = await fetch(`${API_URL}/safety/sos?lat=${latitude}&lng=${longitude}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                showToast(data.message, 'success'); // Red toast? 'success' is green but message is reassuring.
            } catch (e) {
                showToast('فشل إرسال الاستغاثة', 'error');
            }
        }, () => showToast('يجب تفعيل الموقع للاستغاثة', 'error'));
    } else {
        showToast('الموقع غير مدعوم', 'error');
    }
}

async function subscribeUserToPush(swReg) {
    try {
        const token = localStorage.getItem('token');
        if (!token) return; // Only subscribe if logged in

        const resKey = await fetch(`${API_URL}/notifications/public_key`);
        const { publicKey } = await resKey.json();

        const subscription = await swReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        // Send to backend
        await fetch(`${API_URL}/notifications/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(subscription)
        });
        console.log('User Subscribed to Push');
    } catch (e) {
        console.error('Subscription failed', e);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
