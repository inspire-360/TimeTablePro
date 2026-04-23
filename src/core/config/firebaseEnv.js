const fallbackConfig = {
  apiKey: 'AIzaSyAYvCc77YYch8iYjXUyAE2pp6H3k5UXuVQ',
  authDomain: 'timetablepro-e6695.firebaseapp.com',
  projectId: 'timetablepro-e6695',
  storageBucket: 'timetablepro-e6695.firebasestorage.app',
  messagingSenderId: '509396899611',
  appId: '1:509396899611:web:1e8978c8a1b88d8209a5be',
};

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackConfig.appId,
};
