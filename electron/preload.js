const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("coursePlanner", {
  isDesktop: true,
  loadData: () => ipcRenderer.invoke("load-data"),
  saveData: (payload) => ipcRenderer.invoke("save-data", payload),
  loadSeed: () => ipcRenderer.invoke("load-seed"),
  getDataPath: () => ipcRenderer.invoke("get-data-path"),
  exportJson: (jsonText) => ipcRenderer.invoke("export-json", jsonText),
  importJson: () => ipcRenderer.invoke("import-json"),
});
