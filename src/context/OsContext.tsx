import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';

// Updated Types
export interface FileSystemNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  size?: number;
  modified: Date;
  parentId?: string;
  children?: FileSystemNode[];
  icon?: React.ReactNode;
  path?: string;
  tags?: string[];
  favorite?: boolean;
  pinned?: boolean;
  locked?: boolean;
  description?: string;
}

interface TerminalHistoryItem {
  command: string;
  output: string;
  timestamp: Date;
  isError?: boolean;
}

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface OSState {
  activeFile: FileSystemNode | null;
  terminalHistory: TerminalHistoryItem[];
  aiMessages: AIMessage[];
  fileSystem: FileSystemNode[];
  currentPath: string;
  openTabs: FileSystemNode[];
  outputMessages: { message: string; type: 'info' | 'success' | 'error' | 'warning'; timestamp: Date }[];
}

type OSAction =
  | { type: 'SET_ACTIVE_FILE'; payload: FileSystemNode | null }
  | { type: 'ADD_TERMINAL_COMMAND'; payload: { command: string; output: string; isError?: boolean } }
  | { type: 'CLEAR_TERMINAL' }
  | { type: 'ADD_AI_MESSAGE'; payload: { role: 'user' | 'assistant'; content: string } }
  | { type: 'CLEAR_AI_MESSAGES' }
  | { type: 'UPDATE_FILE_SYSTEM'; payload: FileSystemNode[] }
  | { type: 'SET_CURRENT_PATH'; payload: string }
  | { type: 'CREATE_FILE'; payload: { name: string; content?: string; parentId?: string } }
  | { type: 'CREATE_DIRECTORY'; payload: { name: string; parentId?: string } }
  | { type: 'DELETE_NODE'; payload: string }
  | { type: 'UPDATE_FILE_CONTENT'; payload: { id: string; content: string } }
  | { type: 'UPDATE_NODE'; payload: { id: string; updates: Partial<FileSystemNode> } }
  | { type: 'MOVE_NODE'; payload: { nodeId: string; targetParentId: string } }
  | { type: 'OPEN_TAB'; payload: FileSystemNode }
  | { type: 'CLOSE_TAB'; payload: string }
  | { type: 'CLOSE_ALL_TABS' }
  | { type: 'ADD_OUTPUT_MESSAGE'; payload: { message: string; type: 'info' | 'success' | 'error' | 'warning' } }
  | { type: 'CLEAR_OUTPUT' };

// Enhanced Initial State
const initialFileSystem: FileSystemNode[] = [
  {
    id: '1',
    name: 'home',
    type: 'directory',
    modified: new Date(),
    path: '/home',
    children: [
      {
        id: '2',
        name: 'user',
        type: 'directory',
        modified: new Date(),
        parentId: '1',
        path: '/home/user',
        children: [
          {
            id: '3',
            name: 'Documents',
            type: 'directory',
            modified: new Date(),
            parentId: '2',
            path: '/home/user/Documents',
            children: [],
            tags: ['docs', 'work']
          },
          {
            id: '4',
            name: 'Downloads',
            type: 'directory',
            modified: new Date(),
            parentId: '2',
            path: '/home/user/Downloads',
            children: [],
            tags: ['downloads']
          },
          {
            id: '5',
            name: 'Projects',
            type: 'directory',
            modified: new Date(),
            parentId: '2',
            path: '/home/user/Projects',
            children: [],
            tags: ['code', 'projects'],
            favorite: true
          },
          {
            id: '6',
            name: 'README.md',
            type: 'file',
            content: '# Welcome to HENU\n\nThis is your home directory.\n\n## Available Commands\n- help: Show all commands\n- ls: List files\n- cd: Change directory\n- mkdir: Create directory\n- touch: Create file\n- rm: Remove file\n- cat: View file\n- henu: AI tools',
            size: 256,
            modified: new Date(),
            parentId: '2',
            path: '/home/user/README.md',
            tags: ['documentation', 'readme'],
            favorite: true
          },
          {
            id: '7',
            name: '.config',
            type: 'directory',
            modified: new Date(),
            parentId: '2',
            path: '/home/user/.config',
            children: [],
            tags: ['config', 'hidden']
          },
          {
            id: '8',
            name: 'script.js',
            type: 'file',
            content: 'console.log("Hello HENU!");\n\nfunction greet() {\n  return "Welcome to the terminal!";\n}\n\ngreet();',
            size: 128,
            modified: new Date(),
            parentId: '2',
            path: '/home/user/script.js',
            tags: ['javascript', 'code']
          },
        ]
      }
    ]
  },
  {
    id: '9',
    name: 'etc',
    type: 'directory',
    modified: new Date(),
    path: '/etc',
    children: [
      {
        id: '10',
        name: 'config.json',
        type: 'file',
        content: '{\n  "theme": "dark",\n  "aiEnabled": true,\n  "terminalType": "bash"\n}',
        size: 128,
        modified: new Date(),
        parentId: '9',
        path: '/etc/config.json',
        tags: ['configuration', 'system']
      }
    ]
  },
  {
    id: '11',
    name: 'var',
    type: 'directory',
    modified: new Date(),
    path: '/var',
    children: [],
    tags: ['system', 'logs']
  },
  {
    id: '12',
    name: 'tmp',
    type: 'directory',
    modified: new Date(),
    path: '/tmp',
    children: [],
    tags: ['temporary', 'system']
  },
  {
    id: '13',
    name: 'bin',
    type: 'directory',
    modified: new Date(),
    path: '/bin',
    children: [],
    tags: ['binaries', 'system']
  },
];

const initialState: OSState = {
  activeFile: null,
  terminalHistory: [],
  aiMessages: [],
  fileSystem: initialFileSystem,
  currentPath: '/home/user',
  openTabs: [],
  outputMessages: [],
};

// Enhanced Reducer
const osReducer = (state: OSState, action: OSAction): OSState => {
  switch (action.type) {
    case 'SET_ACTIVE_FILE':
      return { ...state, activeFile: action.payload };

    case 'ADD_TERMINAL_COMMAND':
      return {
        ...state,
        terminalHistory: [
          ...state.terminalHistory,
          {
            command: action.payload.command,
            output: action.payload.output,
            isError: action.payload.isError,
            timestamp: new Date(),
          },
        ],
      };

    case 'CLEAR_TERMINAL':
      return { ...state, terminalHistory: [] };

    case 'ADD_AI_MESSAGE':
      return {
        ...state,
        aiMessages: [
          ...state.aiMessages,
          {
            id: Date.now().toString(),
            role: action.payload.role,
            content: action.payload.content,
            timestamp: new Date(),
          },
        ],
      };

    case 'CLEAR_AI_MESSAGES':
      return { ...state, aiMessages: [] };

    case 'UPDATE_FILE_SYSTEM':
      return { ...state, fileSystem: action.payload };

    case 'SET_CURRENT_PATH':
      return { ...state, currentPath: action.payload };

    case 'CREATE_FILE': {
      const newFile: FileSystemNode = {
        id: Date.now().toString(),
        name: action.payload.name,
        type: 'file',
        content: action.payload.content || '',
        size: (action.payload.content || '').length,
        modified: new Date(),
        parentId: action.payload.parentId || '2',
        tags: [],
        favorite: false,
        pinned: false,
        locked: false,
      };

      const updateFileSystem = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          if (node.id === action.payload.parentId || (!action.payload.parentId && node.id === '2')) {
            const children = [...(node.children || []), newFile];
            return {
              ...node,
              children,
              modified: new Date(),
            };
          }
          if (node.children) {
            return {
              ...node,
              children: updateFileSystem(node.children),
            };
          }
          return node;
        });
      };

      return {
        ...state,
        fileSystem: updateFileSystem(state.fileSystem),
      };
    }


    case 'CREATE_DIRECTORY': {
      const newDir: FileSystemNode = {
        id: Date.now().toString(),
        name: action.payload.name,
        type: 'directory',
        modified: new Date(),
        parentId: action.payload.parentId || '2',
        children: [],
        tags: [],
        favorite: false,
        pinned: false,
        locked: false,
      };

      const updateFileSystem = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          if (node.id === action.payload.parentId || (!action.payload.parentId && node.id === '2')) {
            const children = [...(node.children || []), newDir];
            return {
              ...node,
              children,
              modified: new Date(),
            };
          }
          if (node.children) {
            return {
              ...node,
              children: updateFileSystem(node.children),
            };
          }
          return node;
        });
      };

      return {
        ...state,
        fileSystem: updateFileSystem(state.fileSystem),
      };
    }

    case 'DELETE_NODE': {
      const deleteNodeRecursive = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.filter(node => {
          if (node.id === action.payload) return false;
          if (node.children) {
            node.children = deleteNodeRecursive(node.children);
          }
          return true;
        });
      };

      return {
        ...state,
        fileSystem: deleteNodeRecursive(state.fileSystem),
        activeFile: state.activeFile?.id === action.payload ? null : state.activeFile,
      };
    }

    case 'UPDATE_FILE_CONTENT': {
      const updateFileRecursive = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          if (node.id === action.payload.id && node.type === 'file') {
            return {
              ...node,
              content: action.payload.content,
              size: action.payload.content.length,
              modified: new Date(),
            };
          }
          if (node.children) {
            return {
              ...node,
              children: updateFileRecursive(node.children),
            };
          }
          return node;
        });
      };

      const updatedFileSystem = updateFileRecursive(state.fileSystem);
      const updatedFile = updatedFileSystem
        .flatMap(n => [n, ...(n.children || [])])
        .find(f => f.id === action.payload.id);

      return {
        ...state,
        fileSystem: updatedFileSystem,
        activeFile: updatedFile || state.activeFile,
      };
    }

    case 'UPDATE_NODE': {
      const updateNodeRecursive = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          if (node.id === action.payload.id) {
            return {
              ...node,
              ...action.payload.updates,
              modified: new Date(),
            };
          }
          if (node.children) {
            return {
              ...node,
              children: updateNodeRecursive(node.children),
            };
          }
          return node;
        });
      };

      const updatedFileSystem = updateNodeRecursive(state.fileSystem);
      const updatedFile = updatedFileSystem
        .flatMap(n => [n, ...(n.children || [])])
        .find(f => f.id === action.payload.id);

      return {
        ...state,
        fileSystem: updatedFileSystem,
        activeFile: updatedFile || state.activeFile,
      };
    }

    case 'MOVE_NODE': {
      const { nodeId, targetParentId } = action.payload;

      // Find the node to move
      let nodeToMove: FileSystemNode | null = null;
      let sourceParentId: string | undefined;

      const findAndRemoveNode = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.filter(node => {
          if (node.id === nodeId) {
            nodeToMove = { ...node };
            sourceParentId = node.parentId;
            return false;
          }
          if (node.children) {
            node.children = findAndRemoveNode(node.children);
          }
          return true;
        });
      };

      // Remove from source
      const fileSystemWithoutNode = findAndRemoveNode(state.fileSystem);

      if (!nodeToMove) {
        return state;
      }

      // Update node with new parent
      nodeToMove = {
        ...nodeToMove,
        parentId: targetParentId,
        modified: new Date(),
      };

      // Add to target
      const addToTarget = (nodes: FileSystemNode[]): FileSystemNode[] => {
        return nodes.map(node => {
          if (node.id === targetParentId) {
            return {
              ...node,
              children: [...(node.children || []), nodeToMove!],
              modified: new Date(),
            };
          }
          if (node.children) {
            return {
              ...node,
              children: addToTarget(node.children),
            };
          }
          return node;
        });
      };

      const finalFileSystem = addToTarget(fileSystemWithoutNode);

      return {
        ...state,
        fileSystem: finalFileSystem,
      };
    }

    case 'OPEN_TAB': {
      // Check if tab is already open
      const isAlreadyOpen = state.openTabs.some(tab => tab.id === action.payload.id);
      if (isAlreadyOpen) {
        return {
          ...state,
          activeFile: action.payload,
        };
      }

      return {
        ...state,
        openTabs: [...state.openTabs, action.payload],
        activeFile: action.payload,
      };
    }

    case 'CLOSE_TAB': {
      const tabIndex = state.openTabs.findIndex(tab => tab.id === action.payload);
      if (tabIndex === -1) return state;

      const newTabs = state.openTabs.filter(tab => tab.id !== action.payload);

      // If closing the active tab, switch to another tab
      let newActiveFile = state.activeFile;
      if (state.activeFile?.id === action.payload) {
        if (newTabs.length > 0) {
          // Switch to the next tab, or previous if it was the last one
          const newIndex = tabIndex >= newTabs.length ? newTabs.length - 1 : tabIndex;
          newActiveFile = newTabs[newIndex];
        } else {
          newActiveFile = null;
        }
      }

      return {
        ...state,
        openTabs: newTabs,
        activeFile: newActiveFile,
      };
    }

    case 'CLOSE_ALL_TABS': {
      return {
        ...state,
        openTabs: [],
        activeFile: null,
      };
    }

    case 'ADD_OUTPUT_MESSAGE': {
      return {
        ...state,
        outputMessages: [
          ...state.outputMessages,
          {
            message: action.payload.message,
            type: action.payload.type,
            timestamp: new Date(),
          },
        ],
      };
    }

    case 'CLEAR_OUTPUT': {
      return {
        ...state,
        outputMessages: [],
      };
    }

    default:
      return state;
  }
};

// Context
interface OSContextType {
  state: OSState;
  dispatch: React.Dispatch<OSAction>;
  addTerminalCommand: (command: string, output: string, isError?: boolean) => void;
  clearTerminal: () => void;
  addAIMessage: (role: 'user' | 'assistant', content: string) => void;
  clearAIMessages: () => void;
  setActiveFile: (file: FileSystemNode | null) => void;
  updateFileSystem: (fileSystem: FileSystemNode[]) => void;
  setCurrentPath: (path: string) => void;
  executeCommand: (command: string) => void;
  openFile: (filename: string) => void;
  updateFileContent: (id: string, content: string) => void;
  createFile: (name: string, content?: string, parentId?: string) => void;
  createDirectory: (name: string, parentId?: string) => void;
  deleteNode: (id: string) => void;
  getNodeByPath: (path: string) => FileSystemNode | null;
  getFileTree: () => FileSystemNode[];
  updateNode: (id: string, updates: Partial<FileSystemNode>) => void;
  moveNode: (nodeId: string, targetParentId: string) => void;
  findNodeById: (id: string) => FileSystemNode | null;
  getParentNode: (id: string) => FileSystemNode | null;
  listDirectory: (path?: string) => FileSystemNode[];
  getCurrentDirectory: () => FileSystemNode | null;
  openTab: (file: FileSystemNode) => void;
  closeTab: (fileId: string) => void;
  closeAllTabs: () => void;
  addOutputMessage: (message: string, type?: 'info' | 'success' | 'error' | 'warning') => void;
  clearOutput: () => void;
}

const OSContext = createContext<OSContextType | undefined>(undefined);

// Provider
export const OSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(osReducer, initialState);

  // Initialize Git service
  useEffect(() => {
    const initGit = async () => {
      try {
        const { initGitService } = await import('../services/GitService');
        const { getSimpleFS } = await import('../services/SimpleFS');
        const fs = getSimpleFS();
        initGitService(fs, state.currentPath || '/workspace');
        console.log('Git service initialized for:', state.currentPath || '/workspace');
      } catch (error) {
        console.error('Failed to initialize Git:', error);
      }
    };
    initGit();
  }, [state.currentPath]);

  // Helper functions
  const addTerminalCommand = (command: string, output: string, isError?: boolean) => {
    dispatch({ type: 'ADD_TERMINAL_COMMAND', payload: { command, output, isError } });
  };

  const clearTerminal = () => {
    dispatch({ type: 'CLEAR_TERMINAL' });
  };

  const addAIMessage = (role: 'user' | 'assistant', content: string) => {
    dispatch({ type: 'ADD_AI_MESSAGE', payload: { role, content } });
  };

  const clearAIMessages = () => {
    dispatch({ type: 'CLEAR_AI_MESSAGES' });
  };

  const setActiveFile = (file: FileSystemNode | null) => {
    dispatch({ type: 'SET_ACTIVE_FILE', payload: file });
  };

  const updateFileSystem = (fileSystem: FileSystemNode[]) => {
    dispatch({ type: 'UPDATE_FILE_SYSTEM', payload: fileSystem });
  };

  const setCurrentPath = (path: string) => {
    dispatch({ type: 'SET_CURRENT_PATH', payload: path });
  };

  const executeCommand = (command: string) => {
    console.log('Executing command:', command);
  };

  const openFile = (filename: string) => {
    const findFile = (nodes: FileSystemNode[]): FileSystemNode | null => {
      for (const node of nodes) {
        if (node.name === filename && node.type === 'file') {
          return node;
        }
        if (node.children) {
          const found = findFile(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const file = findFile(state.fileSystem);
    if (file) {
      setActiveFile(file);
    }
  };

  const updateFileContent = (id: string, content: string) => {
    dispatch({ type: 'UPDATE_FILE_CONTENT', payload: { id, content } });
  };

  const createFile = (name: string, content?: string, parentId?: string) => {
    dispatch({ type: 'CREATE_FILE', payload: { name, content, parentId } });
  };

  const createDirectory = (name: string, parentId?: string) => {
    dispatch({ type: 'CREATE_DIRECTORY', payload: { name, parentId } });
  };

  const deleteNode = (id: string) => {
    dispatch({ type: 'DELETE_NODE', payload: id });
  };

  const updateNode = (id: string, updates: Partial<FileSystemNode>) => {
    dispatch({ type: 'UPDATE_NODE', payload: { id, updates } });
  };

  const moveNode = (nodeId: string, targetParentId: string) => {
    dispatch({ type: 'MOVE_NODE', payload: { nodeId, targetParentId } });
  };

  const findNodeById = (id: string, nodes: FileSystemNode[] = state.fileSystem): FileSystemNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(id, node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const getParentNode = (id: string): FileSystemNode | null => {
    const findParent = (nodes: FileSystemNode[], parentId?: string): FileSystemNode | null => {
      for (const node of nodes) {
        if (node.id === id) {
          return parentId ? findNodeById(parentId) : null;
        }
        if (node.children) {
          const found = findParent(node.children, node.id);
          if (found) return found;
        }
      }
      return null;
    };
    return findParent(state.fileSystem);
  };

  const getNodeByPath = (path: string): FileSystemNode | null => {
    if (!path || path === '/') {
      return {
        id: 'root',
        name: '/',
        type: 'directory',
        modified: new Date(),
        children: state.fileSystem,
        path: '/'
      };
    }

    const parts = path.split('/').filter(p => p);
    let currentNode: FileSystemNode | null = {
      id: 'root',
      name: '/',
      type: 'directory',
      modified: new Date(),
      children: state.fileSystem,
      path: '/'
    };

    for (const part of parts) {
      if (!currentNode?.children) return null;
      const found = currentNode.children.find(child => child.name === part);
      if (!found) return null;
      currentNode = found;
    }

    return currentNode;
  };

  const getFileTree = () => {
    const flattenNodes = (nodes: FileSystemNode[]): FileSystemNode[] => {
      return nodes.flatMap(node => [node, ...(node.children ? flattenNodes(node.children) : [])]);
    };
    return flattenNodes(state.fileSystem);
  };

  const getCurrentDirectory = (): FileSystemNode | null => {
    return getNodeByPath(state.currentPath);
  };

  const listDirectory = (path?: string): FileSystemNode[] => {
    const node = getNodeByPath(path || state.currentPath);
    if (!node || node.type !== 'directory') {
      return [];
    }
    return node.children || [];
  };

  // Tab management functions
  const openTab = (file: FileSystemNode) => {
    dispatch({ type: 'OPEN_TAB', payload: file });
  };

  const closeTab = (fileId: string) => {
    dispatch({ type: 'CLOSE_TAB', payload: fileId });
  };

  const closeAllTabs = () => {
    dispatch({ type: 'CLOSE_ALL_TABS' });
  };

  const addOutputMessage = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    dispatch({ type: 'ADD_OUTPUT_MESSAGE', payload: { message, type } });
  };

  const clearOutput = () => {
    dispatch({ type: 'CLEAR_OUTPUT' });
  };

  // Context value
  const contextValue: OSContextType = {
    state,
    dispatch,
    addTerminalCommand,
    clearTerminal,
    addAIMessage,
    clearAIMessages,
    setActiveFile,
    updateFileSystem,
    setCurrentPath,
    executeCommand,
    openFile,
    updateFileContent,
    createFile,
    createDirectory,
    deleteNode,
    getNodeByPath,
    getFileTree,
    updateNode,
    moveNode,
    findNodeById,
    getParentNode,
    listDirectory,
    getCurrentDirectory,
    openTab,
    closeTab,
    closeAllTabs,
    addOutputMessage,
    clearOutput,
  };

  return (
    <OSContext.Provider value={contextValue}>
      {children}
    </OSContext.Provider>
  );
};

// Hook
export const useOS = (): OSContextType => {
  const context = useContext(OSContext);
  if (!context) {
    throw new Error('useOS must be used within an OSProvider');
  }
  return context;
};