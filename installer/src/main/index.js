'use strict'

const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { execSync, spawn } = require('child_process')
const os = require('os')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 520,
    resizable: false,
    frame: false,
    center: true,
    show: false,
    backgroundColor: '#0a0a14',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})

// ─── IPC: check-system ───────────────────────────────────────────────────────

ipcMain.handle('check-system', async () => {
  try {
    let isArch = false
    let hasPacman = false
    let hasYay = false
    let hasParu = false

    // Check Arch Linux
    try {
      fs.accessSync('/etc/arch-release', fs.constants.F_OK)
      isArch = true
    } catch {
      try {
        const uname = execSync('uname -o', { encoding: 'utf8', timeout: 5000 }).trim()
        isArch = uname.toLowerCase().includes('arch')
      } catch {
        isArch = false
      }
    }

    // Check pacman
    try {
      execSync('which pacman', { encoding: 'utf8', timeout: 5000 })
      hasPacman = true
    } catch {
      hasPacman = false
    }

    // Check yay
    try {
      execSync('which yay', { encoding: 'utf8', timeout: 5000 })
      hasYay = true
    } catch {
      hasYay = false
    }

    // Check paru
    try {
      execSync('which paru', { encoding: 'utf8', timeout: 5000 })
      hasParu = true
    } catch {
      hasParu = false
    }

    return { isArch, hasPacman, hasYay, hasParu }
  } catch (err) {
    return { isArch: false, hasPacman: false, hasYay: false, hasParu: false, error: err.message }
  }
})

// ─── IPC: install ────────────────────────────────────────────────────────────

ipcMain.handle('install', async (event, { installPath, workerUrl, apiKey }) => {
  const sendProgress = (step, message) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('install-progress', { step, message })
    }
  }

  try {
    // Resolve home dir in install path
    const resolvedInstallPath = installPath.replace(/^~/, os.homedir())

    // Step 1: Create install directory
    sendProgress(1, `Đang tạo thư mục ${resolvedInstallPath}...`)
    fs.mkdirSync(resolvedInstallPath, { recursive: true })
    sendProgress(1, `Đã tạo thư mục ${resolvedInstallPath} ✓`)

    // Step 2: Copy binary
    sendProgress(2, 'Đang sao chép binary ArchStore...')
    let srcBinary
    if (app.isPackaged) {
      srcBinary = path.join(process.resourcesPath, 'archstore-bin')
    } else {
      srcBinary = path.join(__dirname, '../../..', '../../build/bin/archstore')
    }

    const destBinary = path.join(resolvedInstallPath, 'archstore')

    if (!fs.existsSync(srcBinary)) {
      // Fallback: try relative from __dirname
      const fallback = path.join(__dirname, '../../../..', 'build/bin/archstore')
      if (fs.existsSync(fallback)) {
        srcBinary = fallback
      } else {
        throw new Error(`Binary không tìm thấy tại: ${srcBinary}`)
      }
    }

    fs.copyFileSync(srcBinary, destBinary)
    fs.chmodSync(destBinary, '755')
    sendProgress(2, 'Đã sao chép binary ✓')

    // Step 3: Create .desktop file
    sendProgress(3, 'Đang tạo shortcut ứng dụng...')
    const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=ArchStore
Comment=Arch Linux App Store
Exec=${destBinary}
Icon=archstore
Categories=System;PackageManager;
Terminal=false
StartupNotify=true
`

    // Write to user's local applications directory (no root needed)
    const localAppsDir = path.join(os.homedir(), '.local/share/applications')
    fs.mkdirSync(localAppsDir, { recursive: true })
    const localDesktopPath = path.join(localAppsDir, 'archstore.desktop')
    fs.writeFileSync(localDesktopPath, desktopContent, { encoding: 'utf8' })
    fs.chmodSync(localDesktopPath, '644')

    // Also try system-wide with pkexec (best effort)
    try {
      const tmpDesktop = path.join(os.tmpdir(), 'archstore.desktop')
      fs.writeFileSync(tmpDesktop, desktopContent, { encoding: 'utf8' })
      execSync(`pkexec cp "${tmpDesktop}" /usr/share/applications/archstore.desktop && pkexec chmod 644 /usr/share/applications/archstore.desktop`, {
        timeout: 30000,
      })
      fs.unlinkSync(tmpDesktop)
    } catch {
      // Silently ignore — user shortcut is already created
    }

    sendProgress(3, 'Đã tạo shortcut ứng dụng ✓')

    // Step 4: Configure environment variables
    sendProgress(4, 'Đang cấu hình biến môi trường...')

    const envLines = []
    if (workerUrl && workerUrl.trim()) {
      envLines.push({ key: 'ARCHSTORE_CF_WORKER_URL', value: workerUrl.trim() })
    }
    if (apiKey && apiKey.trim()) {
      envLines.push({ key: 'ARCHSTORE_API_KEY', value: apiKey.trim() })
    }

    if (envLines.length > 0) {
      // ~/.bashrc
      appendEnvToBash(path.join(os.homedir(), '.bashrc'), envLines)
      // ~/.zshrc
      appendEnvToBash(path.join(os.homedir(), '.zshrc'), envLines)
      // fish config
      appendEnvToFish(path.join(os.homedir(), '.config/fish/config.fish'), envLines)
    }

    sendProgress(4, 'Đã cấu hình biến môi trường ✓')

    // Store install path for launch
    app._archstoreInstallPath = destBinary

    return { success: true, installPath: resolvedInstallPath, binaryPath: destBinary }
  } catch (err) {
    sendProgress(-1, `Lỗi: ${err.message}`)
    return { success: false, error: err.message }
  }
})

function appendEnvToBash(filePath, envLines) {
  let existing = ''
  try {
    existing = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    existing = ''
  }

  let additions = ''
  for (const { key, value } of envLines) {
    if (!existing.includes(`export ${key}=`) && !existing.includes(`export ${key} =`)) {
      additions += `export ${key}="${value}"\n`
    }
  }

  if (additions) {
    const header = '\n# ArchStore environment variables\n'
    const block = header + additions
    fs.appendFileSync(filePath, block, { encoding: 'utf8' })
  }
}

function appendEnvToFish(filePath, envLines) {
  let existing = ''
  try {
    existing = fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    existing = ''
  }

  // Ensure fish config dir exists
  fs.mkdirSync(path.dirname(filePath), { recursive: true })

  let additions = ''
  for (const { key, value } of envLines) {
    if (!existing.includes(`set -Ux ${key}`) && !existing.includes(`set -x ${key}`)) {
      additions += `set -Ux ${key} "${value}"\n`
    }
  }

  if (additions) {
    const header = '\n# ArchStore environment variables\n'
    const block = header + additions
    fs.appendFileSync(filePath, block, { encoding: 'utf8' })
  }
}

// ─── IPC: launch ─────────────────────────────────────────────────────────────

ipcMain.handle('launch', async (event, binaryPath) => {
  try {
    const bin = binaryPath || app._archstoreInstallPath || '/opt/archstore/archstore'
    const child = spawn(bin, [], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    app.quit()
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─── IPC: close-app ──────────────────────────────────────────────────────────

ipcMain.handle('close-app', async () => {
  app.quit()
})
