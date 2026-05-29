# Tareas de Implementación - EmergenciAPPFaceControl

- [x] 1. Configuración de Base de Datos y Almacenamiento Local (SQLite)
  - [x] Instalar dependencias necesarias (`expo-sqlite`, `expo-file-system`).
  - [x] Crear archivo `database.ts` para inicializar base de datos SQLite y crear tablas `empleados` y `fichajes`.
  - [x] Implementar métodos CRUD locales (guardar empleados descargados, insertar fichaje local, leer logs sin sincronizar).

- [x] 2. Diseño del Selector de Fichaje y Flujos en UI
  - [x] Añadir pantalla inicial de Selección de Dirección (Fichar Entrada / Fichar Salida).
  - [x] Integrar teclado numérico/búsqueda para ingreso de DNI.
  - [x] Simular/Conectar la cámara para toma de foto de evidencia en tiempo real (guardada en disco local).
  - [x] Ajustar pantallas de Éxito y Error según validaciones locales de SQLite.

- [x] 3. Servicio de Autenticación y Sincronización (Firebase Sync)
  - [x] Implementar pantalla de configuración/login inicial para vincular la tablet a una cuenta de base (Opción C).
  - [x] Crear `syncService.ts` para la descarga asíncrona de empleados activos desde `usuarios_base` a SQLite.
  - [x] Implementar la subida asíncrona de fichajes offline a `/face_control_logs` (convirtiendo fotos a Base64 y limpiando JPGs locales).
  - [x] Configurar timer en segundo plano para el ciclo automático de sincronización.

- [x] 4. Verificación y Pruebas
  - [x] Probar flujo completo de login único en Kiosco.
  - [x] Probar descarga y actualización local de empleados tras cambios en la web.
  - [x] Probar fichaje offline (sin internet) con evidencia guardada y verificar posterior subida y limpieza de archivos al recuperar red.
