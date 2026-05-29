import * as SQLite from 'expo-sqlite';

export interface LocalEmpleado {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
}

export interface LocalFichaje {
  id: string;
  empleado_id: string;
  empleado_nombre: string;
  empleado_dni: string;
  timestamp: string; // ISO String
  tipo: 'IN' | 'OUT';
  foto_path: string | null;
  sincronizado: number; // 0 = false, 1 = true
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Obtiene la instancia abierta de la base de datos SQLite.
 * Si es la primera llamada, abre la base de datos e inicializa el esquema de tablas.
 */
export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('emergenciapp_kiosk.db');
    await initDB(dbInstance);
  }
  return dbInstance;
}

/**
 * Inicializa el esquema de base de datos creando las tablas e índices necesarios.
 */
async function initDB(db: SQLite.SQLiteDatabase) {
  // Habilitar modo WAL para mayor velocidad de escritura concurrente
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS empleados (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      dni TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fichajes (
      id TEXT PRIMARY KEY,
      empleado_id TEXT NOT NULL,
      empleado_nombre TEXT NOT NULL,
      empleado_dni TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      tipo TEXT NOT NULL,
      foto_path TEXT,
      sincronizado INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_empleados_dni ON empleados(dni);
    CREATE INDEX IF NOT EXISTS idx_fichajes_sincronizado ON fichajes(sincronizado);
  `);
}

/**
 * Guarda o actualiza una lista de empleados descargada desde Firebase.
 * Corre en una única transacción SQLite para máxima velocidad y atomicidad.
 */
export async function saveEmpleadosLocales(empleadosList: LocalEmpleado[]) {
  const db = await getDB();
  
  await db.withTransactionAsync(async () => {
    for (const emp of empleadosList) {
      await db.runAsync(
        'INSERT OR REPLACE INTO empleados (id, nombre, apellido, dni) VALUES (?, ?, ?, ?)',
        [emp.id, emp.nombre, emp.apellido, emp.dni]
      );
    }
  });
}

/**
 * Elimina toda la base local de empleados (útil para recargas completas).
 */
export async function clearEmpleadosLocales() {
  const db = await getDB();
  await db.runAsync('DELETE FROM empleados');
}

/**
 * Busca un empleado local por su DNI.
 * Hace uso del índice para dar una respuesta ultra-rápida.
 */
export async function buscarEmpleadoPorDni(dni: string): Promise<LocalEmpleado | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<LocalEmpleado>(
    'SELECT id, nombre, apellido, dni FROM empleados WHERE dni = ?',
    [dni.trim()]
  );
  return row || null;
}

/**
 * Retorna todos los empleados guardados localmente.
 */
export async function getTodosEmpleadosLocales(): Promise<LocalEmpleado[]> {
  const db = await getDB();
  return await db.getAllAsync<LocalEmpleado>(
    'SELECT id, nombre, apellido, dni FROM empleados ORDER BY apellido ASC, nombre ASC'
  );
}

/**
 * Registra un fichaje local (offline). 
 * Se guarda de inmediato con sincronizado = 0 para subirse a Firebase más tarde.
 */
export async function registrarFichajeLocal(
  empleadoId: string,
  nombre: string,
  apellido: string,
  dni: string,
  tipo: 'IN' | 'OUT',
  fotoPath: string | null
): Promise<LocalFichaje> {
  const db = await getDB();
  const id = `${empleadoId}_${Date.now()}`;
  const timestamp = new Date().toISOString();
  const nombreCompleto = apellido ? `${apellido}, ${nombre}` : nombre;
  
  await db.runAsync(
    `INSERT INTO fichajes (id, empleado_id, empleado_nombre, empleado_dni, timestamp, tipo, foto_path, sincronizado) 
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, empleadoId, nombreCompleto, dni, timestamp, tipo, fotoPath]
  );

  return {
    id,
    empleado_id: empleadoId,
    empleado_nombre: nombreCompleto,
    empleado_dni: dni,
    timestamp,
    tipo,
    foto_path: fotoPath,
    sincronizado: 0
  };
}

/**
 * Obtiene todos los fichajes que no se han subido a Firebase Firestore.
 */
export async function getFichajesPendientes(): Promise<LocalFichaje[]> {
  const db = await getDB();
  return await db.getAllAsync<LocalFichaje>(
    'SELECT id, empleado_id, empleado_nombre, empleado_dni, timestamp, tipo, foto_path, sincronizado FROM fichajes WHERE sincronizado = 0 ORDER BY timestamp ASC'
  );
}

/**
 * Marca una lista de fichajes como sincronizados con Firebase.
 */
export async function marcarFichajesComoSincronizados(ids: string[]) {
  const db = await getDB();
  if (ids.length === 0) return;
  
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync('UPDATE fichajes SET sincronizado = 1 WHERE id = ?', [id]);
    }
  });
}

/**
 * Limpia los fichajes antiguos ya sincronizados de la base de datos
 * para liberar memoria del dispositivo.
 */
export async function limpiarFichajesViejosSincronizados(diasAntiguedad = 7) {
  const db = await getDB();
  const limite = new Date();
  limite.setDate(limite.getDate() - diasAntiguedad);
  const limiteIso = limite.toISOString();
  
  await db.runAsync(
    'DELETE FROM fichajes WHERE sincronizado = 1 AND timestamp < ?',
    [limiteIso]
  );
}
