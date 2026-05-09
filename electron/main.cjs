const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const net = require("net");
const path = require("path");

const devUrl = "http://127.0.0.1:3000";
let mainWindow = null;
let serverProcess = null;

function waitForUrl(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tryRequest = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`服务启动超时：${url}`));
          return;
        }

        setTimeout(tryRequest, 500);
      });
    };

    tryRequest();
  });
}

function getFreePort(startPort = 3232) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();

    server.on("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        resolve(getFreePort(startPort + 1));
        return;
      }

      reject(error);
    });

    server.listen(startPort, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        resolve(typeof address === "object" && address ? address.port : startPort);
      });
    });
  });
}

async function ensureServerUrl() {
  if (!app.isPackaged) {
    return devUrl;
  }

  const port = await getFreePort();
  const appPath = app.getAppPath();
  const nextCli = path.join(appPath, "node_modules", "next", "dist", "bin", "next");

  serverProcess = spawn(process.execPath, [nextCli, "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd: appPath,
    env: {
      ...process.env,
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "ignore",
    windowsHide: true,
  });

  const appUrl = `http://127.0.0.1:${port}`;
  await waitForUrl(appUrl);
  return appUrl;
}

async function createMainWindow() {
  const appUrl = await ensureServerUrl();

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 920,
    minWidth: 980,
    minHeight: 720,
    autoHideMenuBar: true,
    backgroundColor: "#07131f",
    title: "江湖夜雨十年灯",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(appUrl);
}

function stopServer() {
  if (!serverProcess) {
    return;
  }

  serverProcess.kill();
  serverProcess = null;
}

app.whenReady().then(async () => {
  try {
    await createMainWindow();
  } catch (error) {
    dialog.showErrorBox(
      "启动失败",
      error instanceof Error ? error.message : "桌面应用启动失败。",
    );
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow();
  }
});

app.on("window-all-closed", () => {
  stopServer();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopServer();
});
