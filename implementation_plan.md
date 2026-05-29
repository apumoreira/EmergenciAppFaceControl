# Implementación Técnica del Kiosco de Control de Asistencia (Offline-First)

Este documento detalla el plan de desarrollo para dejar lista y funcional la **Aplicación Kiosco (React Native / Expo)** enfocada en tablets/celulares, incorporando un motor local transaccional, captura de evidencia física y la **Opción C de Seguridad** (autenticación única por dispositivo).

Se ha **simplificado el diseño** eliminando el módulo de enrolamiento local: los empleados se cargan únicamente en el panel web de EmergenciAPP (**Personal Base**), y las tablets los descargan de forma automática.

---

## User Review Required

> [!IMPORTANT]
> ### Arquitectura de Base de Datos y Fichajes
> - **Almacenamiento Local**: Utilizaremos `expo-sqlite` para una base de datos local robusta y transaccional, evitando las limitaciones críticas de almacenamiento y rendimiento de `AsyncStorage`.
> - **Evidencia Fotográfica**: Para evitar sobrecargar la base de datos local y Firebase, las fotos de evidencia se guardarán como archivos físicos JPG en la tablet (`expo-file-system`) y en la base de datos SQLite solo guardaremos la **ruta local del archivo** (`photo_path`). Al sincronizarse, la foto se convertirá a Base64 para subirse a Firestore, y se eliminará el archivo local viejo para mantener limpio el disco de la tablet.
> - **Flujo de Entrada/Salida**: Añadiremos un selector inicial para que el empleado defina explícitamente si está fichando **Entrada** o **Salida**, garantizando precisión en el reporte.

> [!CAUTION]
> ### Seguridad Blindada y Sincronización (Opción C)
> - **Autenticación Única por Tablet**: Al instalar la app en cada base física, el administrador iniciará sesión *una sola vez* con una cuenta dedicada exclusiva de esa base (ej. `kiosco.central@emergenciapp.com`). La sesión quedará abierta de forma permanente y segura en el dispositivo. No hay contraseñas grabadas en el código fuente.
> - **Reglas de Firestore y deviceId**: Todos los logs que la tablet suba a Firebase Firestore (`face_control_logs`) llevarán en el campo `deviceId` su ID de usuario autenticado (`request.auth.uid`). Las reglas de seguridad de Firestore exigirán que `request.resource.data.deviceId == request.auth.uid`, impidiendo que una tablet comprometida suplante a otra o manipule registros ajenos.

---

## Proposed Changes

### [Kiosko App Componentes]

---

#### [MODIFY] [App.tsx](file:///c:/Proyectos%20Web/EmergenciAPPFaceControl/App.tsx)
- **Pantalla de Configuración Inicial (Login)**: Al arrancar la app por primera vez (o si no hay sesión activa), mostrar una pantalla de Login exclusiva para el administrador para ingresar las credenciales del Kiosko de esa base.
- **Selector de Fichaje**: Incorporar la pantalla inicial con dos botones gigantes: **"Fichar Entrada"** (Verde) y **"Fichar Salida"** (Rojo).
- **Flujo de Fichaje Simplificado (DNI + Foto)**: Al ingresar el DNI, validar contra el SQLite local. Si existe, activar la cámara del dispositivo, tomar la foto de evidencia física en tiempo real, guardar el log y mostrar pantalla de éxito.
- **Eliminado**: Se quita por completo el módulo de enrolamiento oculto (ya no es necesario tomar fotos de alta ni crear formularios en la tablet).

#### [NEW] [database.ts](file:///c:/Proyectos%20Web/EmergenciAPPFaceControl/database.ts)
- Inicializar la base de datos local SQLite (`emergenciapp_kiosk.db`).
- Crear tablas estructuradas:
  - `empleados`: `id` (PK), `nombre`, `apellido`, `dni` (UNIQUE).
  - `fichajes`: `id` (PK), `empleado_id`, `empleado_nombre`, `empleado_dni`, `timestamp`, `tipo` (IN/OUT), `foto_path`, `sincronizado` (0 o 1).
- Proveer métodos para:
  - Insertar/actualizar empleados descargados.
  - Insertar un fichaje local (offline) registrando la ruta de la foto física en disco.
  - Obtener fichajes pendientes de sincronización (`sincronizado = 0`).
  - Marcar fichajes como sincronizados y limpiar las imágenes viejas correspondientes del almacenamiento local.

#### [NEW] [syncService.ts](file:///c:/Proyectos%20Web/EmergenciAPPFaceControl/syncService.ts)
- Configurar la conexión con Firebase Firestore utilizando la sesión del Kiosco autenticado.
- **Subida (Upload)**:
  - Obtener fichajes con `sincronizado = 0` desde SQLite.
  - Subir cada fichaje a `/face_control_logs` inyectando el `uid` actual de la sesión en el campo `deviceId`. Si tiene foto local, convertirla temporalmente a Base64 para subirla en el payload.
  - Al subir con éxito, actualizar `sincronizado = 1` y borrar el archivo JPG del dispositivo.
- **Descarga (Download - NUEVO ENFOQUE)**:
  - Consultar la colección `/usuarios_base` (Personal Base) en Firebase.
  - Descargar la lista de empleados activos (`id`, `nombre`, `apellido`, `dni`).
  - Guardar/actualizar los perfiles descargados en la tabla SQLite `empleados`.
- Integrar un timer periódico en segundo plano que ejecute este ciclo de sincronización automáticamente.

---

## Verification Plan

### Automated & Manual Tests
1. **Flujo de Configuración y Login Único**:
   - Abrir la app limpia y verificar que solicita obligatoriamente el Login de Dispositivo.
   - Ingresar credenciales válidas y comprobar que inicia sesión y carga la pantalla de reposo con reloj. Reiniciar la app y verificar que la sesión persiste.
2. **Descarga Automática de Personal Base**:
   - Agregar o modificar un empleado en el panel web de "Personal Base" en EmergenciAPP.
   - Ejecutar la sincronización en la tablet y comprobar en los logs de SQLite que el empleado se descargó y se puede encontrar por su DNI de forma local.
3. **Fichaje Offline con Foto de Evidencia**:
   - Desconectar el WiFi de la tablet.
   - Fichar Entrada ingresando el DNI del empleado.
   - Verificar que la tablet valida su nombre localmente (*"Bienvenido, Perez, Juan"*), toma la foto de la cámara frontal, la guarda físicamente en el storage de la tablet (`expo-file-system`) y almacena el registro en SQLite con `sincronizado = 0`.
4. **Sincronización y Validación de Reglas**:
   - Conectar el WiFi y activar sincronización.
   - Verificar en Firebase Firestore que el log se creó en `/face_control_logs` con la foto en Base64 y que el campo `deviceId` coincide estrictamente con el `uid` del Kiosco logueado.
   - Comprobar que el archivo JPG local fue eliminado de la tablet tras la subida exitosa.
