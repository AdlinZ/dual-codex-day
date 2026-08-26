const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dualCodexDay', Object.freeze({
  getSnapshot: profileId => ipcRenderer.invoke('app:get-snapshot', profileId),
  createProfile: name => ipcRenderer.invoke('profiles:create', name),
  renameProfile: (profileId, name) => ipcRenderer.invoke('profiles:rename', { profileId, name }),
  deleteProfile: profileId => ipcRenderer.invoke('profiles:delete', profileId),
  previewProvider: (profileId, provider) => ipcRenderer.invoke('profiles:provider-preview', { profileId, provider }),
  saveProvider: (profileId, provider, apiKey) => ipcRenderer.invoke('profiles:save-provider', { profileId, provider, apiKey }),
  setProfileUsageSource: (profileId, source) => ipcRenderer.invoke('profiles:set-usage-source', { profileId, source }),
  setProfileRuntimeSource: (profileId, source) => ipcRenderer.invoke('profiles:set-runtime-source', { profileId, source }),
  importProfileConfig: profileId => ipcRenderer.invoke('profiles:import-config', profileId),
  launchProfile: (profileId, target) => ipcRenderer.invoke('profiles:launch', { profileId, target }),
  stopProfileLaunch: launchId => ipcRenderer.invoke('profiles:stop', launchId),
  openProfileFolder: profileId => ipcRenderer.invoke('profiles:open-folder', profileId),
  chooseWorkspace: () => ipcRenderer.invoke('workspace:choose'),
  getUsageData: sourceId => ipcRenderer.invoke('usage:get-data', sourceId)
}));
