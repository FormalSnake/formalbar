import { useEffect, useState } from "react";

export function Clock(): JSX.Element {
  const [time, setTime] = useState<Date>(new Date());
  
  useEffect(() => {
    // Update time every second
    const intervalId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Format: 20:55 - Thursday 13 Mar
  const formattedTime = (): string => {
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const day = time.toLocaleDateString('en-US', { weekday: 'long' });
    const date = time.getDate();
    const month = time.toLocaleDateString('en-US', { month: 'short' });
    
    return `${hours}:${minutes} - ${day} ${date} ${month}`;
  };

  return (
    <div className="text-xs font-medium px-1.5">
      {formattedTime()}
    </div>
  );
}
