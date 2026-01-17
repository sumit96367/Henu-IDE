import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false, // Allow loading Monaco from CDN
        },
        title: "HENU OS",
        backgroundColor: '#000000',
        frame: false, // Frameless window for custom title bar
        show: false
    });

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
}

// IPC handlers for window controls
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

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
