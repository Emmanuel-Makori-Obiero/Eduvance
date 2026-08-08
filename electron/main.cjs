const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

// ---------- CONFIG ----------
const BACKEND_PORT = 8000;
const OLLAMA_PORT = 11434;
const IS_DEV = !app.isPackaged;

let backendProcess = null;
let ollamaProcess = null;
let mainWindow = null;

// ---------- HELPERS ----------

// Checks whether something is already listening on a given port.
function isPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port, timeout: 1000 }, () => {
      resolve(true);
      req.destroy();
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      resolve(false);
      req.destroy();
    });
  });
}

// Polls a port until it responds or we give up - used to wait for the
// FastAPI backend to finish starting up before loading the window.
function waitForPort(port, { timeoutMs = 20000, intervalMs = 300 } = {}) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      if (await isPortOpen(port)) return resolve();
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timed out waiting for port ${port}`));
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

// Starts the FastAPI backend. In dev, runs the Python file directly.
// In a packaged app, runs the bundled standalone executable produced by
// PyInstaller (see backend packaging step) so end users don't need Python
// installed at all.
function startBackend() {
  if (IS_DEV) {
    backendProcess = spawn("python", ["-m", "uvicorn", "main:app", "--port", String(BACKEND_PORT)], {
      cwd: path.join(__dirname, ".."), // project root, where main.py lives
      shell: true,
    });
  } else {
    const exeName = process.platform === "win32" ? "eduvance-backend.exe" : "eduvance-backend";
    const backendPath = path.join(process.resourcesPath, "backend", exeName);
    backendProcess = spawn(backendPath, [], { cwd: path.dirname(backendPath) });
  }

  backendProcess.stdout?.on("data", (data) => console.log(`[backend] ${data}`));
  backendProcess.stderr?.on("data", (data) => console.error(`[backend] ${data}`));
  backendProcess.on("error", (err) => console.error("[backend] failed to start:", err));
}

// Tries to start Ollama in the background if it isn't already running.
// Requires Ollama to already be installed on the machine - this does not
// install Ollama itself, only launches it if it's present.
async function ensureOllamaRunning() {
  const alreadyRunning = await isPortOpen(OLLAMA_PORT);
  if (alreadyRunning) {
    console.log("[ollama] already running");
    return;
  }

  console.log("[ollama] not detected, attempting to start it");
  try {
    ollamaProcess = spawn("ollama", ["serve"], { shell: true });
    ollamaProcess.stdout?.on("data", (data) => console.log(`[ollama] ${data}`));
    ollamaProcess.stderr?.on("data", (data) => console.error(`[ollama] ${data}`));
    ollamaProcess.on("error", (err) => {
      console.error("[ollama] could not be started automatically:", err.message);
    });
  } catch (err) {
    console.error("[ollama] failed to spawn:", err.message);
  }

  // Give it a few seconds to come up; if it doesn't, the app still opens -
  // the chat/lesson/coder screens will just show their existing "could not
  // reach the offline tutor" error state until Ollama is available.
  try {
    await waitForPort(OLLAMA_PORT, { timeoutMs: 8000 });
    console.log("[ollama] now running");
  } catch {
    console.warn("[ollama] still not reachable after waiting - is it installed?");
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 700,
    minHeight: 500,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (IS_DEV) {
    // Vite dev server
    mainWindow.loadURL("http://localhost:5173");
  } else {
    // Built React app, bundled into the app resources
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ---------- APP LIFECYCLE ----------

app.whenReady().then(async () => {
  await ensureOllamaRunning();
  startBackend();

  try {
    await waitForPort(BACKEND_PORT);
  } catch (err) {
    console.error("[backend] never became reachable:", err.message);
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (backendProcess) backendProcess.kill();
  if (ollamaProcess) ollamaProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (backendProcess) backendProcess.kill();
  if (ollamaProcess) ollamaProcess.kill();
});
