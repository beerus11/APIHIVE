import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  request: (payload: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
  }) => ipcRenderer.invoke("http:request", payload)
});
