'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('installer', {
  /**
   * Check system compatibility.
   * @returns {Promise<{isArch: boolean, hasPacman: boolean, hasYay: boolean, hasParu: boolean}>}
   */
  checkSystem: () => ipcRenderer.invoke('check-system'),

  /**
   * Run installation.
   * @param {{ installPath: string, workerUrl: string, apiKey: string }} opts
   * @returns {Promise<{success: boolean, installPath?: string, binaryPath?: string, error?: string}>}
   */
  install: (opts) => ipcRenderer.invoke('install', opts),

  /**
   * Launch ArchStore and close installer.
   * @param {string} [binaryPath]
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  launch: (binaryPath) => ipcRenderer.invoke('launch', binaryPath),

  /**
   * Close the installer application.
   */
  closeApp: () => ipcRenderer.invoke('close-app'),

  /**
   * Listen for installation progress events.
   * @param {(event: any, data: {step: number, message: string}) => void} cb
   */
  onProgress: (cb) => {
    ipcRenderer.on('install-progress', cb)
  },

  /**
   * Remove all install-progress listeners (cleanup).
   */
  removeProgressListeners: () => {
    ipcRenderer.removeAllListeners('install-progress')
  },
})
