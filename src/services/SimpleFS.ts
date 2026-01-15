// Simple in-memory file system for Git operations
// This is a minimal implementation for demonstration
// In production, you'd want to use LightningFS or BrowserFS

export class SimpleFS {
    private files: Map<string, string> = new Map();

    promises = {
        readFile: async (path: string, encoding?: string): Promise<string | Buffer> => {
            const content = this.files.get(path);
            if (!content) {
                throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            }
            return encoding === 'utf8' ? content : Buffer.from(content);
        },

        writeFile: async (path: string, data: string | Buffer): Promise<void> => {
            const content = typeof data === 'string' ? data : data.toString();
            this.files.set(path, content);
        },

        unlink: async (path: string): Promise<void> => {
            this.files.delete(path);
        },

        readdir: async (path: string): Promise<string[]> => {
            const prefix = path.endsWith('/') ? path : `${path}/`;
            const files = Array.from(this.files.keys())
                .filter(f => f.startsWith(prefix))
                .map(f => f.substring(prefix.length).split('/')[0])
                .filter((v, i, a) => a.indexOf(v) === i);
            return files;
        },

        mkdir: async (path: string): Promise<void> => {
            // No-op for in-memory FS
        },

        rmdir: async (path: string): Promise<void> => {
            // Remove all files in directory
            const prefix = path.endsWith('/') ? path : `${path}/`;
            const toDelete = Array.from(this.files.keys()).filter(f => f.startsWith(prefix));
            toDelete.forEach(f => this.files.delete(f));
        },

        stat: async (path: string): Promise<any> => {
            const exists = this.files.has(path);
            if (!exists) {
                // Check if it's a directory
                const prefix = path.endsWith('/') ? path : `${path}/`;
                const hasChildren = Array.from(this.files.keys()).some(f => f.startsWith(prefix));
                if (!hasChildren) {
                    throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
                }
                return { isDirectory: () => true, isFile: () => false };
            }
            return { isDirectory: () => false, isFile: () => true };
        },

        lstat: async (path: string): Promise<any> => {
            return this.promises.stat(path);
        },

        readlink: async (path: string): Promise<string> => {
            throw new Error('Symlinks not supported');
        },

        symlink: async (target: string, path: string): Promise<void> => {
            throw new Error('Symlinks not supported');
        },

        chmod: async (path: string, mode: number): Promise<void> => {
            // No-op
        },
    };

    // Synchronous methods (for compatibility)
    readFileSync(path: string, encoding?: string): string | Buffer {
        const content = this.files.get(path);
        if (!content) {
            throw new Error(`ENOENT: no such file or directory, open '${path}'`);
        }
        return encoding === 'utf8' ? content : Buffer.from(content);
    }

    writeFileSync(path: string, data: string | Buffer): void {
        const content = typeof data === 'string' ? data : data.toString();
        this.files.set(path, content);
    }

    existsSync(path: string): boolean {
        return this.files.has(path);
    }

    readdirSync(path: string): string[] {
        const prefix = path.endsWith('/') ? path : `${path}/`;
        const files = Array.from(this.files.keys())
            .filter(f => f.startsWith(prefix))
            .map(f => f.substring(prefix.length).split('/')[0])
            .filter((v, i, a) => a.indexOf(v) === i);
        return files;
    }

    statSync(path: string): any {
        const exists = this.files.has(path);
        if (!exists) {
            const prefix = path.endsWith('/') ? path : `${path}/`;
            const hasChildren = Array.from(this.files.keys()).some(f => f.startsWith(prefix));
            if (!hasChildren) {
                throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
            }
            return { isDirectory: () => true, isFile: () => false };
        }
        return { isDirectory: () => false, isFile: () => true };
    }

    lstatSync(path: string): any {
        return this.statSync(path);
    }

    mkdirSync(path: string): void {
        // No-op
    }

    rmdirSync(path: string): void {
        const prefix = path.endsWith('/') ? path : `${path}/`;
        const toDelete = Array.from(this.files.keys()).filter(f => f.startsWith(prefix));
        toDelete.forEach(f => this.files.delete(f));
    }

    unlinkSync(path: string): void {
        this.files.delete(path);
    }
}

// Singleton instance
let fsInstance: SimpleFS | null = null;

export const getSimpleFS = (): SimpleFS => {
    if (!fsInstance) {
        fsInstance = new SimpleFS();
    }
    return fsInstance;
};
