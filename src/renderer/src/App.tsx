import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

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
    await window.electron.ipcRenderer.invoke('switch-space', workspace.workspace);
    // Don't call fetchWorkspaces here - the main process will trigger a refresh
  }

  const fetchWorkspaces = async (): Promise<void> => {
    // if workspaces is not empty, return
    if (workspaces.length > 0) {
      const activeSpace = await window.electron.ipcRenderer.invoke('get-active-space');
      setActiveSpace(activeSpace);
      return;
    }
    try {
      setLoading(true);
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
      const result = await window.electron.ipcRenderer.invoke("get-active-window");
      setActiveWindow(result.map(normalizeWindow));
    } catch (err) {
      setError(`Failed to fetch active window: ${err instanceof Error ? err.message : String(err)}`);
      console.error("Error fetching active window:", err);
      setActiveWindow([]);
    } finally {
      setLoading(false);
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

    const refreshListener = () => {
      console.log("Received refresh event from main process ✅");
      fetchWorkspaces();
      getWindow();
    };

    console.log("Registering refresh-data listener...");
    window.electron.ipcRenderer.on("refresh-data", refreshListener);

    return () => {
      console.log("Removing refresh-data listener...");
      window.electron.ipcRenderer.removeListener("refresh-data", refreshListener);
    };
  }, []);

  return (
    <div className="flex flex-row p-1 gap-x-1 items-center h-[32px]">
      {loading ? (
        <div className="text-sm">Loading workspaces...</div>
      ) : error ? (
        <div className="flex flex-row gap-x-2 items-center">
          <div className="text-sm text-red-500">{error}</div>
          <Button size="sm" variant="outline" onClick={fetchWorkspaces}>Retry</Button>
        </div>
      ) : (
        <>
          {workspaces.map((ws) => (
            <Button
              key={ws.workspace}
              size="sm"
              variant={activeSpace[0].workspace === ws.workspace ? "default" : "outline"}
              className="min-w-8 font-medium"
              onClick={() => switchWorkspace(ws)}
            >
              {ws.workspace}
            </Button>
          ))}
          {
            activeWindow.length > 0 &&
            (
              <Button
                size="sm"
                variant="outline"
                className="min-w-8 font-medium"
                onClick={() => window.electron.ipcRenderer.invoke('switch-window', activeWindow[0].windowId)}


              >
                {activeWindow[0].appName + " / " + activeWindow[0].windowTitle}
              </Button>
            )
          }
          {workspaces.length === 0 && (
            <div className="text-sm">No workspaces found</div>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={fetchWorkspaces}
          >
            Refresh
          </Button>
        </>
      )}
    </div>
  );
}

export default App
