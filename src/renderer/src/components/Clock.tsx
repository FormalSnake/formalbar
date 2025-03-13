import { useEffect, useState } from "react";

export function Clock(): JSX.Element {
  const [time, setTime] = useState<string>(formatTime(new Date()));
  
  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  useEffect(() => {
    // Update time every second
    const intervalId = setInterval(() => {
      setTime(formatTime(new Date()));
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="text-sm font-medium px-2">
      {time}
    </div>
  );
}
