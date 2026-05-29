import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuración de Firebase para EmergenciAPP
const firebaseConfig = {
  apiKey: "AIzaSyDHoOtH4qFzJ4fJZr6pN09Z6mSs3OTAu0o",
  authDomain: "adm-inteligente-en-emergencias.firebaseapp.com",
  projectId: "adm-inteligente-en-emergencias",
  storageBucket: "adm-inteligente-en-emergencias.firebasestorage.app",
  messagingSenderId: "528488904677",
  appId: "1:528488904677:web:153e4d83bf11683d85210c",
  measurementId: "G-S9CGDV3VN7"
};

// Inicializar Firebase (evita re-inicialización al recargar la app en desarrollo)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Inicializar Auth con persistencia nativa mediante AsyncStorage
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Inicializar Firestore y obtener referencia
export const db = getFirestore(app);

export default app;
