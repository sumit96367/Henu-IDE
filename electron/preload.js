const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loading...');

contextBridge.exposeInMainWorld('electronAPI', {
    // Terminal operations
    writeToTerminal: (terminalId, data) => ipcRenderer.send('terminal-write', { terminalId, data }),
    executeCommand: (terminalId, command) => ipcRenderer.send('terminal-execute', { terminalId, command }),
    clearTerminal: (terminalId) => ipcRenderer.send('terminal-clear', terminalId),
    resizeTerminal: (terminalId, cols, rows) => ipcRenderer.send('terminal-resize', { terminalId, cols, rows }),

    // Multi-terminal management
    createTerminal: () => ipcRenderer.send('terminal-create'),
    killTerminal: (terminalId) => {
        try {
            return ipcRenderer.send('terminal-kill', terminalId);
        } catch (error) {
            console.error('Failed to kill terminal:', error);
            return false;
        }
    },
    listTerminals: () => ipcRenderer.send('terminal-list'),

    // Terminal events
    onTerminalData: (callback) => {
        ipcRenderer.on('terminal-data', (event, { terminalId, data }) => callback(terminalId, data));
    },

    onTerminalExit: (callback) => {
        ipcRenderer.on('terminal-exit', (event, { terminalId, code }) => callback(terminalId, code));
    },

    onTerminalCreated: (callback) => {
        ipcRenderer.on('terminal-created', (event, terminalId) => callback(terminalId));
    },

    onTerminalKilled: (callback) => {
        ipcRenderer.on('terminal-killed', (event, { terminalId, success }) => callback(terminalId, success));
    },

    onTerminalListResponse: (callback) => {
        ipcRenderer.on('terminal-list-response', (event, terminals) => callback(terminals));
    },

    // Remove listeners
    removeTerminalListeners: () => {
        ipcRenderer.removeAllListeners('terminal-data');
        ipcRenderer.removeAllListeners('terminal-exit');
        ipcRenderer.removeAllListeners('terminal-created');
        ipcRenderer.removeAllListeners('terminal-killed');
        ipcRenderer.removeAllListeners('terminal-list-response');
    },

    // Window controls
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),

    // File system operations
    openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
    createProject: (projectName) => ipcRenderer.invoke('create-project', projectName),
    saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
    createFileOnDisk: (parentPath, fileName, content) => ipcRenderer.invoke('create-file-on-disk', parentPath, fileName, content),
    createFolderOnDisk: (parentPath, folderName) => ipcRenderer.invoke('create-folder-on-disk', parentPath, folderName),
    deleteFromDisk: (itemPath) => ipcRenderer.invoke('delete-from-disk', itemPath),
    saveFileDialog: (defaultName, content) => ipcRenderer.invoke('save-file-dialog', defaultName, content)
});

console.log('Preload script loaded');
