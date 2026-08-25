const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow, nativeImage } = require('electron');

const root = path.resolve('.');
const markPath = path.join(root, 'assets', 'codex-day-mark.svg');
const iconPath = path.join(root, 'assets', 'codex-day.ico');
const sizes = [16, 24, 32, 48, 64, 128, 256];

function buildIco(images) {
  const headerSize = 6;
  const entrySize = 16;
  let imageOffset = headerSize + entrySize * images.length;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(imageOffset, 12);
    imageOffset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  let exitCode = 0;
  const window = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  try {
    const markUrl = `data:image/svg+xml;base64,${readFileSync(markPath).toString('base64')}`;
    await window.loadURL('about:blank');
    const pngUrl = await window.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 512;
          const context = canvas.getContext('2d');
          context.clearRect(0, 0, 512, 512);
          context.drawImage(image, 0, 0, 512, 512);
          resolve(canvas.toDataURL('image/png'));
        };
        image.onerror = () => reject(new Error('Could not load the SVG brand mark.'));
        image.src = ${JSON.stringify(markUrl)};
      })
    `);
    const source = nativeImage.createFromDataURL(pngUrl);
    if (source.isEmpty()) throw new Error('Electron could not rasterize the SVG brand mark.');
    const images = sizes.map(size => ({
      size,
      png: source.resize({ width: size, height: size, quality: 'best' }).toPNG()
    }));
    writeFileSync(iconPath, buildIco(images));
    console.log(iconPath);
  } catch (error) {
    console.error(error?.stack || error);
    exitCode = 1;
  } finally {
    window.destroy();
    app.exit(exitCode);
  }
});
