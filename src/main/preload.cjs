const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  request: (payload) => ipcRenderer.invoke("http:request", payload)
});
