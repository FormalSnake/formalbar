import { useEffect, useState } from "react";
import { Wifi, WifiOff, WifiLow, WifiHigh, WifiZero } from "lucide-react";

export function WiFiIndicator(): JSX.Element {
  const [wifiStatus, setWifiStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const updateWiFiStatus = async (): Promise<void> => {
      try {
        const result = await window.electron.ipcRenderer.invoke('get-wifi-status');
        if (result && typeof result.status === 'string') {
          setWifiStatus(result.status);
        }
      } catch (err) {
        console.error("Error fetching WiFi status:", err);
        setWifiStatus("disconnected");
      } finally {
        setLoading(false);
      }
    };

    // Update immediately and then every 30 seconds
    updateWiFiStatus();
    const intervalId = setInterval(updateWiFiStatus, 30000);

    return () => clearInterval(intervalId);
  }, []);

  // If WiFi info isn't available yet
  if (loading) {
    return <div className="text-xs font-medium px-1.5"></div>;
  }

  // Choose the appropriate WiFi icon based on status
  const getWiFiIcon = () => {
    switch (wifiStatus) {
      case "high":
        return <Wifi className="h-4 w-4" />;
      case "medium":
        return <WifiHigh className="h-4 w-4" />;
      case "low":
        return <WifiLow className="h-4 w-4" />;
      case "no-internet":
        return <WifiZero className="h-4 w-4" />;
      case "disconnected":
      default:
        return <WifiOff className="h-4 w-4" />;
    }
  };

  return (
    <div className="text-xs font-medium px-1.5 flex items-center gap-1">
      {getWiFiIcon()}
    </div>
  );
}
