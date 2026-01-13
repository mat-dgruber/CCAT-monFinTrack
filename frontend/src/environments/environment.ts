export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000/api',
  appUrl: 'http://localhost:4200',
  firebaseConfig: {
    apiKey: "AIzaSyCMmJapjjZLp0h3TyI7v3r2z9FSD-pxfeQ",
    authDomain: "ccat-monfintrack.firebaseapp.com",
    projectId: "ccat-monfintrack",
    storageBucket: "ccat-monfintrack.firebasestorage.app",
    messagingSenderId: "605486079278",
    appId: "1:605486079278:web:5bf39b2d2cb032bf962ebf",
    measurementId: "G-9B3JJ3LY34"
  },
  firebaseVapidKey: "BPJa6EYXgmh2aJafafwQ5Gtuztotw6LoZKECW9y4C8JMfRQD2a5oUF-kw0JmB3Ls7MEgMN4knWco4bEH7ViWh7Y", // Pegar no Firebase Console -> Cloud Messaging -> Web Push
  sessionDuration: 60000 // 1 minuto para teste
};
