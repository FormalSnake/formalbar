import { useEffect, useState } from "react";
import { Button } from "./ui/button";

interface SpotifyTrack {
  artist: string;
  title: string;
  isPlaying: boolean;
}

export function SpotifyNowPlaying(): JSX.Element {
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSpotifyData = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const result = await window.electron.ipcRenderer.invoke('get-spotify-track');
      
      if (result && !result.error) {
        setTrack(result);
      } else if (result.error) {
        setError(result.error);
        console.error("Spotify error:", result.error);
      } else {
        setTrack(null);
      }
    } catch (err) {
      setError(`Failed to fetch Spotify data: ${err instanceof Error ? err.message : String(err)}`);
      console.error("Error fetching Spotify data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch Spotify data when component mounts
    fetchSpotifyData();

    // Set up interval to refresh Spotify data every 2 seconds
    const intervalId = setInterval(fetchSpotifyData, 2000);

    // Add listener for refresh events
    const refreshListener = () => {
      fetchSpotifyData();
    };
    
    window.electron.ipcRenderer.on("refresh-data", refreshListener);

    return () => {
      clearInterval(intervalId);
      window.electron.ipcRenderer.removeListener("refresh-data", refreshListener);
    };
  }, []);

  if (loading && !track) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">Spotify error</div>;
  }

  if (!track || !track.isPlaying) {
    return <div className="text-sm text-muted-foreground">Not playing</div>;
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="max-w-[300px] font-medium group relative"
      onClick={() => window.electron.ipcRenderer.invoke('focus-spotify')}
      title={`${track.title} by ${track.artist}`}
    >
      <div className="overflow-hidden w-full">
        <span className="truncate block group-hover:hidden">
          {track.title} - {track.artist}
        </span>
        <div className="hidden group-hover:block overflow-hidden">
          <span className="inline-block whitespace-nowrap animate-marquee">
            {track.title} - {track.artist} • {track.title} - {track.artist}
          </span>
        </div>
      </div>
    </Button>
  );
}
