# EmergenciAPP - Control de Acceso Facial

Este documento detalla el plan de implementación para la nueva herramienta de control de ingreso y salida de personal mediante reconocimiento facial.

## Arquitectura y Tecnologías Propuestas

### Arquitectura Seleccionada: Aplicación Nativa con Expo / React Native
Basado en tus respuestas, construiremos una aplicación nativa enfocada en **Android (Celular o Tablet)**:
- **Dispositivo**: Celular o Tablet Android.
- **Sensor de Proximidad**: Utilizaremos librerías nativas (`react-native-proximity` u opciones similares) integradas con Expo Dev Client para detectar presencia y despertar la pantalla o salir del modo reposo.
- **Reconocimiento Facial**: Integraremos `react-native-vision-camera` junto con procesadores de frames para detección facial en tiempo real (o `expo-camera` con `expo-face-detector` si resulta más estable para este caso de uso offline).
- **Offline-first**: Implementaremos almacenamiento local robusto (ej. `AsyncStorage` o base de datos local SQLite/WatermelonDB) para los descriptores faciales y datos del personal, con sincronización asíncrona hacia Firebase Firestore.
- **Enrolamiento (NUEVO)**: Desarrollaremos un módulo oculto o protegido por PIN dentro de la misma app para que un administrador pueda dar de alta a los empleados, tomarles la fotografía inicial y extraer los descriptores biométricos que se guardarán en la base de datos local.

> [!TIP]
> Si el dispositivo que se va a utilizar es una PC o una tablet genérica puesta en un soporte, la Opción 1 (PWA) es mucho más rápida de desarrollar y fácil de mantener junto con el ecosistema web actual de EmergenciAPP.

> [!IMPORTANT]
> ## User Review Required
> 
> Por favor revisa la arquitectura propuesta y decide si prefieres que avancemos con una **PWA** (aplicación web instalable) o una **Aplicación Nativa** (React Native).

> [!WARNING]
> ## Open Questions
> 
> 1. **Dispositivo Físico**: ¿En qué dispositivo físico planean instalar esto? (Ej. Tablet Android, iPad, Computadora con webcam conectada, Kiosko dedicado).
> 2. **Sensor de Proximidad**: Si elegimos PWA (web), ¿estás de acuerdo en que la cámara analice constantemente a bajos recursos si hay alguien al frente para "despertar" la interfaz, o planean integrar un sensor físico que mande una señal (como un click)?
> 3. **Base de Datos Inicial**: Para la validación facial, ¿cómo planean enrolar (registrar la cara) a los empleados por primera vez? ¿Se hará en esta misma app o ya tienen fotos cargadas en Firebase?

## Fases de Implementación

### Fase 1: Inicialización del Repositorio y Entorno
- Crear repositorio Git en la carpeta actual (`EmergenciAPPFaceControl`).
- Inicializar el proyecto con el framework elegido (Next.js/React PWA o Expo).
- Configurar CSS Vanilla para la interfaz minimalista.
- Configurar Firebase.

### Fase 2: Interfaz Minimalista
- Pantalla de reposo (oscura, con el logo de EmergenciaApp y reloj).
- Pantalla de detección ("Acérquese a la cámara").
- Pantalla de éxito ("Bienvenido [Nombre], Ingreso registrado").

### Fase 3: Motor Offline-First y Firebase
- Configurar base de datos local (IndexedDB o SQLite).
- Lógica de sincronización bi-direccional con Firebase Firestore.

### Fase 4: Integración del Reconocimiento Facial
- Cargar modelos de IA localmente.
- Escanear rostro -> Comparar con DB local -> Generar registro de entrada/salida -> Guardar localmente -> Subir a Firebase si hay internet.

## Verification Plan

### Manual Verification
- Apagar el WiFi del dispositivo, realizar un escaneo facial exitoso, y comprobar que el registro se guardó localmente. Al reconectar el WiFi, verificar que el registro aparezca en Firebase.
- Comprobar la fluidez del reconocimiento (FPS) y que la pantalla vuelva al estado de reposo tras la inactividad.
