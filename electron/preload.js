const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("coursePlanner", {
  isDesktop: true,
  loadData: () => ipcRenderer.invoke("load-data"),
  saveData: (payload) => ipcRenderer.invoke("save-data", payload),
  loadSeed: () => ipcRenderer.invoke("load-seed"),
  getDataPath: () => ipcRenderer.invoke("get-data-path"),
  exportFile: (opts) => ipcRenderer.invoke("export-file", opts),
  importFile: (opts) => ipcRenderer.invoke("import-file", opts),
});
