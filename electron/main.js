const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs").promises;

const ROOT = path.join(__dirname, "..");
const DATA_FILE = "deliverables.json";

function dataPath() {
  return path.join(app.getPath("userData"), DATA_FILE);
}

function seedPath() {
  return path.join(ROOT, "data", "seed.json");
}

async function readDataFile() {
  try {
    const raw = await fs.readFile(dataPath(), "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function writeDataFile(payload) {
  await fs.mkdir(path.dirname(dataPath()), { recursive: true });
  await fs.writeFile(dataPath(), JSON.stringify(payload, null, 2), "utf8");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: "Course Timeline",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: process.platform === "darwin" ? { x: 14, y: 14 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(ROOT, "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("load-data", async () => readDataFile());

ipcMain.handle("save-data", async (_event, payload) => {
  await writeDataFile(payload);
  return dataPath();
});

ipcMain.handle("load-seed", async () => {
  const raw = await fs.readFile(seedPath(), "utf8");
  return JSON.parse(raw);
});

ipcMain.handle("get-data-path", () => dataPath());

ipcMain.handle("export-json", async (_event, jsonText) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Export deliverables",
    defaultPath: "course-deliverables.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePath) return { canceled: true };
  await fs.writeFile(filePath, jsonText, "utf8");
  return { canceled: false, filePath };
});

ipcMain.handle("import-json", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Import deliverables",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (canceled || !filePaths?.length) return { canceled: true };
  const raw = await fs.readFile(filePaths[0], "utf8");
  return { canceled: false, data: JSON.parse(raw) };
});
