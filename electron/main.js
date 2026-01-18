import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import pty from 'node-pty';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let terminalProcesses = new Map(); // Store multiple terminal processes
let terminalCounter = 1;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false, // Allow loading Monaco from CDN
        },
        title: "HENU IDE",
        backgroundColor: '#000000',
        frame: false, // Frameless window for custom title bar
        show: false
    });

    // Start first terminal
    startTerminal(mainWindow, 'terminal-1');

    // In development, load from Vite dev server
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        // In production, load the built index.html
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Handle window close
    mainWindow.on('closed', () => {
        mainWindow = null;
        // Kill all terminal processes
        terminalProcesses.forEach(proc => {
            if (proc && proc.process && proc.process.kill) proc.process.kill();
        });
        terminalProcesses.clear();
    });
}

// ==================== TERMINAL FUNCTIONS ====================

function startTerminal(window, terminalId) {
    console.log(`========== STARTING TERMINAL ${terminalId} ==========`);

    try {
        let shell;
        const platform = os.platform();

        // Windows specific PowerShell setup
        if (platform === 'win32') {
            shell = 'powershell.exe';
            console.log(`Using PowerShell for ${terminalId}`);

            // Windows specific options
            const ptyProcess = pty.spawn(shell, ['-NoLogo', '-NoExit'], {
                name: 'xterm-256color',
                cols: 80,
                rows: 30,
                cwd: process.env.HOME || process.env.USERPROFILE || process.cwd(),
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    COLORTERM: 'truecolor'
                },
                // Windows important settings
                useConpty: false, // Disable ConPTY for compatibility
                handleFlowControl: false
            });

            console.log(`Terminal ${terminalId} PID:`, ptyProcess.pid);

            // Store process reference
            terminalProcesses.set(terminalId, {
                process: ptyProcess,
                id: terminalId,
                windowId: window.id
            });

            // Handle terminal output
            ptyProcess.on('data', (data) => {
                if (window && !window.isDestroyed()) {
                    window.webContents.send('terminal-data', { terminalId, data });
                }
            });

            // Handle process exit
            ptyProcess.on('exit', (code) => {
                console.log(`Terminal ${terminalId} process exited with code:`, code);

                // Remove process from map
                if (terminalProcesses.has(terminalId)) {
                    terminalProcesses.delete(terminalId);
                }

                if (window && !window.isDestroyed()) {
                    window.webContents.send('terminal-exit', { terminalId, code });
                }
            });

            // Send welcome message after delay
            setTimeout(() => {
                if (ptyProcess && !ptyProcess.killed) {
                    ptyProcess.write('cls\r');
                    ptyProcess.write('echo "========================================="\r');
                    ptyProcess.write(`echo "    HENU IDE - TERMINAL ${terminalId}"\r`);
                    ptyProcess.write('echo "========================================="\r');
                    ptyProcess.write('echo.\r');
                }
            }, 800);

        } else {
            // macOS/Linux - use bash or zsh
            shell = process.env.SHELL || '/bin/bash';
            console.log(`Using ${shell} for ${terminalId}`);

            const ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-256color',
                cols: 80,
                rows: 30,
                cwd: process.env.HOME || process.cwd(),
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    COLORTERM: 'truecolor'
                }
            });

            console.log(`Terminal ${terminalId} PID:`, ptyProcess.pid);

            // Store process reference
            terminalProcesses.set(terminalId, {
                process: ptyProcess,
                id: terminalId,
                windowId: window.id
            });

            // Handle terminal output
            ptyProcess.on('data', (data) => {
                if (window && !window.isDestroyed()) {
                    window.webContents.send('terminal-data', { terminalId, data });
                }
            });

            // Handle process exit
            ptyProcess.on('exit', (code) => {
                console.log(`Terminal ${terminalId} process exited with code:`, code);

                if (terminalProcesses.has(terminalId)) {
                    terminalProcesses.delete(terminalId);
                }

                if (window && !window.isDestroyed()) {
                    window.webContents.send('terminal-exit', { terminalId, code });
                }
            });

            // Send welcome message after delay
            setTimeout(() => {
                if (ptyProcess && !ptyProcess.killed) {
                    ptyProcess.write('clear\r');
                    ptyProcess.write('echo "========================================="\r');
                    ptyProcess.write(`echo "    HENU IDE - TERMINAL ${terminalId}"\r`);
                    ptyProcess.write('echo "========================================="\r');
                    ptyProcess.write('echo ""\r');
                }
            }, 500);
        }

    } catch (error) {
        console.error(`Failed to start terminal ${terminalId}:`, error);
    }
}

function killTerminal(terminalId) {
    const terminal = terminalProcesses.get(terminalId);
    if (terminal && terminal.process) {
        try {
            terminal.process.kill();
            setTimeout(() => {
                if (terminalProcesses.has(terminalId)) {
                    terminalProcesses.delete(terminalId);
                }
            }, 100);
            console.log(`Terminal ${terminalId} killed`);
            return true;
        } catch (error) {
            console.error(`Error killing terminal ${terminalId}:`, error);
            return false;
        }
    }
    return false;
}

// ==================== TERMINAL IPC HANDLERS ====================

ipcMain.on('terminal-write', (event, { terminalId, data }) => {
    console.log(`IPC: Writing to terminal ${terminalId}:`, data);
    const terminal = terminalProcesses.get(terminalId);
    if (terminal && terminal.process && terminal.process.write) {
        terminal.process.write(data);
    }
});

ipcMain.on('terminal-execute', (event, { terminalId, command }) => {
    console.log(`IPC: Executing command in terminal ${terminalId}:`, command);
    const terminal = terminalProcesses.get(terminalId);
    if (terminal && terminal.process && terminal.process.write) {
        terminal.process.write(command + '\r\n');
    }
});

ipcMain.on('terminal-clear', (event, terminalId) => {
    console.log(`IPC: Clearing terminal ${terminalId}`);
    const terminal = terminalProcesses.get(terminalId);
    if (terminal && terminal.process && terminal.process.write) {
        if (os.platform() === 'win32') {
            terminal.process.write('cls\r\n');
        } else {
            terminal.process.write('clear\r\n');
        }
    }
});

ipcMain.on('terminal-resize', (event, { terminalId, cols, rows }) => {
    const terminal = terminalProcesses.get(terminalId);
    if (terminal && terminal.process && terminal.process.resize) {
        terminal.process.resize(cols, rows);
    }
});

ipcMain.on('terminal-create', (event) => {
    terminalCounter++;
    const newTerminalId = `terminal-${terminalCounter}`;
    startTerminal(BrowserWindow.fromWebContents(event.sender), newTerminalId);

    // Send new terminal info to renderer
    event.sender.send('terminal-created', newTerminalId);
});

ipcMain.on('terminal-kill', (event, terminalId) => {
    const killed = killTerminal(terminalId);
    event.sender.send('terminal-killed', { terminalId, success: killed });
});

ipcMain.on('terminal-list', (event) => {
    const terminals = Array.from(terminalProcesses.keys());
    event.sender.send('terminal-list-response', terminals);
});

// ==================== WINDOW CONTROL IPC HANDLERS ====================

ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
});

// ==================== FILE SYSTEM IPC HANDLERS ====================

// Helper function to read directory recursively
const readDirectoryRecursive = (dirPath, maxDepth = 5, currentDepth = 0) => {
    if (currentDepth >= maxDepth) {
        return [];
    }

    try {
        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        // Filter out hidden files and node_modules for performance
        const filteredItems = items.filter(item =>
            !item.name.startsWith('.') &&
            item.name !== 'node_modules' &&
            item.name !== '__pycache__'
        );

        return filteredItems.map((item, index) => {
            const itemPath = path.join(dirPath, item.name);
            const isDirectory = item.isDirectory();

            const node = {
                id: `${Date.now()}-${currentDepth}-${index}-${Math.random().toString(36).substr(2, 9)}`,
                name: item.name,
                type: isDirectory ? 'directory' : 'file',
                path: itemPath,
                modified: new Date(),
            };

            if (isDirectory) {
                // Recursively read children
                node.children = readDirectoryRecursive(itemPath, maxDepth, currentDepth + 1);
            } else {
                // Read file content for small files
                try {
                    const stats = fs.statSync(itemPath);
                    if (stats.size < 50000) { // Less than 50KB
                        node.content = fs.readFileSync(itemPath, 'utf-8');
                    } else {
                        node.content = '// File too large to load in editor';
                    }
                    node.size = stats.size;
                } catch (e) {
                    node.content = '';
                }
            }

            return node;
        });
    } catch (error) {
        console.error('Error reading directory:', dirPath, error);
        return [];
    }
};

// Open folder dialog
ipcMain.handle('open-folder-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select a Folder to Open'
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const folderPath = result.filePaths[0];
    const folderName = path.basename(folderPath);

    console.log('Reading folder:', folderPath);

    // Read folder contents recursively
    try {
        const fileSystem = readDirectoryRecursive(folderPath, 4); // Max depth of 4

        console.log('Loaded', fileSystem.length, 'items from folder');

        return {
            name: folderName,
            path: folderPath,
            fileSystem: fileSystem
        };
    } catch (error) {
        console.error('Error reading folder:', error);
        return {
            name: folderName,
            path: folderPath,
            fileSystem: []
        };
    }
});

// Open file dialog
ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        title: 'Select a File to Open',
        filters: [
            { name: 'All Files', extensions: ['*'] },
            { name: 'JavaScript', extensions: ['js', 'jsx', 'ts', 'tsx'] },
            { name: 'HTML', extensions: ['html', 'htm'] },
            { name: 'CSS', extensions: ['css', 'scss', 'sass'] },
            { name: 'JSON', extensions: ['json'] },
            { name: 'Markdown', extensions: ['md', 'markdown'] }
        ]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);

    try {
        const stats = fs.statSync(filePath);
        let content = '';

        if (stats.size < 100000) {
            content = fs.readFileSync(filePath, 'utf-8');
        } else {
            content = '// File too large to load';
        }

        return {
            success: true,
            name: fileName,
            path: filePath,
            content: content,
            size: stats.size
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Read file content
ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Read directory contents recursively
ipcMain.handle('read-directory', async (event, dirPath) => {
    try {
        const readDirRecursive = (dir) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            return items.map((item, index) => {
                const itemPath = path.join(dir, item.name);
                const node = {
                    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: item.name,
                    type: item.isDirectory() ? 'directory' : 'file',
                    path: itemPath,
                    modified: new Date()
                };

                if (item.isDirectory()) {
                    // For directories, read children (but limit depth)
                    try {
                        node.children = readDirRecursive(itemPath);
                    } catch {
                        node.children = [];
                    }
                } else {
                    // For files, read content if small enough
                    try {
                        const stats = fs.statSync(itemPath);
                        if (stats.size < 100000) { // Less than 100KB
                            node.content = fs.readFileSync(itemPath, 'utf-8');
                        }
                    } catch {
                        node.content = '';
                    }
                }

                return node;
            });
        };

        const fileSystem = readDirRecursive(dirPath);
        return { success: true, fileSystem };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create new project
ipcMain.handle('create-project', async (event, projectName) => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory', 'createDirectory'],
            title: 'Select Location for New Project'
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, canceled: true };
        }

        const parentPath = result.filePaths[0];
        const projectPath = path.join(parentPath, projectName);

        if (fs.existsSync(projectPath)) {
            return { success: false, error: 'A folder with this name already exists' };
        }

        fs.mkdirSync(projectPath, { recursive: true });

        const defaultFiles = {
            'README.md': `# ${projectName}\n\nWelcome to your new project!\n`,
            'index.html': `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <title>${projectName}</title>\n    <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n    <h1>Hello, ${projectName}!</h1>\n    <script src="script.js"></script>\n</body>\n</html>\n`,
            'styles.css': `/* Styles for ${projectName} */\nbody { font-family: sans-serif; background: #1a1a2e; color: #fff; }\n`,
            'script.js': `// JavaScript for ${projectName}\nconsole.log('Hello from ${projectName}!');\n`
        };

        for (const [filename, content] of Object.entries(defaultFiles)) {
            fs.writeFileSync(path.join(projectPath, filename), content, 'utf-8');
        }

        fs.mkdirSync(path.join(projectPath, 'src'), { recursive: true });
        fs.writeFileSync(path.join(projectPath, 'src', 'main.js'), `// Main entry point\n`, 'utf-8');

        const fileSystem = readDirectoryRecursive(projectPath, 4);
        return { success: true, name: projectName, path: projectPath, fileSystem };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Save file to disk
ipcMain.handle('save-file', async (event, filePath, content) => {
    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create new file on disk
ipcMain.handle('create-file-on-disk', async (event, parentPath, fileName, content = '') => {
    try {
        const filePath = path.join(parentPath, fileName);
        if (fs.existsSync(filePath)) return { success: false, error: 'File already exists' };
        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create new folder on disk
ipcMain.handle('create-folder-on-disk', async (event, parentPath, folderName) => {
    try {
        const folderPath = path.join(parentPath, folderName);
        if (fs.existsSync(folderPath)) return { success: false, error: 'Folder already exists' };
        fs.mkdirSync(folderPath, { recursive: true });
        return { success: true, path: folderPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Delete file or folder from disk
ipcMain.handle('delete-from-disk', async (event, itemPath) => {
    try {
        const stats = fs.statSync(itemPath);
        if (stats.isDirectory()) {
            fs.rmSync(itemPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(itemPath);
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Save As dialog
ipcMain.handle('save-file-dialog', async (event, defaultName, content) => {
    try {
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: defaultName,
            title: 'Save File As',
            filters: [
                { name: 'All Files', extensions: ['*'] },
                { name: 'JavaScript', extensions: ['js', 'jsx', 'ts', 'tsx'] },
                { name: 'HTML', extensions: ['html', 'htm'] },
                { name: 'CSS', extensions: ['css', 'scss', 'sass'] }
            ]
        });
        if (result.canceled || !result.filePath) return { success: false, canceled: true };
        fs.writeFileSync(result.filePath, content, 'utf-8');
        return { success: true, path: result.filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ==================== APP LIFECYCLE ====================

app.whenReady().then(() => {
    console.log('Electron app ready...');
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // Kill all terminal processes
        terminalProcesses.forEach(proc => {
            if (proc.process && proc.process.kill) {
                proc.process.kill();
            }
        });
        terminalProcesses.clear();
        app.quit();
    }
});

app.on('before-quit', () => {
    terminalProcesses.forEach(proc => {
        if (proc.process && proc.process.kill) {
            proc.process.kill();
        }
    });
    terminalProcesses.clear();
});
