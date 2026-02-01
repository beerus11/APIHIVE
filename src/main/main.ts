import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

const createWindow = () => {
  const preloadPath = isDev
    ? path.join(app.getAppPath(), "src", "main", "preload.cjs")
    : path.join(__dirname, "preload.cjs");

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#303030",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.webContents.on("did-fail-load", (_event, code, desc, url) => {
    if (code !== -3) {
      console.error("Load failed:", code, desc, url);
    }
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }
};

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

const ALLOWED_METHODS = new Set([
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"
]);
const ALLOWED_PROTOCOLS = ["http:", "https:"];

ipcMain.handle("http:request", async (_event, payload) => {
  const startedAt = Date.now();

  if (!payload || typeof payload !== "object") {
    return {
      status: 0,
      statusText: "Invalid request",
      headers: {},
      body: "Missing or invalid payload.",
      duration: Date.now() - startedAt,
      size: 0
    };
  }

  const { url, method, headers, body } = payload as {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };

  if (!url || typeof url !== "string" || url.trim() === "") {
    return {
      status: 0,
      statusText: "Invalid request",
      headers: {},
      body: "URL is required.",
      duration: Date.now() - startedAt,
      size: 0
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
  } catch {
    return {
      status: 0,
      statusText: "Invalid request",
      headers: {},
      body: "Invalid URL format.",
      duration: Date.now() - startedAt,
      size: 0
    };
  }

  if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
    return {
      status: 0,
      statusText: "Invalid request",
      headers: {},
      body: "Only http and https URLs are allowed.",
      duration: Date.now() - startedAt,
      size: 0
    };
  }

  const normalizedMethod = typeof method === "string" ? method.toUpperCase() : "GET";
  if (!ALLOWED_METHODS.has(normalizedMethod)) {
    return {
      status: 0,
      statusText: "Invalid request",
      headers: {},
      body: `Unsupported method: ${method}`,
      duration: Date.now() - startedAt,
      size: 0
    };
  }

  const normalizedHeaders =
    headers && typeof headers === "object" && !Array.isArray(headers)
      ? (headers as Record<string, string>)
      : {};

  try {
    const response = await fetch(url.trim(), {
      method: normalizedMethod,
      headers: normalizedHeaders,
      body:
        body != null && typeof body === "string" && body.length > 0
          ? body
          : undefined
    });

    const text = await response.text();
    const size = new TextEncoder().encode(text).byteLength;
    const duration = Date.now() - startedAt;

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: text,
      duration,
      size
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return {
      status: 0,
      statusText: "Request failed",
      headers: {},
      body: message,
      duration: Date.now() - startedAt,
      size: 0
    };
  }
});
