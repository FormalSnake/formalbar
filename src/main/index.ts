import { app, shell, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn } from 'child_process'
import { execSync } from 'child_process'
import { existsSync } from 'fs'

let windows: BrowserWindow[] = [];

// Find the full path to the aerospace binary
let aerospacePath: string | null = null;

function findAerospaceBinary(): string | null {
  try {
    // Try to find aerospace in common locations
    const possiblePaths = [
      '/usr/local/bin/aerospace',
      '/opt/homebrew/bin/aerospace',
      '/usr/bin/aerospace',
      '/bin/aerospace',
      // Add the path from $PATH
      ...process.env.PATH?.split(':').map(p => join(p, 'aerospace')) || []
    ];
    
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        console.log(`Found aerospace binary at: ${path}`);
        return path;
      }
    }
    
    // Try to find it using which command
    try {
      const whichResult = execSync('which aerospace').toString().trim();
      if (whichResult && existsSync(whichResult)) {
        console.log(`Found aerospace binary using which: ${whichResult}`);
        return whichResult;
      }
    } catch (error) {
      console.error("Error finding aerospace with which:", error);
    }
    
    console.error("Could not find aerospace binary");
    return null;
  } catch (error) {
    console.error("Error finding aerospace binary:", error);
    return null;
  }
}

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
  
  // Find the aerospace binary path
  aerospacePath = findAerospaceBinary();
  if (!aerospacePath) {
    console.error("WARNING: Could not find aerospace binary. Workspace functionality will not work.");
  } else {
    console.log(`Using aerospace binary at: ${aerospacePath}`);
  }

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
      // Simple command to get battery percentage
      const result = execSync(`pmset -g batt | grep -Eo "\\d+%" | cut -d% -f1`).toString().trim();
      const level = parseInt(result, 10);
      
      if (!isNaN(level)) {
        return { level };
      }
      return { level: 100 }; // Fallback
    } catch (error) {
      console.error("Error getting battery data:", error);
      return { level: 100 }; // Fallback
    }
  });

  ipcMain.handle('get-wifi-status', async () => {
    try {
      // Check if network interfaces are up and have an IP
      const networkSetup = execSync('networksetup -listallhardwareports').toString();
      const ifconfigOutput = execSync('ifconfig en0').toString();
      
      console.log("Network interfaces:", networkSetup);
      
      // Check if WiFi is enabled and connected
      if (!ifconfigOutput.includes('status: active')) {
        console.log("WiFi is disconnected");
        return { status: 'disconnected' };
      }
      
      // Check internet connectivity
      try {
        execSync('ping -c 1 -W 1 8.8.8.8');
        console.log("Internet connection is available");
      } catch (e) {
        console.log("No internet connection");
        return { status: 'no-internet' };
      }
      
      // Use networksetup to get WiFi info
      try {
        // Get current WiFi network
        const currentNetwork = execSync('networksetup -getairportnetwork en0').toString();
        console.log("Current network:", currentNetwork);
        
        // Get signal strength using a more reliable method
        // We'll use ping response time as a proxy for signal quality
        const pingResult = execSync('ping -c 3 -q 8.8.8.8').toString();
        const avgTimeMatch = pingResult.match(/min\/avg\/max\/stddev = [\d.]+\/([\d.]+)/);
        
        if (avgTimeMatch && avgTimeMatch[1]) {
          const avgTime = parseFloat(avgTimeMatch[1]);
          console.log("Ping average time:", avgTime);
          
          // Use ping time as a proxy for signal strength
          if (avgTime < 20) {
            return { status: 'high' };
          } else if (avgTime < 100) {
            return { status: 'medium' };
          } else {
            return { status: 'low' };
          }
        }
      } catch (e) {
        console.log("Error getting detailed WiFi info:", e);
      }
      
      // Default to medium if we can't determine strength
      return { status: 'medium' };
    } catch (error) {
      console.error("Error getting WiFi data:", error);
      return { status: 'disconnected' }; // Fallback
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
    if (!aerospacePath) {
      return reject(new Error("Aerospace binary not found"));
    }
    
    const childProcess = spawn(aerospacePath, ['list-workspaces', '--all', '--json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
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
    if (!aerospacePath) {
      return reject(new Error("Aerospace binary not found"));
    }
    
    const childProcess = spawn(aerospacePath, ['list-workspaces', '--focused', '--json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
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
    if (!aerospacePath) {
      return reject(new Error("Aerospace binary not found"));
    }
    
    const childProcess = spawn(aerospacePath, ['list-windows', '--focused', '--json'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
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
  if (!aerospacePath) {
    console.error("Cannot switch space: Aerospace binary not found");
    return;
  }
  
  const childProcess = spawn(aerospacePath, ['workspace', space], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
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

