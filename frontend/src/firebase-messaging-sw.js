
// Scripts de importação para worker (importScripts é global em SW)
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Configuração do Firebase (copie do seu environment ou injete via build)
// Como o SW roda "separado", precisamos colocar os dados aqui hardcoded ou via replace no build.
// Para simplificar, o firebase-messaging-sw geralmente busca a config ou você inicializa assim:

firebase.initializeApp({
  apiKey: "AIzaSyCMmJapjjZLp0h3TyI7v3r2z9FSD-pxfeQ",
  authDomain: "ccat-monfintrack.firebaseapp.com",
  projectId: "ccat-monfintrack",
  storageBucket: "ccat-monfintrack.firebasestorage.app",
  messagingSenderId: "605486079278",
  appId: "1:605486079278:web:5bf39b2d2cb032bf962ebf"
});

const messaging = firebase.messaging();

// Handler de Background
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Mensagem em background: ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/assets/icons/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
