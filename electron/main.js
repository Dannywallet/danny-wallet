// Electron main process — Danny Wallet desktop
// dev: โหลด http://localhost:3000 (next dev รันแยก)
// prod (แพ็กแล้ว): สปอว์นเซิร์ฟเวอร์ Next standalone ในตัว แล้วโหลด http://localhost:<PORT>
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const http = require("http");

const ICON = path.join(__dirname, "..", "build", "icon.png");

const isDev = !app.isPackaged;
const PORT = process.env.DW_PORT || "34117";
const BASE = isDev ? "http://localhost:3000" : `http://127.0.0.1:${PORT}`;

let serverProc = null;
let win = null;

function waitForServer(url, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const ping = () => {
      const req = http.get(url, (res) => {
        res.destroy();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeout) reject(new Error("Next server timeout"));
        else setTimeout(ping, 500);
      });
    };
    ping();
  });
}

function startServer() {
  if (isDev) return; // dev ใช้ next dev ที่รันแยก
  const dir = path.join(process.resourcesPath, "standalone");
  serverProc = spawn(process.execPath, [path.join(dir, "server.js")], {
    cwd: dir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT,
      HOSTNAME: "127.0.0.1",
      ELECTRON_RUN_AS_NODE: "1", // ให้ binary ของ Electron รันเป็น Node ล้วน
    },
    stdio: "inherit",
  });
  serverProc.on("error", (e) => console.error("server spawn error:", e));
}

async function createWindow() {
  win = new BrowserWindow({
    width: 440,
    height: 900,
    minWidth: 360,
    minHeight: 640,
    title: "Danny Wallet",
    backgroundColor: "#05060c",
    autoHideMenuBar: true,
    icon: fs.existsSync(ICON) ? ICON : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // เปิดลิงก์ภายนอก (target=_blank) ในเบราว์เซอร์จริง ไม่ใช่ในหน้าต่างแอป
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  try {
    await waitForServer(BASE);
  } catch {
    /* โหลดต่อแม้ ping ไม่ผ่าน */
  }
  win.loadURL(`${BASE}/wallet`);
}

app.whenReady().then(async () => {
  startServer();
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => {
  if (serverProc) {
    try {
      serverProc.kill();
    } catch {
      /* noop */
    }
  }
});
