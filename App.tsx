import "./global.css";
import { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { View, Text, TouchableOpacity, SafeAreaView } from "react-native";

type AppState = "RESTING" | "SCANNING" | "SUCCESS" | "ENROLLMENT";

export default function App() {
  const [appState, setAppState] = useState<AppState>("RESTING");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Reloj para la pantalla de reposo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSimulateProximity = () => {
    setAppState("SCANNING");
    // Simulamos que a los 3 segundos reconoce a alguien
    setTimeout(() => {
      setAppState("SUCCESS");
      // Vuelve a reposo después de mostrar el éxito
      setTimeout(() => {
        setAppState("RESTING");
      }, 3000);
    }, 3000);
  };

  const renderRestingScreen = () => (
    <View className="flex-1 bg-black items-center justify-center p-8">
      <TouchableOpacity 
        className="absolute top-10 right-10 p-4" 
        onPress={() => setAppState("ENROLLMENT")}
        onLongPress={() => setAppState("ENROLLMENT")}
      >
        <Text className="text-neutral-800 text-xs">⚙️</Text>
      </TouchableOpacity>
      
      <TouchableOpacity className="items-center" onPress={handleSimulateProximity} activeOpacity={0.9}>
        <Text className="text-red-500 font-bold text-5xl tracking-widest mb-2">EmergenciAPP</Text>
        <Text className="text-white text-xl tracking-wider opacity-80 mb-12">Control de Accesos</Text>
        
        <Text className="text-white text-8xl font-light mb-8">
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <Text className="text-neutral-400 text-lg uppercase tracking-widest">
          {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>

        <View className="mt-16 animate-pulse opacity-50 flex-row items-center">
          <Text className="text-neutral-500 text-sm">Toque la pantalla o acérquese para comenzar</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderScanningScreen = () => (
    <View className="flex-1 bg-neutral-900 items-center justify-center relative">
      <Text className="text-white text-2xl font-semibold mb-8 z-10">Buscando rostro...</Text>
      
      {/* Placeholder para la cámara */}
      <View className="w-80 h-80 rounded-full border-4 border-red-500 overflow-hidden items-center justify-center bg-neutral-800">
        <Text className="text-neutral-500">Cámara Activa</Text>
      </View>
      
      <Text className="text-neutral-400 mt-8 text-center px-10">
        Por favor, mire directamente a la cámara y asegúrese de que haya buena iluminación.
      </Text>

      <TouchableOpacity 
        className="absolute bottom-10 px-8 py-3 rounded-full bg-neutral-800"
        onPress={() => setAppState("RESTING")}
      >
        <Text className="text-white">Cancelar</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSuccessScreen = () => (
    <View className="flex-1 bg-green-600 items-center justify-center">
      <View className="w-32 h-32 bg-white rounded-full items-center justify-center mb-8">
        <Text className="text-green-600 text-6xl">✓</Text>
      </View>
      <Text className="text-white text-4xl font-bold mb-2">¡Ingreso Registrado!</Text>
      <Text className="text-white text-xl opacity-90">Bienvenido, Usuario de Prueba</Text>
      <Text className="text-white mt-8 opacity-75">{new Date().toLocaleTimeString()}</Text>
    </View>
  );

  const renderEnrollmentScreen = () => (
    <SafeAreaView className="flex-1 bg-neutral-900 px-6 pt-12">
      <View className="flex-row justify-between items-center mb-8">
        <Text className="text-white text-2xl font-bold">Módulo de Enrolamiento</Text>
        <TouchableOpacity onPress={() => setAppState("RESTING")}>
          <Text className="text-red-500 text-lg">Cerrar</Text>
        </TouchableOpacity>
      </View>
      
      <View className="bg-neutral-800 p-6 rounded-2xl mb-6">
        <Text className="text-neutral-400 mb-2">Nombre Completo</Text>
        <View className="bg-neutral-700 h-12 rounded-lg mb-4"></View>
        
        <Text className="text-neutral-400 mb-2">DNI / Identificación</Text>
        <View className="bg-neutral-700 h-12 rounded-lg mb-6"></View>
        
        <TouchableOpacity className="bg-red-500 h-12 rounded-lg items-center justify-center">
          <Text className="text-white font-bold text-lg">Capturar Rostro</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-neutral-500 text-sm text-center mt-auto mb-4">
        Acceso restringido solo a administradores.
      </Text>
    </SafeAreaView>
  );

  const renderScreen = () => {
    switch (appState) {
      case "RESTING": return renderRestingScreen();
      case "SCANNING": return renderScanningScreen();
      case "SUCCESS": return renderSuccessScreen();
      case "ENROLLMENT": return renderEnrollmentScreen();
      default: return renderRestingScreen();
    }
  };

  return (
    <>
      <StatusBar style="light" hidden={appState !== "ENROLLMENT"} />
      {renderScreen()}
    </>
  );
}
