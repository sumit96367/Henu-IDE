import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOS } from '../context/OSContext';
import { getGitService } from '../services/GitService';
import {
  FolderIcon, FileIcon, ChevronRight, ChevronDown,
  Plus, FolderPlus, Trash2, Edit3, Copy, Download,
  RefreshCw, Search, Terminal, X,
  FileText, Image, Code, Database, Music, Video,
  Globe, Settings, Type, Binary, Lock, Unlock, Upload,
  Heart, Pin, History,
  Grid3x3, List, MoreVertical,
  ArrowUpRight,
  FilePlus, FolderPlus as FolderPlusIcon, FolderTree,
  Zap, Cpu
} from 'lucide-react';

export const FileExplorer = () => {
  const {
    state,
    openTab,
    createFile,
    createDirectory,
    deleteNode,
    updateFileContent,
    getNodeByPath,
    setCurrentPath,
    updateFileSystem,
    updateNode,
    moveNode,
    findNodeById: findNodeByIdContext,
    getParentNode: getParentNodeContext,
    listDirectory,
    getCurrentDirectory
  } = useOS();

  const [expanded, setExpanded] = useState<Set<string>>(new Set(['1', '2']));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [contextNodeId, setContextNodeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'modified' | 'size' | 'favorite'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [dragOverNode, setDragOverNode] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [currentTag, setCurrentTag] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [multiSelect, setMultiSelect] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<{ type: 'cut' | 'copy', node: any } | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [gitStatus, setGitStatus] = useState<Map<string, string>>(new Map());
  const [isRepo, setIsRepo] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Update breadcrumb when current path changes
  useEffect(() => {
    if (state.currentPath) {
      const parts = state.currentPath.split('/').filter(p => p);
      setBreadcrumb(parts);

      // Auto-expand to current path
      let currentPath = '';
      const newExpanded = new Set(expanded);

      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
        const node = getNodeByPath(currentPath);
        if (node) {
          newExpanded.add(node.id);
        }
      }

      setExpanded(newExpanded);
    }
  }, [state.currentPath]);

  // Update expanded when file system changes
  useEffect(() => {
    const paths = state.currentPath.split('/').filter(p => p);
    let currentPath = '';
    const newExpanded = new Set(expanded);

    paths.forEach(part => {
      currentPath = currentPath ? `${currentPath}/${part}` : `/${part}`;
      const node = getNodeByPath(currentPath);
      if (node) {
        newExpanded.add(node.id);
      }
    });

    setExpanded(newExpanded);
  }, [state.currentPath]);

  // Load Git status
  const loadGitStatus = useCallback(async () => {
    const gitService = getGitService();
    if (!gitService) return;

    try {
      const hasRepo = await gitService.isRepo();
      setIsRepo(hasRepo);
      if (hasRepo) {
        const status = await gitService.getStatus();
        const statusMap = new Map<string, string>();

        status.modified.forEach(file => statusMap.set(file, 'M'));
        status.staged.forEach(file => statusMap.set(file, 'A'));
        status.untracked.forEach(file => statusMap.set(file, '?'));

        setGitStatus(statusMap);
      } else {
        setGitStatus(new Map());
      }
    } catch (error) {
      console.error('Failed to load git status:', error);
    }
  }, []);

  useEffect(() => {
    loadGitStatus();
  }, [state.fileSystem, loadGitStatus]);

  // Listen for custom 'git-changed' events if any
  useEffect(() => {
    const handleGitChange = () => loadGitStatus();
    window.addEventListener('git-changed', handleGitChange);
    return () => window.removeEventListener('git-changed', handleGitChange);
  }, [loadGitStatus]);

  // Update selected node when active file changes
  useEffect(() => {
    if (state.activeFile) {
      setSelectedNodeId(state.activeFile.id);
      // Auto-expand parent directories
      const expandParents = (nodeId: string) => {
        const node = findNodeById(nodeId);
        if (node && node.parentId) {
          setExpanded(prev => new Set([...prev, node.parentId!]));
          expandParents(node.parentId);
        }
      };
      expandParents(state.activeFile.id);
    }
  }, [state.activeFile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const ctrlKey = e.ctrlKey || e.metaKey;

      if (ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            handleNewFile();
            break;
          case 'd':
            e.preventDefault();
            if (selectedNodeId) {
              const node = findNodeById(selectedNodeId);
              if (node) handleDelete(node.id);
            }
            break;
          case 'r':
            e.preventDefault();
            if (selectedNodeId) {
              const node = findNodeById(selectedNodeId);
              if (node) startRename(node);
            }
            break;
          case 'f':
            e.preventDefault();
            const searchInput = document.querySelector('input[placeholder="Search files..."]') as HTMLInputElement;
            searchInput?.focus();
            break;
          case 'c':
            e.preventDefault();
            if (selectedNodeId) {
              const node = findNodeById(selectedNodeId);
              if (node) handleCopyNode(node);
            }
            break;
          case 'x':
            e.preventDefault();
            if (selectedNodeId) {
              const node = findNodeById(selectedNodeId);
              if (node) handleCutNode(node);
            }
            break;
          case 'v':
            e.preventDefault();
            if (clipboard && selectedNodeId) {
              handlePasteNode();
            }
            break;
          case 'a':
            e.preventDefault();
            // Select all visible items
            const visibleNodes = getAllVisibleNodes();
            setMultiSelect(new Set(visibleNodes.map(n => n.id)));
            break;
          case 's':
            e.preventDefault();
            setShowInfoPanel(!showInfoPanel);
            break;
        }
      }

      // Escape key
      if (e.key === 'Escape') {
        setShowContextMenu(false);
        setEditingNodeId(null);
        setMultiSelect(new Set());
      }

      // Enter key for rename
      if (e.key === 'Enter' && editingNodeId) {
        handleRename(editingNodeId);
      }

      // Arrow keys for navigation
      if (!editingNodeId) {
        const visibleNodes = getAllVisibleNodes();
        const currentIndex = visibleNodes.findIndex(n => n.id === selectedNodeId);

        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            if (currentIndex > 0) {
              const prevNode = visibleNodes[currentIndex - 1];
              handleFileClick(prevNode);
            }
            break;
          case 'ArrowDown':
            e.preventDefault();
            if (currentIndex < visibleNodes.length - 1) {
              const nextNode = visibleNodes[currentIndex + 1];
              handleFileClick(nextNode);
            }
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (selectedNodeId) {
              const node = findNodeById(selectedNodeId);
              if (node && node.type === 'directory') {
                toggleExpand(node.id);
              }
            }
            break;
          case 'ArrowLeft':
            e.preventDefault();
            if (selectedNodeId) {
              const node = findNodeById(selectedNodeId);
              if (node && node.type === 'directory' && expanded.has(node.id)) {
                toggleExpand(node.id);
              } else if (node?.parentId) {
                const parent = findNodeById(node.parentId);
                if (parent) handleFileClick(parent);
              }
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNodeId, editingNodeId, clipboard, expanded]);

  // Global click handler to close context menu
  useEffect(() => {
    const handleClick = () => {
      setShowContextMenu(false);
    };

    if (showContextMenu) {
      window.addEventListener('click', handleClick);
      window.addEventListener('contextmenu', handleClick);
    }

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('contextmenu', handleClick);
    };
  }, [showContextMenu]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, node: any) => {
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingNodeId(node.id);
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragOver = (e: React.DragEvent, node: any) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (node.type === 'directory' && node.id !== draggingNodeId) {
      setDragOverNode(node.id);
      e.currentTarget.classList.add('bg-blue-900/30');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-blue-900/30');
    setDragOverNode(null);
  };

  const handleDrop = (e: React.DragEvent, targetNode: any) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-900/30');

    if (draggingNodeId && targetNode.type === 'directory' && targetNode.id !== draggingNodeId) {
      const draggedNode = findNodeById(draggingNodeId);
      if (draggedNode) {
        // Move node to target directory
        moveNode(draggedNode.id, targetNode.id);
        showToast(`Moved "${draggedNode.name}" to "${targetNode.name}"`, 'success');
      }
    }

    setDraggingNodeId(null);
    setDragOverNode(null);
  };

  const findNodeById = useCallback((id: string): any => {
    return findNodeByIdContext(id);
  }, [findNodeByIdContext]);

  const getParentNode = (id: string): any => {
    return getParentNodeContext(id);
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'js':
      case 'jsx':
        return <Code size={14} className="text-yellow-400" />;
      case 'ts':
      case 'tsx':
        return <Code size={14} className="text-blue-400" />;
      case 'html':
      case 'htm':
        return <Globe size={14} className="text-orange-500" />;
      case 'css':
      case 'scss':
      case 'sass':
        return <Type size={14} className="text-pink-500" />;
      case 'json':
        return <Settings size={14} className="text-yellow-600" />;
      case 'md':
        return <FileText size={14} className="text-gray-300" />;
      case 'txt':
        return <FileText size={14} className="text-gray-400" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return <Image size={14} className="text-green-400" />;
      case 'mp3':
      case 'wav':
      case 'ogg':
        return <Music size={14} className="text-purple-400" />;
      case 'mp4':
      case 'avi':
      case 'mov':
        return <Video size={14} className="text-red-400" />;
      case 'db':
      case 'sql':
        return <Database size={14} className="text-blue-600" />;
      case 'exe':
      case 'bin':
      case 'dll':
        return <Binary size={14} className="text-red-500" />;
      case 'py':
        return <Code size={14} className="text-green-500" />;
      case 'java':
        return <Code size={14} className="text-orange-600" />;
      case 'cpp':
      case 'c':
        return <Code size={14} className="text-blue-500" />;
      case 'php':
        return <Code size={14} className="text-purple-600" />;
      case 'rb':
        return <Code size={14} className="text-red-600" />;
      case 'go':
        return <Code size={14} className="text-cyan-500" />;
      case 'rs':
        return <Code size={14} className="text-orange-700" />;
      default:
        return <FileIcon size={14} className="text-blue-400" />;
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getAllVisibleNodes = (): any[] => {
    const result: any[] = [];

    const traverse = (nodes: any[], depth: number = 0) => {
      nodes.forEach(node => {
        if (node.name.startsWith('.') && !showHidden) return;


        if (currentTag && !node.tags?.includes(currentTag)) return;

        result.push(node);

        if (node.type === 'directory' && expanded.has(node.id) && node.children) {
          traverse(node.children, depth + 1);
        }
      });
    };

    traverse(state.fileSystem);
    return result;
  };

  const handleFileClick = (node: any, e?: React.MouseEvent) => {
    const isMultiSelect = e?.ctrlKey || e?.metaKey;
    const isRangeSelect = e?.shiftKey;

    if (isMultiSelect) {
      setMultiSelect(prev => {
        const next = new Set(prev);
        if (next.has(node.id)) {
          next.delete(node.id);
        } else {
          next.add(node.id);
        }
        return next;
      });
      setSelectedNodeId(node.id);
    } else if (isRangeSelect && selectedNodeId) {
      const visibleNodes = getAllVisibleNodes();
      const startIndex = visibleNodes.findIndex(n => n.id === selectedNodeId);
      const endIndex = visibleNodes.findIndex(n => n.id === node.id);

      if (startIndex !== -1 && endIndex !== -1) {
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);
        const rangeIds = visibleNodes.slice(start, end + 1).map(n => n.id);
        setMultiSelect(new Set(rangeIds));
      }
    } else {
      setMultiSelect(new Set([node.id]));
      setSelectedNodeId(node.id);
    }

    if (node.type === 'file') {
      openTab(node);
    } else if (!isMultiSelect && !isRangeSelect) {
      toggleExpand(node.id);
      // Set current path to clicked directory
      const path = getNodePath(node);
      if (path) {
        setCurrentPath(path);
      }
    }
  };

  const getNodePath = (node: any): string => {
    if (node.path) return node.path;

    const getPath = (n: any, path: string[] = []): string[] => {
      if (!n.parentId) {
        if (n.id === 'root') return ['', ...path];
        return [n.name, ...path];
      }
      const parent = findNodeById(n.parentId);
      if (parent) {
        return getPath(parent, [n.name, ...path]);
      }
      return [n.name, ...path];
    };

    const pathParts = getPath(node);
    return pathParts.join('/') || '/';
  };

  const handleNewFile = async (parentId?: string) => {
    const targetParentId = parentId || (selectedNodeId && findNodeById(selectedNodeId)?.type === 'directory' ? selectedNodeId : '2');
    const name = `newfile_${Date.now()}.txt`;
    const content = `// New file created at ${new Date().toLocaleString()}\n// Edit this file to get started`;

    createFile(name, content, targetParentId);

    // Auto-rename after creation
    setTimeout(() => {
      const newFile = state.fileSystem
        .flatMap(n => [n, ...(n.children || [])])
        .find(f => f.name === name && f.parentId === targetParentId);
      if (newFile) {
        startRename(newFile);
      }
    }, 100);

    showToast(`Created file: ${name}`, 'success');
  };

  const handleNewFolder = async (parentId?: string) => {
    const targetParentId = parentId || (selectedNodeId && findNodeById(selectedNodeId)?.type === 'directory' ? selectedNodeId : '2');
    const name = `New Folder ${Date.now()}`;

    createDirectory(name, targetParentId);

    // Auto-rename after creation
    setTimeout(() => {
      const newFolder = state.fileSystem
        .flatMap(n => [n, ...(n.children || [])])
        .find(f => f.name === name && f.parentId === targetParentId);
      if (newFolder) {
        startRename(newFolder);
      }
    }, 100);

    showToast(`Created folder: ${name}`, 'success');
  };

  const startRename = (node: any) => {
    setEditingNodeId(node.id);
    setEditingName(node.name);
  };

  const handleRename = (nodeId: string) => {
    if (!editingName.trim()) {
      setEditingNodeId(null);
      return;
    }

    const node = findNodeById(nodeId);
    if (!node) return;

    const parent = getParentNode(nodeId);
    if (parent?.children?.some(child => child.name === editingName && child.id !== nodeId)) {
      showToast(`"${editingName}" already exists in this directory!`, 'error');
      return;
    }

    updateNode(nodeId, { name: editingName });

    if (state.activeFile?.id === nodeId) {
      openTab({ ...state.activeFile, name: editingName });
    }

    setEditingNodeId(null);
    showToast(`Renamed to: ${editingName}`, 'success');
  };

  const handleDelete = (id: string) => {
    const node = findNodeById(id);
    if (!node) return;

    if (node.type === 'directory' && node.children && node.children.length > 0) {
      if (!confirm(`This folder contains ${node.children.length} items. Delete them all?`)) {
        return;
      }
    }

    deleteNode(id);

    if (selectedNodeId === id) {
      setSelectedNodeId(null);
      // Note: Tab will be automatically closed by closeTab action
      // No need to manually set active file to null
    }

    // Remove from multi-select
    setMultiSelect(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    showToast(`Deleted: ${node.name}`, 'success');
  };

  const handleDownload = (node: any) => {
    if (node.type === 'file' && node.content) {
      const blob = new Blob([node.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = node.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Downloaded: ${node.name}`, 'success');
    }
  };

  const handleCopyPath = (node: any) => {
    const path = getNodePath(node);
    navigator.clipboard.writeText(path);
    showToast(`Copied path: ${path}`, 'success');
  };

  const handleOpenInTerminal = (node: any) => {
    if (node.type === 'directory') {
      const path = getNodePath(node);
      setCurrentPath(path);
      showToast(`Terminal path set to: ${path}`, 'info');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, node: any) => {
    e.preventDefault();
    e.stopPropagation();

    if (!multiSelect.has(node.id)) {
      setMultiSelect(new Set([node.id]));
    }

    setSelectedNodeId(node.id);
    setContextNodeId(node.id);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleCopyNode = (node: any) => {
    setClipboard({ type: 'copy', node });
    showToast(`Copied: ${node.name}`, 'success');
  };

  const handleCutNode = (node: any) => {
    setClipboard({ type: 'cut', node });
    showToast(`Cut: ${node.name}`, 'success');
  };

  const handlePasteNode = () => {
    if (!clipboard || !selectedNodeId) return;

    const targetNode = findNodeById(selectedNodeId);
    if (!targetNode || targetNode.type !== 'directory') return;

    if (clipboard.type === 'cut') {
      moveNode(clipboard.node.id, targetNode.id);
      setClipboard(null);
    } else {
      // Create a copy
      const newNode = {
        ...clipboard.node,
        id: Date.now().toString(),
        name: `Copy of ${clipboard.node.name}`,
        parentId: targetNode.id,
      };

      if (clipboard.node.type === 'file') {
        createFile(newNode.name, clipboard.node.content, targetNode.id);
      } else {
        createDirectory(newNode.name, targetNode.id);
      }

      showToast(`Pasted: ${clipboard.node.name}`, 'success');
    }
  };

  const handleFavorite = (node: any) => {
    updateNode(node.id, { favorite: !node.favorite });
    showToast(node.favorite ? 'Removed from favorites' : 'Added to favorites', 'success');
  };

  const handlePin = (node: any) => {
    updateNode(node.id, { pinned: !node.pinned });
    showToast(node.pinned ? 'Unpinned' : 'Pinned', 'success');
  };

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const targetParentId = selectedNodeId && findNodeById(selectedNodeId)?.type === 'directory' ? selectedNodeId : '2';
        createFile(file.name, content, targetParentId);
        showToast(`Uploaded: ${file.name}`, 'success');
      };
      reader.readAsText(file);
    });

    e.target.value = '';
    setShowUploadDialog(false);
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const themeBg = 'bg-theme-secondary';
    const themeBorder = 'border-theme';
    const accentColor = 'var(--accent-primary)';

    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 ${themeBg} border ${themeBorder} px-4 py-2 rounded-lg text-sm z-50 shadow-2xl animate-slideIn flex items-center space-x-3`;
    toast.style.color = 'var(--text-primary)';

    // Add dot
    const dot = document.createElement('div');
    dot.className = 'w-2 h-2 rounded-full';
    dot.style.backgroundColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : 'var(--accent-primary)';
    dot.style.boxShadow = `0 0 10px ${dot.style.backgroundColor}`;

    toast.prepend(dot);
    toast.textContent = ` ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('animate-slideOut');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  const getSortedChildren = (children: any[]) => {
    return [...children].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'modified':
          comparison = new Date(b.modified).getTime() - new Date(a.modified).getTime();
          break;
        case 'size':
          comparison = (b.size || 0) - (a.size || 0);
          break;
        case 'favorite':
          comparison = (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const renderNode = (node: any, depth: number = 0, parentPath: string = '') => {
    if (node.name.startsWith('.') && !showHidden) {
      return null;
    }

    const nodePath = getNodePath(node);
    const isExpanded = expanded.has(node.id);
    const isSelected = multiSelect.has(node.id);
    const isActiveFile = state.activeFile?.id === node.id;
    const isEditing = editingNodeId === node.id;
    const isDraggedOver = dragOverNode === node.id;
    const isDragging = draggingNodeId === node.id;

    const filteredChildren = node.children?.filter((child: any) => {
      if (searchQuery) {
        return child.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          child.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      return true;
    }) || [];

    return (
      <div key={node.id}>
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node)}
          onDragEnd={() => {
            setDraggingNodeId(null);
            setDragOverNode(null);
          }}
          className={`flex items-center space-x-2 px-2 py-1.5 cursor-pointer transition-all group ${isSelected
            ? 'bg-theme-accent/20 border-l-2 border-theme-accent'
            : isActiveFile
              ? 'bg-theme-accent/10 border-l-2 border-theme-accent'
              : isDraggedOver
                ? 'bg-theme-accent/10 border-2 border-theme-accent border-dashed'
                : isDragging
                  ? 'opacity-50'
                  : 'hover:bg-white/5'
            } ${node.name.startsWith('.') ? 'opacity-60' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={(e) => handleFileClick(node, e)}
          onDoubleClick={() => node.type === 'directory' && toggleExpand(node.id)}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {node.type === 'directory' && (
            <button
              className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}

          {node.type === 'directory' ? (
            <div className="relative">
              <FolderIcon size={16} className="text-yellow-500/70 flex-shrink-0" />
              {node.pinned && (
                <Pin size={10} className="absolute -top-1 -right-1 text-blue-400" />
              )}
            </div>
          ) : (
            <div className="flex-shrink-0 relative">
              {getFileIcon(node.name)}
              {node.favorite && (
                <Heart size={10} className="absolute -top-1 -right-1 text-red-400 fill-red-400" />
              )}
            </div>
          )}

          {isEditing ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => handleRename(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(node.id);
                if (e.key === 'Escape') setEditingNodeId(null);
              }}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-300 font-mono focus:outline-none focus:border-blue-500"
              autoFocus
            />
          ) : (
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-mono truncate flex items-center gap-1 ${isActiveFile ? 'text-blue-300' : 'text-gray-300'
                }`}>
                {node.name}
                {isActiveFile && <span className="text-xs text-blue-400 animate-pulse">●</span>}

                {/* Git Status Indicator */}
                {(() => {
                  const status = gitStatus.get(nodePath.startsWith('/') ? nodePath.substring(1) : nodePath);
                  if (!status) return null;
                  return (
                    <span className={`text-[10px] ml-1.5 px-1 rounded-sm font-bold ${status === 'M' ? 'bg-yellow-500/20 text-yellow-400' :
                        status === 'A' ? 'bg-green-500/20 text-green-400' :
                          'bg-gray-500/20 text-gray-400'
                      }`}>
                      {status === '?' ? 'U' : status}
                    </span>
                  );
                })()}

                {node.name.startsWith('.') && <span className="text-xs text-gray-500 ml-1">(hidden)</span>}
                {node.locked && <Lock size={10} className="text-gray-500" />}
              </span>

              {node.tags && node.tags.length > 0 && showTags && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {node.tags.slice(0, 2).map((tag: string) => (
                    <span key={tag} className="text-[10px] bg-gray-800 text-gray-400 px-1 rounded">
                      {tag}
                    </span>
                  ))}
                  {node.tags.length > 2 && (
                    <span className="text-[10px] text-gray-500">+{node.tags.length - 2}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {!isEditing && (
            <div className="flex items-center space-x-2">
              {node.type === 'file' && (
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {node.size ? `${(node.size / 1024).toFixed(1)}KB` : '0KB'}
                </span>
              )}

              <span className="text-xs text-gray-600 flex-shrink-0">
                {new Date(node.modified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>

              {/* Quick actions on hover */}
              <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFavorite(node);
                  }}
                  className="p-0.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400"
                  title={node.favorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <Heart size={12} className={node.favorite ? "fill-red-400 text-red-400" : ""} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(node);
                  }}
                  className="p-0.5 hover:bg-gray-700 rounded text-gray-400 hover:text-yellow-400"
                  title="Rename (Ctrl+R)"
                >
                  <Edit3 size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {node.type === 'directory' && isExpanded && filteredChildren.length > 0 && (
          <div>
            {getSortedChildren(filteredChildren).map((child: any) =>
              renderNode(child, depth + 1, nodePath)
            )}
          </div>
        )}
      </div>
    );
  };

  const handleCreateHere = () => {
    if (contextNodeId) {
      const node = findNodeById(contextNodeId);
      if (node?.type === 'directory') {
        handleNewFile(node.id);
      } else if (node?.parentId) {
        handleNewFile(node.parentId);
      } else {
        handleNewFile();
      }
    }
    setShowContextMenu(false);
  };

  const handleCreateFolderHere = () => {
    if (contextNodeId) {
      const node = findNodeById(contextNodeId);
      if (node?.type === 'directory') {
        handleNewFolder(node.id);
      } else if (node?.parentId) {
        handleNewFolder(node.parentId);
      } else {
        handleNewFolder();
      }
    }
    setShowContextMenu(false);
  };

  const handleCollapseAll = () => {
    setExpanded(new Set());
  };

  const handleRefresh = () => {
    // Force re-render
    updateFileSystem([...state.fileSystem]);
    showToast('Refreshed file system', 'info');
  };

  const getTotalItems = () => {
    return getAllVisibleNodes().length;
  };

  const selectedNode = selectedNodeId ? findNodeById(selectedNodeId) : null;
  const selectedNodes = Array.from(multiSelect).map(id => findNodeById(id)).filter(Boolean);

  // Navigation functions
  const navigateTo = (index: number) => {
    const newPath = '/' + breadcrumb.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
  };

  const getCurrentDirectoryItems = () => {
    const currentNode = getNodeByPath(state.currentPath);
    return currentNode?.children?.length || 0;
  };

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Search and Navigation */}
      <div className="p-2 border-b border-gray-800/50 bg-black/40 flex items-center space-x-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter files..."
            className="w-full pl-8 pr-2 py-1 bg-black/40 border border-gray-800 rounded text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-red-900/50 transition-all font-mono"
          />
        </div>
        <button
          onClick={handleRefresh}
          className="p-1.5 hover:bg-red-900/20 rounded text-gray-500 hover:text-red-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="px-2 py-1.5 border-b border-gray-800 flex items-center justify-between bg-black/20">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => handleNewFile()}
            className="p-2 hover:bg-blue-900/30 rounded text-blue-400 transition-colors"
            title="New File (Ctrl+N)"
          >
            <FilePlus size={16} />
          </button>

          <button
            onClick={() => handleNewFolder()}
            className="p-2 hover:bg-gray-800 rounded text-gray-400 transition-colors"
            title="New Folder"
          >
            <FolderPlusIcon size={16} />
          </button>

          <button
            onClick={handleUpload}
            className="p-2 hover:bg-purple-900/30 rounded text-purple-400 transition-colors"
            title="Upload Files"
          >
            <Upload size={16} />
          </button>

          <button
            onClick={handleCollapseAll}
            className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-200 transition-colors"
            title="Collapse All Folders"
          >
            <FolderTree size={16} />
          </button>

        </div>
      </div>


      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File List */}
        <div className={`flex-1 overflow-auto p-1 ${showInfoPanel ? 'w-3/4' : 'w-full'}`}>
          {state.fileSystem.map((node: any) => renderNode(node))}

          {
            searchQuery && getTotalItems() === 0 && (
              <div className="text-center text-gray-500 mt-12">
                <Search size={48} className="mx-auto mb-4 text-gray-600" />
                <div className="text-lg mb-2">No files found for "{searchQuery}"</div>
                <div className="text-sm text-gray-600">Try a different search term</div>
              </div>
            )
          }

          {
            getTotalItems() === 0 && !searchQuery && (
              <div className="text-center text-gray-500 mt-12">
                <FolderIcon size={64} className="mx-auto mb-6 text-gray-600" />
                <div className="text-xl mb-3">This folder is empty</div>
                <div className="text-sm text-gray-600 mb-8">Create a new file or folder to get started</div>
                <div className="flex justify-center space-x-6">
                  <button
                    onClick={() => handleNewFile()}
                    className="p-4 bg-blue-900/20 hover:bg-blue-900/40 rounded-full text-blue-300 transition-all transform hover:scale-110"
                    title="New File"
                  >
                    <FilePlus size={24} />
                  </button>
                  <button
                    onClick={() => handleNewFolder()}
                    className="p-4 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-all transform hover:scale-110"
                    title="New Folder"
                  >
                    <FolderPlusIcon size={24} />
                  </button>
                  <button
                    onClick={handleUpload}
                    className="p-4 bg-purple-900/20 hover:bg-purple-900/40 rounded-full text-purple-300 transition-all transform hover:scale-110"
                    title="Upload"
                  >
                    <Upload size={24} />
                  </button>
                </div>
              </div>
            )
          }
        </div >

        {/* Info Panel */}
        {
          showInfoPanel && selectedNode && (
            <div className="w-1/4 border-l border-gray-800 bg-gray-900/50 p-4 overflow-auto">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-mono text-gray-300">File Info</h3>
                  <button
                    onClick={() => setShowInfoPanel(false)}
                    className="text-gray-500 hover:text-gray-300"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gray-800 rounded-lg">
                      {selectedNode.type === 'directory' ? (
                        <FolderIcon size={24} className="text-yellow-500" />
                      ) : (
                        getFileIcon(selectedNode.name)
                      )}
                    </div>
                    <div>
                      <div className="text-gray-300 font-mono truncate">{selectedNode.name}</div>
                      <div className="text-xs text-gray-500">{selectedNode.type === 'file' ? 'File' : 'Folder'}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-gray-500">Path</div>
                    <div className="text-sm text-gray-300 font-mono bg-gray-800 p-2 rounded break-all">
                      {getNodePath(selectedNode)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500">Size</div>
                      <div className="text-sm text-gray-300">
                        {selectedNode.type === 'file'
                          ? `${(selectedNode.size || 0) / 1024} KB`
                          : `${selectedNode.children?.length || 0} items`
                        }
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Modified</div>
                      <div className="text-sm text-gray-300">
                        {new Date(selectedNode.modified).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {selectedNode.description && (
                    <div>
                      <div className="text-xs text-gray-500">Description</div>
                      <div className="text-sm text-gray-300 mt-1">
                        {selectedNode.description}
                      </div>
                    </div>
                  )}

                  {selectedNode.tags && selectedNode.tags.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 mb-2">Tags</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedNode.tags.map((tag: string) => (
                          <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-800">
                    <div className="text-xs text-gray-500 mb-2">Quick Actions</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleFavorite(selectedNode)}
                        className="flex items-center justify-center space-x-1 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300"
                      >
                        <Heart size={12} className={selectedNode.favorite ? "text-red-400" : ""} />
                        <span>{selectedNode.favorite ? "Unfavorite" : "Favorite"}</span>
                      </button>
                      <button
                        onClick={() => handlePin(selectedNode)}
                        className="flex items-center justify-center space-x-1 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300"
                      >
                        <Pin size={12} className={selectedNode.pinned ? "text-blue-400" : ""} />
                        <span>{selectedNode.pinned ? "Unpin" : "Pin"}</span>
                      </button>
                      <button
                        onClick={() => handleCopyPath(selectedNode)}
                        className="flex items-center justify-center space-x-1 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300"
                      >
                        <Copy size={12} />
                        <span>Copy Path</span>
                      </button>
                      <button
                        onClick={() => selectedNode.type === 'file' && handleDownload(selectedNode)}
                        className="flex items-center justify-center space-x-1 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300"
                        disabled={selectedNode.type !== 'file'}
                      >
                        <Download size={12} />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      </div >


      {/* Hidden file input for upload */}
      < input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        className="hidden"
      />

      {/* Upload Dialog */}
      {
        showUploadDialog && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg text-gray-300">Upload Files</h3>
                <button
                  onClick={() => setShowUploadDialog(false)}
                  className="text-gray-500 hover:text-gray-300"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="mb-6">
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                  <Upload size={48} className="mx-auto mb-4 text-gray-600" />
                  <div className="text-gray-300 mb-2">Drop files here or click to browse</div>
                  <div className="text-sm text-gray-500">Supports multiple files</div>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowUploadDialog(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
                >
                  Browse Files
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Context Menu */}
      {
        showContextMenu && contextNodeId && createPortal(
          <div
            className="fixed z-[9999] bg-gray-900 border border-gray-700 rounded-lg shadow-lg py-1 min-w-48 backdrop-blur-sm max-h-[70vh] overflow-y-auto"
            style={{
              left: Math.min(contextMenuPos.x, window.innerWidth - 250),
              top: Math.min(contextMenuPos.y, window.innerHeight - 400)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {multiSelect.size <= 1 ? (
              <>
                <button
                  onClick={handleCreateHere}
                  className="w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-2">
                    <Plus size={14} className="text-blue-400" />
                    <span>New File Here</span>
                  </div>
                  <span className="text-xs text-gray-500 group-hover:text-gray-400">Ctrl+N</span>
                </button>

                <button
                  onClick={handleCreateFolderHere}
                  className="w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 flex items-center space-x-2 group"
                >
                  <FolderPlusIcon size={14} className="text-yellow-400" />
                  <span>New Folder Here</span>
                </button>

                <div className="border-t border-gray-700 my-1"></div>

                <button
                  onClick={() => {
                    const node = findNodeById(contextNodeId);
                    if (node) startRename(node);
                    setShowContextMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-2">
                    <Edit3 size={14} className="text-yellow-400" />
                    <span>Rename</span>
                  </div>
                  <span className="text-xs text-gray-500 group-hover:text-gray-400">Ctrl+R</span>
                </button>

                <button
                  onClick={() => {
                    const node = findNodeById(contextNodeId);
                    if (node) handleCopyNode(node);
                    setShowContextMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-2">
                    <Copy size={14} className="text-blue-400" />
                    <span>Copy</span>
                  </div>
                  <span className="text-xs text-gray-500 group-hover:text-gray-400">Ctrl+C</span>
                </button>

                <button
                  onClick={() => {
                    const node = findNodeById(contextNodeId);
                    if (node) handleCutNode(node);
                    setShowContextMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-2">
                    <Copy size={14} className="text-orange-400" />
                    <span>Cut</span>
                  </div>
                  <span className="text-xs text-gray-500 group-hover:text-gray-400">Ctrl+X</span>
                </button>

                <button
                  onClick={() => {
                    const node = findNodeById(contextNodeId);
                    if (node) handleCopyPath(node);
                    setShowContextMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 flex items-center space-x-2 group"
                >
                  <Copy size={14} className="text-green-400" />
                  <span>Copy Path</span>
                </button>

                <button
                  onClick={() => {
                    const node = findNodeById(contextNodeId);
                    if (node && node.type === 'file') handleDownload(node);
                    setShowContextMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 flex items-center space-x-2 group"
                >
                  <Download size={14} className="text-green-400" />
                  <span>Download</span>
                </button>

                <button
                  onClick={() => {
                    const node = findNodeById(contextNodeId);
                    if (node) handleOpenInTerminal(node);
                    setShowContextMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 flex items-center space-x-2 group"
                >
                  <Terminal size={14} className="text-cyan-400" />
                  <span>Open in Terminal</span>
                </button>

                <button
                  onClick={() => {
                    const node = findNodeById(contextNodeId);
                    if (node) handleFavorite(node);
                    setShowContextMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 flex items-center space-x-2 group"
                >
                  <Heart size={14} className={findNodeById(contextNodeId)?.favorite ? "text-red-400 fill-red-400" : "text-gray-400"} />
                  <span>{findNodeById(contextNodeId)?.favorite ? "Remove from Favorites" : "Add to Favorites"}</span>
                </button>

                <div className="border-t border-gray-700 my-1"></div>

                <button
                  onClick={() => {
                    if (contextNodeId) handleDelete(contextNodeId);
                    setShowContextMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-red-900/30 text-red-400 flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-2">
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </div>
                  <span className="text-xs text-gray-500 group-hover:text-gray-400">Ctrl+D</span>
                </button>
              </>
            ) : (
              <>
                <div className="px-4 py-2 text-gray-300 text-sm border-b border-gray-800">
                  {multiSelect.size} items selected
                </div>
                <button
                  onClick={() => {
                    selectedNodes.forEach(node => node && handleDelete(node.id));
                    setMultiSelect(new Set());
                    setShowContextMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-red-900/30 text-red-400 flex items-center space-x-2"
                >
                  <Trash2 size={14} />
                  <span>Delete All</span>
                </button>
                <button
                  onClick={() => {
                    selectedNodes.forEach(node => node && handleDownload(node));
                    setShowContextMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-green-900/30 text-green-400 flex items-center space-x-2"
                >
                  <Download size={14} />
                  <span>Download All</span>
                </button>
                <button
                  onClick={() => {
                    selectedNodes.forEach(node => node && handleCopyPath(node));
                    setShowContextMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-800 text-gray-300 flex items-center space-x-2"
                >
                  <Copy size={14} />
                  <span>Copy All Paths</span>
                </button>
              </>
            )}
          </div>,
          document.body
        )
      }


      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
        
        .animate-slideOut {
          animation: slideOut 0.3s ease-in;
        }
        
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(100, 100, 100, 0.5);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(150, 150, 150, 0.5);
        }
      `}</style>
    </div >
  );
};