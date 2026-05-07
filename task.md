# Tareas de Implementación - EmergenciAPPFaceControl

- [x] 1. Configuración Inicial
  - [x] Inicializar repositorio Git local.
  - [x] Crear proyecto base en React Native usando Expo (`npx create-expo-app@latest`).
  - [x] Configurar TypeScript, TailwindCSS (NativeWind) y estructura de carpetas.
  
- [x] 2. Diseño Minimalista (UI/UX)
  - [x] Pantalla de Reposo (Reloj y Logo).
  - [x] Pantalla de Escaneo (Cámara activa).
  - [x] Mensajes de confirmación ("Ingreso registrado").
  - [x] Módulo oculto de Enrolamiento (Registro de empleados y foto).

- [ ] 3. Base de Datos Local y Offline-First
  - [ ] Integrar `AsyncStorage` o SQLite para la base de empleados locales.
  - [ ] Lógica para guardar registros de entrada/salida localmente.
  - [ ] Sincronización en segundo plano con Firebase Firestore al detectar conexión.

- [ ] 4. Reconocimiento Facial y Proximidad
  - [ ] Instalar librerías nativas (`react-native-vision-camera`, o expo-face-detector).
  - [ ] Implementar la detección del rostro en tiempo real y validación contra la DB local.
  - [ ] Integrar sensor de proximidad (`react-native-proximity` o similar) para encender/apagar cámara.

- [ ] 5. Módulo de Enrolamiento (Admin)
  - [ ] Formulario básico (Nombre, DNI/ID).
  - [ ] Captura de rostro y guardado de "embeddings" (descriptores faciales).
