const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dualCodexDay', Object.freeze({
  getSnapshot: () => ipcRenderer.invoke('app:get-snapshot'),
  createProfile: name => ipcRenderer.invoke('profiles:create', name),
  previewProvider: (profileId, provider) => ipcRenderer.invoke('profiles:provider-preview', { profileId, provider }),
  saveProvider: (profileId, provider, apiKey) => ipcRenderer.invoke('profiles:save-provider', { profileId, provider, apiKey }),
  importProfileConfig: profileId => ipcRenderer.invoke('profiles:import-config', profileId),
  launchProfile: (profileId, target) => ipcRenderer.invoke('profiles:launch', { profileId, target }),
  openProfileFolder: profileId => ipcRenderer.invoke('profiles:open-folder', profileId),
  chooseWorkspace: () => ipcRenderer.invoke('workspace:choose'),
  openDashboard: () => ipcRenderer.invoke('dashboard:open')
}));
