import { collection, getDocs, doc, setDoc, query, where, Timestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import * as FileSystem from 'expo-file-system/legacy';
import {
  saveEmpleadosLocales,
  getFichajesPendientes,
  marcarFichajesComoSincronizados,
  limpiarFichajesViejosSincronizados,
  LocalEmpleado
} from './database';

let isSyncing = false;

/**
 * Descarga todos los empleados activos de la colección 'usuarios_base' en Firestore
 * y los guarda en la base de datos SQLite local de la tablet.
 */
export async function descargarEmpleadosLocales(): Promise<number> {
  if (!auth.currentUser) {
    throw new Error('Debe haber un dispositivo de Kiosco autenticado para sincronizar.');
  }

  try {
    const usuariosBaseRef = collection(db, 'usuarios_base');
    // Descargar empleados activos (activo !== false)
    const q = query(usuariosBaseRef, where('activo', '!=', false));
    const querySnapshot = await getDocs(q);

    const empleadosList: LocalEmpleado[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const dni = String(data.dni || '').trim();
      const nombre = String(data.nombre || '').trim();
      const apellido = String(data.apellido || '').trim();

      // Solo guardamos empleados que tengan al menos Nombre y DNI
      if (dni && nombre) {
        empleadosList.push({
          id: doc.id,
          nombre,
          apellido,
          dni
        });
      }
    });

    if (empleadosList.length > 0) {
      await saveEmpleadosLocales(empleadosList);
    }

    return empleadosList.length;
  } catch (error) {
    console.error('Error al descargar empleados desde Firestore:', error);
    throw error;
  }
}

/**
 * Obtiene los fichajes registrados offline de la base de datos local SQLite,
 * los convierte y los sube a Firestore de forma segura.
 * Elimina las fotos del disco local una vez subidas con éxito para liberar espacio.
 */
export async function subirFichajesLocales(): Promise<number> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Debe haber un dispositivo de Kiosco autenticado para subir fichajes.');
  }

  try {
    const fichajesPendientes = await getFichajesPendientes();
    if (fichajesPendientes.length === 0) return 0;

    let subidosCount = 0;

    for (const fichaje of fichajesPendientes) {
      const logId = fichaje.id;
      let base64Photo = '';

      // Si el fichaje tiene una foto local física, la leemos como Base64
      if (fichaje.foto_path) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(fichaje.foto_path);
          if (fileInfo.exists) {
            base64Photo = await FileSystem.readAsStringAsync(fichaje.foto_path, {
              encoding: 'base64'
            });
          }
        } catch (photoErr) {
          console.warn(`Error al leer archivo de foto local para log ${logId}:`, photoErr);
        }
      }

      // Convertir timestamp string a Timestamp de Firebase
      const timestampDate = new Date(fichaje.timestamp);
      const firestoreTimestamp = Timestamp.fromDate(timestampDate);

      // Payload estricto según firestore.rules (Opción C de Seguridad)
      const payload = {
        employeeId: fichaje.empleado_id,
        employeeName: fichaje.empleado_nombre,
        employeeDni: fichaje.empleado_dni,
        timestamp: firestoreTimestamp,
        type: fichaje.tipo,
        photo: base64Photo, // String Base64 de la evidencia
        deviceId: currentUser.uid // Forzado a que coincida con el UID autenticado
      };

      // Guardar en Firestore (/face_control_logs/{logId})
      const logDocRef = doc(db, 'face_control_logs', logId);
      await setDoc(logDocRef, payload);

      // Cambiar estado local en SQLite a sincronizado
      await marcarFichajesComoSincronizados([logId]);
      subidosCount++;

      // Eliminar el archivo de foto físico local del dispositivo
      if (fichaje.foto_path) {
        try {
          await FileSystem.deleteAsync(fichaje.foto_path, { idempotent: true });
        } catch (delErr) {
          console.warn(`Error al eliminar archivo físico local: ${fichaje.foto_path}`, delErr);
        }
      }
    }

    // Limpieza periódica de registros viejos sincronizados de SQLite
    await limpiarFichajesViejosSincronizados(7);

    return subidosCount;
  } catch (error) {
    console.error('Error al subir fichajes locales a Firestore:', error);
    throw error;
  }
}

/**
 * Ejecuta un ciclo de sincronización completo (Descarga de empleados + Subida de fichajes).
 */
export async function triggerSync(): Promise<{ empleadosDescargados: number; fichajesSubidos: number }> {
  if (isSyncing) {
    throw new Error('Sincronización en curso...');
  }

  isSyncing = true;
  try {
    const empleadosDescargados = await descargarEmpleadosLocales();
    const fichajesSubidos = await subirFichajesLocales();
    return { empleadosDescargados, fichajesSubidos };
  } finally {
    isSyncing = false;
  }
}

/**
 * Inicializa un timer periódico para sincronización automática en segundo plano.
 * @param intervalMs Intervalo en milisegundos (por defecto 15 minutos)
 */
export function startAutoSync(intervalMs = 15 * 60 * 1000): NodeJS.Timeout | null {
  if (!auth.currentUser) return null;

  // Ejecución inicial rápida al iniciar
  triggerSync().catch((e) => console.log('AutoSync Inicial Fallido:', e.message));

  const timer = setInterval(() => {
    triggerSync().catch((e) => console.log('AutoSync Periódico Fallido:', e.message));
  }, intervalMs);

  return timer;
}
