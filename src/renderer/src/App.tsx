import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { SpotifyNowPlaying } from "@/components/SpotifyNowPlaying"
import { Clock } from "@/components/Clock"
import { BatteryIndicator } from "@/components/Battery"
import { WiFiIndicator } from "@/components/WiFi"

interface Workspace {
  workspace: string;
}

interface Window {
  windowId: string;
  windowTitle: string;
  appName: string;
}

function App(): JSX.Element {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeSpace, setActiveSpace] = useState<Workspace[]>([]);
  const [activeWindow, setActiveWindow] = useState<Window[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const switchWorkspace = async (workspace: Workspace) => {
    // Update UI immediately for better responsiveness
    setActiveSpace([workspace]);

    // Then invoke the actual space switch
    await window.electron.ipcRenderer.invoke('switch-space', workspace.workspace);
  }

  const fetchWorkspaces = async (): Promise<void> => {
    try {
      // Only show loading state on initial load, not during refreshes
      if (workspaces.length === 0) {
        setLoading(true);
      }

      setError(null);
      const result = await window.electron.ipcRenderer.invoke('get-spaces');
      const activeSpace = await window.electron.ipcRenderer.invoke('get-active-space');

      if (Array.isArray(result)) {
        setWorkspaces(result);
        setActiveSpace(activeSpace);
      } else {
        // Handle any non-array responses or errors
        setError("Invalid response format");
        console.error("Invalid workspace data:", result);
      }
    } catch (err) {
      setError(`Failed to fetch workspaces: ${err instanceof Error ? err.message : String(err)}`);
      console.error("Error fetching workspaces:", err);
    } finally {
      setLoading(false);
    }
  };

  const normalizeWindow = (win: any): Window => ({
    windowId: String(win["window-id"]),
    windowTitle: win["window-title"],
    appName: win["app-name"],
  });

  const getWindow = async () => {
    try {
      // Don't set loading state during window refresh
      const result = await window.electron.ipcRenderer.invoke("get-active-window");
      setActiveWindow(result.map(normalizeWindow));
    } catch (err) {
      console.error("Error fetching active window:", err);
      setActiveWindow([]);
    }
  };

  useEffect(() => {
    // Fetch workspaces when component mounts
    fetchWorkspaces();
    getWindow();

    if (!window.electron || !window.electron.ipcRenderer) {
      console.error("Electron IPC Renderer not available!");
      return;
    }

    const refreshListener = async () => {
      console.log("Received refresh event from main process ✅");

      try {
        // Fetch data without showing loading state
        const spaces = await window.electron.ipcRenderer.invoke('get-spaces');
        const activeSpace = await window.electron.ipcRenderer.invoke('get-active-space');
        const windowResult = await window.electron.ipcRenderer.invoke("get-active-window");

        // Only update state if we got valid data
        if (Array.isArray(spaces)) {
          setWorkspaces(spaces);
          setActiveSpace(activeSpace);
        }

        if (Array.isArray(windowResult)) {
          setActiveWindow(windowResult.map(normalizeWindow));
        }
      } catch (err) {
        console.error("Error during refresh:", err);
      }
    };

    console.log("Registering refresh-data listener...");
    window.electron.ipcRenderer.on("refresh-data", refreshListener);

    return () => {
      console.log("Removing refresh-data listener...");
      window.electron.ipcRenderer.removeListener("refresh-data", refreshListener);
    };
  }, []);

  return (
    <div className="flex flex-row p-0.5 px-3 gap-x-0.5 items-center h-[32px]">
      {loading ? (
        <div className="text-xs">Loading workspaces...</div>
      ) : error ? (
        <div className="flex flex-row gap-x-1 items-center">
          <div className="text-xs text-red-500">{error}</div>
          <Button size="xs" variant="outline" onClick={fetchWorkspaces}>Retry</Button>
        </div>
      ) : (
        <>
          {workspaces.map((ws) => (
            <Button
              key={ws.workspace}
              size="xs"
              variant={activeSpace[0].workspace === ws.workspace ? "default" : "outline"}
              className="min-w-6 font-medium"
              onClick={() => switchWorkspace(ws)}
            >
              {ws.workspace}
            </Button>
          ))}
          {
            activeWindow.length > 0 &&
            (
              <Button
                size="xs"
                variant="outline"
                className="min-w-6 max-w-[300px] font-medium group relative"
                onClick={() => window.electron.ipcRenderer.invoke('switch-window', activeWindow[0].windowId)}
                title={activeWindow[0].appName + " / " + activeWindow[0].windowTitle}
              >
                <div className="overflow-hidden w-full">
                  <span className="truncate block group-hover:hidden">
                    {activeWindow[0].appName + " / " + activeWindow[0].windowTitle}
                  </span>
                  <div className="hidden group-hover:block overflow-hidden">
                    <span className="inline-block whitespace-nowrap animate-marquee">
                      {activeWindow[0].appName + " / " + activeWindow[0].windowTitle + " • " +
                        activeWindow[0].appName + " / " + activeWindow[0].windowTitle}
                    </span>
                  </div>
                </div>
              </Button>
            )
          }
          {workspaces.length === 0 && (
            <div className="text-xs">No workspaces found</div>
          )}
          {/* Center clock */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <Clock />
          </div>
          
          {/* Right section */}
          <div className="ml-auto flex items-center gap-x-2">
            <SpotifyNowPlaying />
            <WiFiIndicator />
            <BatteryIndicator />
          </div>
        </>
      )}
    </div>
  );
}

export default App
