import "./global.css";
import { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, SafeAreaView, Alert } from "react-native";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebase";
import * as FileSystem from 'expo-file-system/legacy';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { buscarEmpleadoPorDni, registrarFichajeLocal, LocalEmpleado } from "./database";
import { triggerSync, startAutoSync } from "./syncService";

type AppState = "SETUP" | "RESTING" | "SELECT_DIRECTION" | "DNI_INPUT" | "SCANNING" | "SUCCESS" | "ERROR";

// Base64 de un JPEG real ultra-pequeño (1x1 píxeles) para simular captura de evidencia física funcional offline
const FAKE_JPG_BASE64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

export default function App() {
  const [appState, setAppState] = useState<AppState>("SETUP");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Permisos y referencia de la cámara real
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState<CameraView | null>(null);
  
  // Estado para Setup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");

  // Estado para Fichaje
  const [tipoFichaje, setTipoFichaje] = useState<"IN" | "OUT">("IN");
  const [dni, setDni] = useState("");
  const [empleadoActivo, setEmpleadoActivo] = useState<LocalEmpleado | null>(null);
  const [fichajeError, setFichajeError] = useState("");

  // Estado para Sync
  const [syncingStatus, setSyncingStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");

  // Escuchar estado de sesión Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setAppState("RESTING");
        // Iniciar sincronización automática (timer en segundo plano cada 15 min)
        const autoSyncTimer = startAutoSync(15 * 60 * 1000);
        
        // Ejecutar primera sincronización rápida al conectar
        handleSync();
        
        return () => {
          if (autoSyncTimer) clearInterval(autoSyncTimer);
        };
      } else {
        setAppState("SETUP");
      }
    });
    return unsubscribe;
  }, []);

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Capturar foto automáticamente de la cámara real tras un retardo al entrar en SCANNING
  useEffect(() => {
    if (appState === "SCANNING" && cameraRef) {
      const timer = setTimeout(async () => {
        try {
          // Tomar foto con la cámara frontal
          const photo = await cameraRef.takePictureAsync({
            quality: 0.3,
            base64: false
          });

          if (photo && photo.uri) {
            const localPhotoUri = `${FileSystem.documentDirectory}fichaje_${Date.now()}.jpg`;
            await FileSystem.copyAsync({
              from: photo.uri,
              to: localPhotoUri
            });

            // Registrar fichaje localmente en SQLite
            if (empleadoActivo) {
              await registrarFichajeLocal(
                empleadoActivo.id,
                empleadoActivo.nombre,
                empleadoActivo.apellido,
                empleadoActivo.dni,
                tipoFichaje,
                localPhotoUri
              );
            }

            setAppState("SUCCESS");
            
            // Re-sincronizar de inmediato si hay internet de fondo
            triggerSync().catch(() => {});
            
            setTimeout(() => {
              setDni("");
              setEmpleadoActivo(null);
              setAppState("RESTING");
            }, 3000);
          } else {
            throw new Error("No se pudo capturar la foto.");
          }
        } catch (err) {
          console.error("Error al registrar fichaje con cámara real:", err);
          setFichajeError("Fallo al capturar evidencia facial con la cámara.");
          setAppState("ERROR");
          setTimeout(() => setAppState("RESTING"), 4000);
        }
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [appState, cameraRef]);

  // Ejecutar ciclo de sincronización manual
  const handleSync = async () => {
    if (!auth.currentUser) return;
    setSyncingStatus("syncing");
    setSyncMessage("Sincronizando...");
    try {
      const res = await triggerSync();
      setSyncingStatus("success");
      setSyncMessage(`Sincronizado: ${res.empleadosDescargados} empleados, ${res.fichajesSubidos} fichajes subidos.`);
      setTimeout(() => setSyncMessage(""), 5000);
    } catch (e: any) {
      setSyncingStatus("error");
      setSyncMessage(`Error de red: Fichando offline.`);
      setTimeout(() => setSyncMessage(""), 5000);
    }
  };

  // Vincular dispositivo (Setup)
  const handleSetup = async () => {
    if (!email || !password) {
      setSetupError("Completá todos los campos.");
      return;
    }
    setSetupLoading(true);
    setSetupError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // El useEffect de Auth se encargará de pasar a RESTING y sync
    } catch (err: any) {
      console.error(err);
      setSetupError(
        err.code === "auth/invalid-credential" 
          ? "Credenciales incorrectas de Kiosco." 
          : `Error: ${err.message}`
      );
    } finally {
      setSetupLoading(false);
    }
  };

  // Desvincular dispositivo (Logout administrador)
  const handleUnlink = async () => {
    try {
      await signOut(auth);
      setEmail("");
      setPassword("");
      setAppState("SETUP");
    } catch (e) {
      console.error("Error al desvincular:", e);
    }
  };

  // Teclado numérico en pantalla
  const handleKeyPress = (val: string) => {
    if (dni.length < 10) {
      setDni(prev => prev + val);
    }
  };

  const handleBackspace = () => {
    setDni(prev => prev.slice(0, -1));
  };

  // Confirmar ingreso de DNI y validar
  const handleConfirmDni = async () => {
    if (dni.length < 6) return;
    
    try {
      const emp = await buscarEmpleadoPorDni(dni);
      if (emp) {
        setEmpleadoActivo(emp);
        
        // Solicitar permisos de cámara si no están otorgados
        if (!permission || !permission.granted) {
          const res = await requestPermission();
          if (!res.granted) {
            setFichajeError("Permiso de cámara frontal obligatorio para registrar asistencia.");
            setAppState("ERROR");
            setTimeout(() => setAppState("RESTING"), 4000);
            return;
          }
        }
        
        setAppState("SCANNING");
      } else {
        // DNI no encontrado
        setFichajeError("DNI no registrado en Personal Base");
        setAppState("ERROR");
        setTimeout(() => {
          setDni("");
          setAppState("RESTING");
        }, 4000);
      }
    } catch (err) {
      console.error(err);
      setFichajeError("Error de base de datos local");
      setAppState("ERROR");
      setTimeout(() => setAppState("RESTING"), 4000);
    }
  };

  // ==========================================
  // RENDERS DE PANTALLAS
  // ==========================================

  // 1. Setup / Login de Dispositivo
  const renderSetupScreen = () => (
    <View className="flex-1 bg-neutral-950 items-center justify-center p-8">
      <View className="w-full max-w-md bg-neutral-900 border border-neutral-800 p-8 rounded-3xl shadow-2xl">
        <Text className="text-red-500 font-bold text-3xl tracking-widest text-center mb-1">EmergenciAPP</Text>
        <Text className="text-white text-lg font-light text-center tracking-wide opacity-80 mb-8">Vincular Terminal de Asistencia</Text>
        
        {setupError ? (
          <View className="bg-red-950/40 border border-red-800/60 p-3 rounded-lg mb-4">
            <Text className="text-red-400 text-sm text-center">{setupError}</Text>
          </View>
        ) : null}

        <View className="space-y-4">
          <View>
            <Text className="text-neutral-400 text-xs uppercase tracking-wider mb-2 font-medium">Email del Kiosco</Text>
            <TextInput
              className="bg-neutral-800 text-white px-4 h-12 rounded-xl border border-neutral-700 focus:border-red-500"
              placeholder="kiosco.base1@emergenciapp.com"
              placeholderTextColor="#555"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View className="mt-4">
            <Text className="text-neutral-400 text-xs uppercase tracking-wider mb-2 font-medium">Contraseña de Seguridad</Text>
            <TextInput
              className="bg-neutral-800 text-white px-4 h-12 rounded-xl border border-neutral-700 focus:border-red-500"
              placeholder="••••••••••••••"
              placeholderTextColor="#555"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity 
            className="bg-red-600 h-12 rounded-xl items-center justify-center mt-8 active:bg-red-700 flex-row"
            onPress={handleSetup}
            disabled={setupLoading}
          >
            {setupLoading ? (
              <ActivityIndicator color="white" className="mr-2" />
            ) : null}
            <Text className="text-white font-bold text-base">VINCULAR TERMINAL</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-neutral-500 text-[10px] text-center mt-8">
          Exclusivo para terminales y bases autorizadas de EmergenciAPP.
        </Text>
      </View>
    </View>
  );

  // 2. Pantalla de Reposo (Reloj y Marca)
  const renderRestingScreen = () => (
    <View className="flex-1 bg-black items-center justify-center p-8 relative">
      {/* Botón de desvinculación superior derecho oculto */}
      <TouchableOpacity 
        className="absolute top-12 right-6 p-4 z-30" 
        onPress={() => {
          Alert.alert(
            "Desvincular Terminal",
            "¿Desvincular esta terminal del sistema? Requerirá iniciar sesión de nuevo.",
            [
              { text: "Cancelar", style: "cancel" },
              { text: "Desvincular", style: "destructive", onPress: handleUnlink }
            ]
          );
        }}
      >
        <Text className="text-neutral-400 text-xl">⚙️</Text>
      </TouchableOpacity>

      {/* Indicador de Sincronización Superior Izquierdo */}
      <View className="absolute top-12 left-6 flex-row items-center p-2 rounded-lg bg-neutral-900/60 border border-neutral-800">
        <TouchableOpacity onPress={handleSync} className="flex-row items-center">
          <View className={`w-2.5 h-2.5 rounded-full mr-2 ${syncingStatus === 'syncing' ? 'bg-orange-500 animate-pulse' : syncingStatus === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
          <Text className="text-neutral-400 text-xs font-mono">
            {currentUser ? `Base: ${currentUser.email?.split('@')[0]}` : 'Conectado'}
          </Text>
        </TouchableOpacity>
      </View>

      {syncMessage ? (
        <View className="absolute top-24 left-6 right-6 bg-neutral-900/90 border border-neutral-800 p-2.5 rounded-lg z-20">
          <Text className="text-neutral-300 text-xs text-center font-mono">{syncMessage}</Text>
        </View>
      ) : null}
      
      <TouchableOpacity 
        className="items-center w-full py-16" 
        onPress={() => setAppState("SELECT_DIRECTION")} 
        activeOpacity={0.9}
      >
        <Text className="text-red-500 font-bold text-4xl md:text-6xl tracking-wider text-center mb-1">EmergenciAPP</Text>
        <Text className="text-white text-xs md:text-lg tracking-wider opacity-60 text-center mb-16">CONTROL DE ASISTENCIA</Text>
        
        <Text className="text-white text-7xl md:text-9xl font-light text-center mb-8">
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text className="text-neutral-400 text-sm md:text-base uppercase tracking-widest text-center mb-16">
          {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>

        <View className="bg-neutral-900/40 border border-neutral-800 px-6 py-3 rounded-full">
          <Text className="text-neutral-400 text-xs uppercase tracking-widest animate-pulse">Toque la pantalla para fichar</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  // 3. Pantalla de Selección de Dirección (Entrada o Salida)
  const renderDirectionScreen = () => (
    <View className="flex-1 bg-neutral-950 items-center justify-center p-8">
      <Text className="text-neutral-400 text-lg uppercase tracking-wider mb-4">¿Qué desea registrar?</Text>
      <Text className="text-white text-4xl font-bold text-center mb-12">Seleccione el Tipo de Fichaje</Text>
      
      <View className="flex-row space-x-6 w-full max-w-2xl px-6">
        <TouchableOpacity 
          className="flex-1 bg-emerald-600 rounded-3xl py-12 items-center justify-center shadow-lg active:bg-emerald-700 mr-3"
          onPress={() => {
            setTipoFichaje("IN");
            setAppState("DNI_INPUT");
          }}
        >
          <Text className="text-white text-7xl mb-4">🟢</Text>
          <Text className="text-white font-extrabold text-3xl tracking-wider">ENTRADA</Text>
          <Text className="text-emerald-100 text-sm mt-2 opacity-80">Inicio de Guardia</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          className="flex-1 bg-red-600 rounded-3xl py-12 items-center justify-center shadow-lg active:bg-red-700 ml-3"
          onPress={() => {
            setTipoFichaje("OUT");
            setAppState("DNI_INPUT");
          }}
        >
          <Text className="text-white text-7xl mb-4">🔴</Text>
          <Text className="text-white font-extrabold text-3xl tracking-wider">SALIDA</Text>
          <Text className="text-red-100 text-sm mt-2 opacity-80">Fin de Guardia</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        className="mt-12 px-8 py-3 rounded-full bg-neutral-900 border border-neutral-800"
        onPress={() => setAppState("RESTING")}
      >
        <Text className="text-neutral-400 font-medium text-base">CANCELAR</Text>
      </TouchableOpacity>
    </View>
  );

  // 4. Pantalla de Ingreso de DNI (Teclado numérico)
  const renderDniInputScreen = () => (
    <View className="flex-1 bg-neutral-950 items-center justify-center p-8">
      <View className="w-full max-w-lg items-center">
        <View className="flex-row items-center mb-6">
          <View className={`w-3.5 h-3.5 rounded-full mr-2.5 ${tipoFichaje === 'IN' ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <Text className="text-neutral-400 text-sm uppercase tracking-widest font-semibold">
            Fichando {tipoFichaje === "IN" ? "Entrada" : "Salida"}
          </Text>
        </View>

        <Text className="text-white text-3xl font-light mb-6">Ingrese su DNI</Text>
        
        {/* Pantalla del DNI */}
        <View className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl h-20 items-center justify-center mb-8 px-4">
          <Text className="text-white text-4xl font-mono tracking-widest font-bold">
            {dni || "DNI"}
          </Text>
        </View>

        {/* Grilla del Teclado */}
        <View className="w-full space-y-3">
          {[
            ["1", "2", "3"],
            ["4", "5", "6"],
            ["7", "8", "9"],
            ["⌫", "0", "✓"]
          ].map((row, rIdx) => (
            <View key={rIdx} className="flex-row w-full justify-between mt-3">
              {row.map((key) => {
                const isSpecial = key === "⌫" || key === "✓";
                let btnStyle = "bg-neutral-850 border border-neutral-800";
                let textStyle = "text-white text-2xl font-bold";
                
                if (key === "✓") {
                  btnStyle = tipoFichaje === "IN" ? "bg-emerald-600" : "bg-red-600";
                  textStyle = "text-white text-3xl font-extrabold";
                }

                return (
                  <TouchableOpacity
                    key={key}
                    className={`w-[30%] h-16 rounded-xl items-center justify-center active:opacity-60 ${btnStyle}`}
                    onPress={() => {
                      if (key === "⌫") handleBackspace();
                      else if (key === "✓") handleConfirmDni();
                      else handleKeyPress(key);
                    }}
                  >
                    <Text className={textStyle}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Botón de volver */}
        <TouchableOpacity 
          className="mt-8 px-8 py-3 rounded-full bg-neutral-900 border border-neutral-800"
          onPress={() => {
            setDni("");
            setAppState("SELECT_DIRECTION");
          }}
        >
          <Text className="text-neutral-400 font-medium text-base">VOLVER</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // 5. Pantalla de Escaneo (Cámara activa y captura)
  const renderScanningScreen = () => (
    <View className="flex-1 bg-neutral-950 items-center justify-center p-8 relative">
      <Text className="text-white text-3xl font-bold mb-4 text-center">Registrando Evidencia</Text>
      <Text className="text-neutral-400 text-sm text-center mb-8 px-6">
        Por favor, mire a la cámara frontal de la tablet para registrar la imagen de seguridad.
      </Text>
      
      {/* Círculo de la Cámara */}
      <View className="w-80 h-80 rounded-full border-4 border-red-500 overflow-hidden items-center justify-center bg-neutral-900 relative shadow-2xl">
        <CameraView 
          style={{ width: "100%", height: "100%" }}
          facing="front"
          ref={(ref) => setCameraRef(ref)}
        />
        {/* Línea de escaneo láser simulada */}
        <View className="absolute left-0 right-0 h-1 bg-red-500 opacity-60 animate-bounce top-1/2" />
      </View>
      
      <Text className="text-red-500 mt-12 text-sm font-semibold tracking-wider animate-pulse">CAPTURANDO IMAGEN DE SEGURIDAD...</Text>
    </View>
  );

  // 6. Pantalla de Éxito
  const renderSuccessScreen = () => (
    <View className="flex-1 bg-emerald-600 items-center justify-center p-8">
      <View className="w-36 h-36 bg-white rounded-full items-center justify-center mb-8 shadow-lg">
        <Text className="text-emerald-600 text-8xl font-bold">✓</Text>
      </View>
      
      <Text className="text-white text-5xl font-extrabold mb-4 tracking-wide text-center">¡Fichaje Registrado!</Text>
      <Text className="text-emerald-100 text-3xl font-bold text-center mb-2">
        {empleadoActivo?.apellido ? `${empleadoActivo.apellido}, ${empleadoActivo.nombre}` : empleadoActivo?.nombre}
      </Text>
      
      <View className="bg-emerald-700/50 border border-emerald-500/40 px-6 py-2.5 rounded-full mt-6">
        <Text className="text-white font-bold tracking-wider text-base uppercase font-mono">
          {tipoFichaje === "IN" ? "ENTRADA REGISTRADA" : "SALIDA REGISTRADA"}
        </Text>
      </View>

      <Text className="text-emerald-200 mt-12 opacity-80 text-sm font-mono">{currentTime.toLocaleTimeString()}</Text>
    </View>
  );

  // 7. Pantalla de Error
  const renderErrorScreen = () => (
    <View className="flex-1 bg-red-600 items-center justify-center p-8">
      <View className="w-36 h-36 bg-white rounded-full items-center justify-center mb-8 shadow-lg">
        <Text className="text-red-600 text-8xl font-bold">✗</Text>
      </View>
      
      <Text className="text-white text-5xl font-extrabold mb-4 tracking-wide text-center">Fichaje Fallido</Text>
      <Text className="text-red-100 text-2xl font-bold text-center max-w-md px-6">
        {fichajeError || "Error al validar la información local."}
      </Text>

      <Text className="text-red-200 mt-12 opacity-80 text-sm">Volviendo a intentar...</Text>
    </View>
  );

  const renderScreen = () => {
    switch (appState) {
      case "SETUP": return renderSetupScreen();
      case "RESTING": return renderRestingScreen();
      case "SELECT_DIRECTION": return renderDirectionScreen();
      case "DNI_INPUT": return renderDniInputScreen();
      case "SCANNING": return renderScanningScreen();
      case "SUCCESS": return renderSuccessScreen();
      case "ERROR": return renderErrorScreen();
      default: return renderSetupScreen();
    }
  };

  return (
    <>
      <StatusBar style="light" hidden={appState !== "SETUP"} />
      {renderScreen()}
    </>
  );
}
