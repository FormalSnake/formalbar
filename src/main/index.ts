import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn } from 'child_process'
import { execSync } from 'child_process'

let windows: BrowserWindow[] = [];

function createWindows(): void {
  // Close existing windows if recreating
  windows.forEach(win => win.destroy());
  windows = [];

  const displays = screen.getAllDisplays();

  displays.forEach(display => {
    const { x, y, width } = display.bounds;

    let win = new BrowserWindow({
      x,
      y,
      width: width,
      height: 32,
      show: false,
      autoHideMenuBar: true,
      frame: false,
      roundedCorners: false,
      thickFrame: false,
      resizable: false,
      focusable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      movable: false,
      fullscreenable: false,
      transparent: true,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    });

    win.on('ready-to-show', () => {
      win.show();
      win.setBounds({ x, y, width, height: 32 });
      win.setAlwaysOnTop(true, 'normal');
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    });

    win.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url);
      return { action: 'deny' };
    });

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'));
    }

    windows.push(win);
  });
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron');

  //const refresh = process.argv.includes('--refresh');
  const refresh = process.env.REFRESH === 'true';

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  ipcMain.handle('get-spaces', async () => {
    try {
      return await runAerospaceCommand();
    } catch (error) {
      console.error("Command failed:", error);
      return { error };
    }
  });

  ipcMain.handle('get-active-space', async () => {
    try {
      return await getActiveSpace();
    } catch (error) {
      console.error("Command failed:", error);
      return { error };
    }
  });

  ipcMain.handle('switch-space', async (_event, args) => {
    try {
      return switchSpace(args);
    } catch (error) {
      console.error("Command failed:", error);
      return { error };
    }
  });

  ipcMain.handle('get-active-window', async () => {
    try {
      return await getActiveWindow();
    } catch (error) {
      console.error("Command failed:", error);
      return { error };
    }
  });

  ipcMain.handle('get-spotify-track', async () => {
    try {
      return await getSpotifyTrack();
    } catch (error) {
      console.error("Spotify command failed:", error);
      return { error: String(error) };
    }
  });

  ipcMain.handle('focus-spotify', () => {
    try {
      const script = `
        tell application "Spotify"
          activate
        end tell
      `;
      execSync(`osascript -e '${script}'`);
      return { success: true };
    } catch (error) {
      console.error("Failed to focus Spotify:", error);
      return { error: String(error) };
    }
  });

  ipcMain.handle('get-battery-status', async () => {
    try {
      // For macOS, use AppleScript to get battery info
      const script = `
        use framework "Foundation"
        use framework "IOKit"
        use scripting additions

        set batteryInfo to current application's NSProcessInfo's processInfo()'s systemUptime()
        
        set powerInfo to current application's IOPSCopyPowerSourcesInfo()
        set powerSources to current application's IOPSCopyPowerSourcesList(powerInfo)
        
        set batteryData to {}
        
        repeat with i from 1 to count of powerSources
            set powerSource to item i of powerSources
            set powerSourceInfo to current application's IOPSGetPowerSourceDescription(powerInfo, powerSource)
            
            if powerSourceInfo's current application's kIOPSTypeKey as string is "InternalBattery" then
                set end of batteryData to {|level|:(powerSourceInfo's current application's kIOPSCurrentCapacityKey as number) / (powerSourceInfo's current application's kIOPSMaxCapacityKey as number) * 100, |charging|:(powerSourceInfo's current application's kIOPSPowerSourceStateKey as string is "AC Power")}
            end if
        end repeat
        
        return batteryData
      `;
      
      const result = execSync(`osascript -e '${script}'`).toString().trim();
      
      try {
        // Parse the result - AppleScript returns a list that looks like {{level:85, charging:false}}
        const match = result.match(/\{level:(\d+(?:\.\d+)?), charging:(true|false)\}/);
        if (match) {
          return {
            level: parseFloat(match[1]),
            charging: match[2] === 'true'
          };
        }
        return { level: 100, charging: true }; // Fallback
      } catch (e) {
        console.error("Failed to parse battery data:", result, e);
        return { level: 100, charging: true }; // Fallback
      }
    } catch (error) {
      console.error("Error getting battery data:", error);
      return { level: 100, charging: true }; // Fallback
    }
  });

  // This won't work because we need to send to renderer processes
  // ipcMain.emit('refresh-data');

  if (refresh) {
    console.log("Refreshing existing instances...");
    setTimeout(refreshAllInstances, 1000); // Ensure windows exist before sending event
    return;
  }

  createWindows();

  // Set up a periodic refresh (every 1 second)
  setInterval(refreshAllInstances, 1000);

  app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindows();
  });
});

function refreshAllInstances() {
  console.log("Sending refresh-data to all windows...");
  windows.forEach((win) => {
    if (win && !win.isDestroyed()) {
      console.log("Sending refresh-data to:", win.id);
      win.webContents.send("refresh-data");
    } else {
      console.warn("Skipped destroyed window");
    }
  });
}

// Add a function to refresh data after workspace switch
function refreshAfterAction() {
  // Refresh immediately and then again after a shorter delay
  refreshAllInstances();
  setTimeout(() => refreshAllInstances(), 150);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function runAerospaceCommand() {
  return new Promise((resolve, reject) => {
    const childProcess = spawn('aerospace', ['list-workspaces', '--all', '--json'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    childProcess.stderr.on('data', (data) => { stderr += data.toString(); });
    childProcess.on('error', reject);
    childProcess.on('exit', (code) => {
      if (code === 0) {
        try { resolve(JSON.parse(stdout.trim())); }
        catch (error) { resolve(stdout.trim()); }
      } else {
        reject(new Error(`Process exited with code ${code}: ${stderr}`));
      }
    });
  });
}

function getActiveSpace() {
  return new Promise((resolve, reject) => {
    const childProcess = spawn('aerospace', ['list-workspaces', '--focused', '--json'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    childProcess.stderr.on('data', (data) => { stderr += data.toString(); });
    childProcess.on('error', reject);
    childProcess.on('exit', (code) => {
      if (code === 0) {
        try { resolve(JSON.parse(stdout.trim())); }
        catch (error) { resolve(stdout.trim()); }
      } else {
        reject(new Error(`Process exited with code ${code}: ${stderr}`));
      }
    });
  });
}

function getActiveWindow() {
  return new Promise((resolve, reject) => {
    const childProcess = spawn('aerospace', ['list-windows', '--focused', '--json'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    childProcess.stderr.on('data', (data) => { stderr += data.toString(); });
    childProcess.on('error', reject);
    childProcess.on('exit', (code) => {
      if (code === 0) {
        try { resolve(JSON.parse(stdout.trim())); }
        catch (error) { resolve(stdout.trim()); }
      } else {
        reject(new Error(`Process exited with code ${code}: ${stderr}`));
      }
    });
  });
}

function switchSpace(space: string): void {
  const childProcess = spawn('aerospace', ['workspace', space], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  childProcess.stdout.on('data', (data: any) => {
    console.log(`stdout: ${data}`);
  });

  // Refresh data after switching workspace
  refreshAfterAction();
}

function getSpotifyTrack() {
  return new Promise((resolve) => {
    try {
      // AppleScript to get Spotify track info
      const script = `
        tell application "Spotify"
          if it is running then
            set isPlaying to player state as string
            if isPlaying is "playing" then
              set currentArtist to artist of current track as string
              set currentTrack to name of current track as string
              return "{\\"artist\\":\\"" & currentArtist & "\\",\\"title\\":\\"" & currentTrack & "\\",\\"isPlaying\\":true}"
            else
              return "{\\"isPlaying\\":false}"
            end if
          else
            return "{\\"isPlaying\\":false}"
          end if
        end tell
      `;

      const result = execSync(`osascript -e '${script}'`).toString().trim();
      try {
        resolve(JSON.parse(result));
      } catch (e) {
        console.error("Failed to parse Spotify data:", result);
        resolve({ isPlaying: false });
      }
    } catch (error) {
      console.error("Error getting Spotify data:", error);
      resolve({ isPlaying: false });
    }
  });
}

