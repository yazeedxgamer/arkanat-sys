// === firebase-messaging-sw.js ===
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCXscXexb0bvKEeJ9QKxnrhlB70F0ej7fs",
    authDomain: "arkanat-287ff.firebaseapp.com",
    projectId: "arkanat-287ff",
    storageBucket: "arkanat-287ff.appspot.com",
    messagingSenderId: "773019407626",
    appId: "1:773019407626:web:3b534f6c26c970693b16f3",
    measurementId: "G-81PYGC42FX"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
    console.log('Received background message', payload);
    const notificationTitle = payload.notification.title || 'اشعار جديد';
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon-192.png',
        data: {
            url: payload.fcmOptions?.link || '/'
        }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data.url));
});
