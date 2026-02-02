// ✅ GPS REAL: inicia rastreamento assim que o usuário entra no game
useEffect(() => {
  if (!user) return;
  if (view === AppState.LOGIN) return;
  if (isTestMode) return;

  if (!('geolocation' in navigator)) {
    console.error("Geolocation não suportado neste dispositivo/navegador.");
    return;
  }

  let watchId: number | null = null;

  // Primeira leitura rápida (ajuda a centralizar logo de cara)
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      handleNewLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp || Date.now(),
      }, false);
    },
    (err) => {
      console.error("Erro ao obter localização inicial:", err);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 2000,
    }
  );

  // Rastreamento contínuo
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      handleNewLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp || Date.now(),
      }, false);
    },
    (err) => {
      console.error("Erro no watchPosition:", err);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 2000,
    }
  );

  return () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  };
}, [user, view, isTestMode]);
