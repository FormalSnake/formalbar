import { useEffect, useState } from "react";
import { BatteryFull, BatteryMedium, BatteryLow, BatteryWarning } from "lucide-react";

export function BatteryIndicator(): JSX.Element {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  useEffect(() => {
    const updateBatteryStatus = async (): Promise<void> => {
      try {
        const result = await window.electron.ipcRenderer.invoke('get-battery-status');
        if (result && typeof result.level === 'number') {
          setBatteryLevel(result.level);
        }
      } catch (err) {
        console.error("Error fetching battery status:", err);
      }
    };

    // Update immediately and then every 30 seconds
    updateBatteryStatus();
    const intervalId = setInterval(updateBatteryStatus, 30000);

    return () => clearInterval(intervalId);
  }, []);

  // If battery info isn't available yet
  if (batteryLevel === null) {
    return <div className="text-xs font-medium px-1.5"></div>;
  }

  // Choose the appropriate battery icon based on level
  const getBatteryIcon = () => {
    if (batteryLevel >= 75) {
      return <BatteryFull className="h-4 w-4" />;
    } else if (batteryLevel >= 40) {
      return <BatteryMedium className="h-4 w-4" />;
    } else if (batteryLevel >= 15) {
      return <BatteryLow className="h-4 w-4" />;
    } else {
      return <BatteryWarning className="h-4 w-4" />;
    }
  };

  return (
    <div className="text-xs font-medium px-1.5 flex items-center gap-1">
      {getBatteryIcon()}
      <span>{batteryLevel}%</span>
    </div>
  );
}
