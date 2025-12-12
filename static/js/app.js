const API_URL = "";

// Helper to show toasts
function showToast(msg, type = 'info') {
    let bg = "#3b82f6";
    if (type === 'error') bg = "#DC2626";
    if (type === 'success') bg = "#10B981";

    Toastify({
        text: msg,
        duration: 3000,
        gravity: "top",
        position: "center",
        style: { background: bg, borderRadius: "12px", padding: "16px 24px", fontWeight: "bold" }
    }).showToast();
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

// Global vars
let map;
let marker;
let watchId;
let selectedDriver = null;
let driverMarkers = {};
let currentUserId = null;

async function initDashboard() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const name = localStorage.getItem('userName');
    currentUserId = parseInt(localStorage.getItem('userId'));

    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const nameEl = document.getElementById('userName');
    if (nameEl) nameEl.textContent = name;

    if (role === 'driver') {
        document.getElementById('driverView').classList.remove('hidden');
        // Driver view logic here
    } else {
        document.getElementById('customerView').classList.remove('hidden');
        setTimeout(() => {
            initMap();
            loadCustomerOrders();
        }, 100);
    }

    // Register service worker for notifications
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/sw.js').then(async (registration) => {
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(await fetch(`${API_URL}/notifications/vapid-public-key`).then(r => r.text()))
            });
            await fetch(`${API_URL}/notifications/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(subscription)
            });
        }).catch(err => console.log('SW registration failed:', err));
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// CUSTOMER FUNCTIONS
function initMap() {
    const zintanCoords = [31.9317, 12.2536];
    map = L.map('map').setView(zintanCoords, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    const updateLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                const { latitude, longitude } = pos.coords;
                if (!window.hasCenteredMap) {
                    map.setView([latitude, longitude], 13);
                    L.marker([latitude, longitude]).addTo(map)
                        .bindPopup('<b>موقعك الحالي</b>').openPopup();
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

async function loadNearbyDrivers(lat, lng) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/drivers/nearby?lat=${lat}&lng=${lng}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const drivers = await res.json();
        const list = document.getElementById('driversList');
        const countEl = document.getElementById('driverCount');

        list.innerHTML = '';
        countEl.textContent = drivers.length;

        const activeDriverIds = new Set();

        drivers.forEach(d => {
            const stars = '★'.repeat(Math.round(d.average_rating || 0)) + '☆'.repeat(5 - Math.round(d.average_rating || 0));

            // Add marker if has location
            if (d.current_lat && d.current_lng) {
                activeDriverIds.add(d.user_id);

                if (driverMarkers[d.user_id]) {
                    driverMarkers[d.user_id].setLatLng([d.current_lat, d.current_lng]);
                } else {
                    const marker = L.marker([d.current_lat, d.current_lng], {
                        icon: L.divIcon({
                            className: 'custom-driver-icon',
                            html: `<div style="background: ${d.is_available ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6b7280, #4b5563)'}; color: white; padding: 8px; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3);"><i class="fas fa-truck"></i></div>`,
                            iconSize: [40, 40],
                            iconAnchor: [20, 20]
                        })
                    }).addTo(map);
                    driverMarkers[d.user_id] = marker;
                }
            }

            // Create driver card
            const card = document.createElement('div');
            card.className = `driver-card glass p-4 rounded-2xl border-2 ${d.is_available ? 'border-green-500/30 status-online' : 'border-gray-500/30 status-offline'} cursor-pointer`;

            card.innerHTML = `
                <div class="flex items-start gap-3">
                    <div class="relative">
                        <div class="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                            ${(d.driver_name || 'س')[0]}
                        </div>
                        <div class="absolute -bottom-1 -right-1 w-5 h-5 ${d.is_available ? 'bg-green-500' : 'bg-gray-500'} rounded-full border-2 border-white ${d.is_available ? 'pulse-ring' : ''}"></div>
                    </div>
                    
                    <div class="flex-1">
                        <div class="flex items-center justify-between mb-1">
                            <h3 class="font-bold text-gray-900 text-lg">${d.driver_name || 'سائق'}</h3>
                            <span class="text-green-600 font-bold text-lg">${d.price} د.ل</span>
                        </div>
                        
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-yellow-500 text-sm">${stars}</span>
                            <span class="text-gray-400 text-xs">(${d.rating_count})</span>
                            <span class="px-2 py-0.5 rounded-full text-xs font-bold ${d.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">
                                ${d.is_available ? '🟢 متاح' : '⚫ غير متاح'}
                            </span>
                        </div>
                        
                        ${!d.current_lat ? '<div class="text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded mb-2">📍 لا يوجد موقع</div>' : ''}
                        
                        <div class="grid grid-cols-3 gap-2 mt-3">
                            ${d.phone_number ? `
                            <a href="https://wa.me/${d.phone_number.replace(/\D/g, '')}" 
                               target="_blank" 
                               onclick="event.stopPropagation()"
                               class="bg-green-500 text-white text-xs py-2 rounded-lg hover:bg-green-600 transition-all flex items-center justify-center gap-1 shadow-md">
                                <i class="fab fa-whatsapp"></i> واتساب
                            </a>` : ''}
                            
                            ${d.current_lat ? `
                            <button onclick="event.stopPropagation(); map.setView([${d.current_lat}, ${d.current_lng}], 15); driverMarkers[${d.user_id}].openPopup();" 
                                    class="bg-blue-500 text-white text-xs py-2 rounded-lg hover:bg-blue-600 transition-all shadow-md">
                                📍 الموقع
                            </button>` : ''}
                            
                            <button onclick="event.stopPropagation(); openDriverChat(${d.user_id}, '${d.driver_name}');" 
                                    class="bg-purple-500 text-white text-xs py-2 rounded-lg hover:bg-purple-600 transition-all shadow-md">
                                💬 دردشة
                            </button>
                        </div>
                        
                        <button onclick="event.stopPropagation(); openBookingModal(${d.user_id}, '${d.driver_name}', ${d.price})" 
                                class="w-full btn-primary text-white text-sm font-bold py-2.5 rounded-lg mt-3 shadow-lg ${!d.is_available ? 'opacity-50' : ''}">
                            🚚 طلب الآن
                        </button>
                    </div>
                </div>
            `;

            if (d.current_lat && d.current_lng) {
                card.onclick = () => {
                    map.setView([d.current_lat, d.current_lng], 15);
                    driverMarkers[d.user_id].openPopup();
                };
            }

            list.appendChild(card);
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

// Chat functions
let currentChatOrderId = null;
let chatWs = null;

function openDriverChat(driverId, driverName) {
    // For now, show a message that chat requires an active order
    showToast('الدردشة متاحة فقط عند وجود طلب نشط مع السائق', 'info');
}

function openChatModal(orderId) {
    currentChatOrderId = orderId;
    document.getElementById('chatModal').classList.remove('hidden');
    loadChatHistory(orderId);
    connectChatWebSocket(orderId);
}

function closeChatModal() {
    document.getElementById('chatModal').classList.add('hidden');
    if (chatWs) {
        chatWs.close();
        chatWs = null;
    }
}

async function loadChatHistory(orderId) {
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/chat/${orderId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const messages = await res.json();
        const container = document.getElementById('chatMessages');
        container.innerHTML = '';
        messages.forEach(msg => appendMessage(msg));
        scrollToBottom();
    } catch (e) { console.error(e); }
}

function connectChatWebSocket(orderId) {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/chat/ws/${orderId}/${currentUserId}`;
    chatWs = new WebSocket(wsUrl);

    chatWs.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        appendMessage(msg);
        scrollToBottom();
    };
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const content = input.value.trim();
    if (!content || !chatWs) return;

    chatWs.send(JSON.stringify({ content, type: 'text' }));
    input.value = '';
}

function sendLocation() {
    if (!chatWs) return;
    navigator.geolocation.getCurrentPosition(pos => {
        chatWs.send(JSON.stringify({
            content: `${pos.coords.latitude},${pos.coords.longitude}`,
            type: 'location'
        }));
    });
}

function appendMessage(msg) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    const isMe = msg.sender_id === currentUserId;

    div.className = `flex ${isMe ? 'justify-end' : 'justify-start'}`;
    div.innerHTML = `
        <div class="max-w-[70%] ${isMe ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900'} px-4 py-2 rounded-2xl shadow-md">
            ${msg.message_type === 'location' ?
            `<a href="https://www.google.com/maps?q=${msg.content}" target="_blank" class="flex items-center gap-2">
                    <i class="fas fa-map-marker-alt"></i> عرض الموقع
                </a>` :
            `<p>${msg.content}</p>`
        }
            <span class="text-xs opacity-75 block mt-1">${new Date(msg.created_at).toLocaleTimeString('ar')}</span>
        </div>
    `;
    container.appendChild(div);
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
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
        container.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">لا توجد طلبات سابقة</p>';
        return;
    }

    orders.forEach(o => {
        const div = document.createElement('div');
        div.className = 'glass p-3 rounded-xl border border-white/10';
        div.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <p class="font-bold text-gray-900 text-sm">${o.driver_name || 'غير معروف'}</p>
                    <p class="text-xs text-gray-500">${new Date(o.created_at).toLocaleDateString('ar')}</p>
                </div>
                <div class="text-right">
                    <span class="px-2 py-1 rounded-lg text-xs text-white ${getStatusColor(o.status)}">${o.status}</span>
                    ${['accepted', 'en_route'].includes(o.status) ?
                `<button onclick="openChatModal(${o.id})" class="block mt-1 text-xs bg-purple-500 text-white px-2 py-1 rounded-lg">💬 محادثة</button>` : ''}
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function getStatusColor(status) {
    const colors = {
        'pending': 'bg-yellow-500',
        'accepted': 'bg-blue-500',
        'en_route': 'bg-indigo-500',
        'completed': 'bg-green-600',
        'cancelled': 'bg-red-500'
    };
    return colors[status] || 'bg-gray-400';
}

// Modal functions
function openBookingModal(driverId, driverName, price) {
    document.getElementById('modalDriverName').textContent = driverName;
    document.getElementById('modalPrice').textContent = price;
    document.getElementById('bookingModal').classList.remove('hidden');

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
                showToast('تم إرسال طلبك بنجاح! 🎉', 'success');
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

// Rating functions
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
            star.classList.remove('text-gray-200');
            star.classList.add('text-yellow-400');
        } else {
            star.classList.add('text-gray-200');
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
            showToast('شكراً لتقييمك! ⭐', 'success');
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

// SOS function
async function triggerSOS() {
    if (!navigator.geolocation) {
        showToast('الموقع غير مدعوم في متصفحك', 'error');
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_URL}/safety/sos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                })
            });

            if (res.ok) {
                showToast('تم إرسال إشارة الطوارئ! 🚨', 'success');
            }
        } catch (e) {
            showToast('فشل إرسال الإشارة', 'error');
        }
    }, () => {
        showToast('فشل الحصول على الموقع', 'error');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();

    // Enter key to send message
    document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
});
