const { app, safeStorage } = require('electron');

app.whenReady().then(() => {
  if (!safeStorage.isEncryptionAvailable()) {
    console.error('Electron safeStorage is unavailable.');
    app.exit(1);
    return;
  }
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
    console.error('Electron safeStorage selected the insecure basic_text backend.');
    app.exit(1);
    return;
  }
  const plainText = 'dual-codex-day-runtime-secret-check';
  const encrypted = safeStorage.encryptString(plainText);
  if (encrypted.includes(Buffer.from(plainText)) || safeStorage.decryptString(encrypted) !== plainText) {
    console.error('Electron safeStorage round-trip failed.');
    app.exit(1);
    return;
  }
  console.log('Electron safeStorage check passed: OS encryption is available and round-trip succeeded.');
  app.exit(0);
}).catch(error => {
  console.error(error);
  app.exit(1);
});
