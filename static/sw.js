self.addEventListener('push', function (event) {
    let data = { title: "إشعار جديد", body: "لديك تحديث جديد" };
    if (event.data) {
        data = JSON.parse(event.data.text());
    }

    const options = {
        body: data.body,
        icon: 'https://cdn-icons-png.flaticon.com/512/3774/3774092.png', // Water Truck Icon placeholder
        badge: 'https://cdn-icons-png.flaticon.com/512/3774/3774092.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            { action: 'explore', title: 'عرض التفاصيل', icon: 'images/checkmark.png' },
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('dashboard.html')
    );
});
