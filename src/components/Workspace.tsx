import { useState, useEffect, useRef } from 'react';
import { Panel } from './Panel';
import { FileExplorer } from './FileExplorer';
import { CodeEditor } from './CodeEditor';
import { AIAgent } from './AIAgent';
import { Terminal } from './Terminal';
import { Preview } from './Preview';
import { GitPanel } from './GitPanel';
import { StatusHUD } from './StatusHUD';
import {
  Play, Square, RotateCcw, Eye, Maximize2, Grid3x3,
  Zap, Split, Layout,
  ChevronLeft, ChevronRight, X, Minus,
  Bell, GitBranch
} from 'lucide-react';

// Electron IPC
const ipcRenderer = (window as any).require?.('electron')?.ipcRenderer;

// Workspace component logic
type LayoutMode = 'default' | 'code' | 'terminal' | 'preview' | 'ai' | 'custom';

// Menu configuration
const menuConfig: Record<string, { label: string; shortcut?: string; action?: string; divider?: boolean }[]> = {
  File: [
    { label: 'New File', shortcut: 'Ctrl+N', action: 'newFile' },
    { label: 'New Folder', shortcut: 'Ctrl+Shift+N', action: 'newFolder' },
    { label: 'Open File...', shortcut: 'Ctrl+O', action: 'openFile' },
    { label: 'Open Folder...', shortcut: 'Ctrl+K Ctrl+O', action: 'openFolder' },
    { divider: true, label: '' },
    { label: 'Save', shortcut: 'Ctrl+S', action: 'save' },
    { label: 'Save As...', shortcut: 'Ctrl+Shift+S', action: 'saveAs' },
    { label: 'Save All', shortcut: 'Ctrl+K S', action: 'saveAll' },
    { divider: true, label: '' },
    { label: 'Exit', shortcut: 'Alt+F4', action: 'exit' },
  ],
  Edit: [
    { label: 'Undo', shortcut: 'Ctrl+Z', action: 'undo' },
    { label: 'Redo', shortcut: 'Ctrl+Y', action: 'redo' },
    { divider: true, label: '' },
    { label: 'Cut', shortcut: 'Ctrl+X', action: 'cut' },
    { label: 'Copy', shortcut: 'Ctrl+C', action: 'copy' },
    { label: 'Paste', shortcut: 'Ctrl+V', action: 'paste' },
    { divider: true, label: '' },
    { label: 'Find', shortcut: 'Ctrl+F', action: 'find' },
    { label: 'Replace', shortcut: 'Ctrl+H', action: 'replace' },
  ],
  Selection: [
    { label: 'Select All', shortcut: 'Ctrl+A', action: 'selectAll' },
    { label: 'Expand Selection', shortcut: 'Shift+Alt+Right', action: 'expandSelection' },
    { label: 'Shrink Selection', shortcut: 'Shift+Alt+Left', action: 'shrinkSelection' },
  ],
  View: [
    { label: 'Command Palette...', shortcut: 'Ctrl+Shift+P', action: 'commandPalette' },
    { divider: true, label: '' },
    { label: 'Explorer', shortcut: 'Ctrl+Shift+E', action: 'toggleExplorer' },
    { label: 'Terminal', shortcut: 'Ctrl+`', action: 'toggleTerminal' },
    { label: 'AI Assistant', shortcut: 'Ctrl+Shift+A', action: 'toggleAI' },
    { divider: true, label: '' },
    { label: 'Full Screen', shortcut: 'F11', action: 'fullscreen' },
  ],
  Go: [
    { label: 'Go to File...', shortcut: 'Ctrl+P', action: 'goToFile' },
    { label: 'Go to Symbol...', shortcut: 'Ctrl+Shift+O', action: 'goToSymbol' },
    { label: 'Go to Line...', shortcut: 'Ctrl+G', action: 'goToLine' },
  ],
  Run: [
    { label: 'Start Debugging', shortcut: 'F5', action: 'startDebug' },
    { label: 'Run Without Debugging', shortcut: 'Ctrl+F5', action: 'runWithoutDebug' },
    { label: 'Stop', shortcut: 'Shift+F5', action: 'stop' },
    { label: 'Restart', shortcut: 'Ctrl+Shift+F5', action: 'restart' },
  ],
  Terminal: [
    { label: 'New Terminal', shortcut: 'Ctrl+Shift+`', action: 'newTerminal' },
    { label: 'Split Terminal', shortcut: 'Ctrl+Shift+5', action: 'splitTerminal' },
    { divider: true, label: '' },
    { label: 'Run Task...', action: 'runTask' },
    { label: 'Run Build Task', shortcut: 'Ctrl+Shift+B', action: 'runBuildTask' },
  ],
  Help: [
    { label: 'Welcome', action: 'welcome' },
    { label: 'Documentation', action: 'docs' },
    { label: 'Keyboard Shortcuts', shortcut: 'Ctrl+K Ctrl+S', action: 'shortcuts' },
    { divider: true, label: '' },
    { label: 'About HENU', action: 'about' },
  ],
};

export const Workspace = () => {
  const [rightPanelMode, setRightPanelMode] = useState<'preview' | 'ai' | 'git'>('ai');
  const [isRunning, setIsRunning] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState('editor');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [terminalCollapsed, setTerminalCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('default');
  const [isResizing, setIsResizing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Build Complete', message: 'Project built successfully', time: '2 min ago', unread: true },
    { id: 2, title: 'AI Suggestion', message: 'Optimization available for main.js', time: '5 min ago', unread: true },
    { id: 3, title: 'System Update', message: 'HENU v1.2 available', time: '1 hour ago', unread: false },
  ]);

  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<{ type: string; startX?: number; startY?: number; startWidth?: number; startHeight?: number }>({ type: '' });

  // Panel layout states
  const [panelLayouts, setPanelLayouts] = useState({
    sidebar: { width: 300, isResizing: false },
    terminal: { height: 250, isResizing: false },
    rightPanel: { width: 380, isResizing: false },
  });

  // Auto-adjust layout on window resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 1024) {
        setPanelLayouts(prev => ({
          ...prev,
          sidebar: { ...prev.sidebar, width: 240 },
          rightPanel: { ...prev.rightPanel, width: 320 },
        }));
      } else if (width < 1280) {
        setPanelLayouts(prev => ({
          ...prev,
          sidebar: { ...prev.sidebar, width: 280 },
          rightPanel: { ...prev.rightPanel, width: 350 },
        }));
      } else {
        setPanelLayouts(prev => ({
          ...prev,
          sidebar: { ...prev.sidebar, width: 300 },
          rightPanel: { ...prev.rightPanel, width: 380 },
        }));
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (isResizing && resizeHandleRef.current.type) {
      e.preventDefault();
      const { type, startX, startY, startWidth, startHeight } = resizeHandleRef.current;
      switch (type) {
        case 'sidebar':
          if (startX !== undefined && startWidth !== undefined) {
            const newWidth = Math.max(200, Math.min(500, startWidth + (e.clientX - startX)));
            setPanelLayouts(prev => ({ ...prev, sidebar: { ...prev.sidebar, width: newWidth } }));
          }
          break;
        case 'terminal':
          if (startY !== undefined && startHeight !== undefined) {
            const newHeight = Math.max(150, Math.min(500, startHeight - (e.clientY - startY)));
            setPanelLayouts(prev => ({ ...prev, terminal: { ...prev.terminal, height: newHeight } }));
          }
          break;
        case 'rightPanel':
          if (startX !== undefined && startWidth !== undefined) {
            const newWidth = Math.max(250, Math.min(500, startWidth - (e.clientX - startX)));
            setPanelLayouts(prev => ({ ...prev, rightPanel: { ...prev.rightPanel, width: newWidth } }));
          }
          break;
      }
    }
  };

  const startResizing = (type: string, e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeHandleRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: type === 'sidebar' ? panelLayouts.sidebar.width : type === 'rightPanel' ? panelLayouts.rightPanel.width : undefined,
      startHeight: type === 'terminal' ? panelLayouts.terminal.height : undefined,
    };
    document.body.style.cursor = type === 'terminal' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const stopResizing = () => {
    setIsResizing(false);
    resizeHandleRef.current = { type: '' };
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  };

  useEffect(() => {
    const handleMouseUp = () => stopResizing();
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseleave', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseUp);
    };
  }, []);

  // Close notifications on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showNotifications && !target.closest('.notifications-container')) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      window.addEventListener('click', handleClick);
    }
    return () => window.removeEventListener('click', handleClick);
  }, [showNotifications]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (activeMenu && !target.closest('.menu-container')) {
        setActiveMenu(null);
      }
    };
    if (activeMenu) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [activeMenu]);

  const handleLayoutChange = (mode: LayoutMode) => {
    setLayoutMode(mode);
    switch (mode) {
      case 'code':
        setPanelLayouts({ sidebar: { width: 300, isResizing: false }, terminal: { height: 0, isResizing: false }, rightPanel: { width: 0, isResizing: false } });
        setSidebarCollapsed(false);
        setTerminalCollapsed(true);
        setRightPanelCollapsed(true);
        break;
      case 'terminal':
        setPanelLayouts({ sidebar: { width: 0, isResizing: false }, terminal: { height: 500, isResizing: false }, rightPanel: { width: 0, isResizing: false } });
        setSidebarCollapsed(true);
        setTerminalCollapsed(false);
        setRightPanelCollapsed(true);
        break;
      case 'preview':
        setPanelLayouts({ sidebar: { width: 0, isResizing: false }, terminal: { height: 0, isResizing: false }, rightPanel: { width: 800, isResizing: false } });
        setRightPanelMode('preview');
        setSidebarCollapsed(true);
        setTerminalCollapsed(true);
        setRightPanelCollapsed(false);
        break;
      case 'ai':
        setPanelLayouts({ sidebar: { width: 0, isResizing: false }, terminal: { height: 0, isResizing: false }, rightPanel: { width: 500, isResizing: false } });
        setRightPanelMode('ai');
        setSidebarCollapsed(true);
        setTerminalCollapsed(true);
        setRightPanelCollapsed(false);
        break;
      default:
        setPanelLayouts({ sidebar: { width: 300, isResizing: false }, terminal: { height: 250, isResizing: false }, rightPanel: { width: 380, isResizing: false } });
        setSidebarCollapsed(false);
        setTerminalCollapsed(false);
        setRightPanelCollapsed(false);
        break;
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const clearNotifications = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };


  const handleRunCode = () => {
    setIsRunning(true);
    setTimeout(() => {
      setNotifications(prev => [{ id: Date.now(), title: 'Code Executed', message: 'Your code ran successfully with 0 errors', time: 'Just now', unread: true }, ...prev]);
    }, 1000);
    setTimeout(() => setIsRunning(false), 2000);
  };

  // Window control functions
  const handleMinimize = () => {
    if (ipcRenderer) ipcRenderer.send('window-minimize');
  };

  const handleMaximize = () => {
    if (ipcRenderer) ipcRenderer.send('window-maximize');
  };

  const handleClose = () => {
    if (ipcRenderer) ipcRenderer.send('window-close');
  };

  // Menu action handler
  const handleMenuAction = (action: string) => {
    setActiveMenu(null);
    switch (action) {
      case 'exit': handleClose(); break;
      case 'undo': document.execCommand('undo'); break;
      case 'redo': document.execCommand('redo'); break;
      case 'cut': document.execCommand('cut'); break;
      case 'copy': document.execCommand('copy'); break;
      case 'paste': document.execCommand('paste'); break;
      case 'selectAll': document.execCommand('selectAll'); break;
      case 'toggleExplorer': setSidebarCollapsed(!sidebarCollapsed); break;
      case 'toggleTerminal': setTerminalCollapsed(!terminalCollapsed); break;
      case 'toggleAI': setRightPanelCollapsed(!rightPanelCollapsed); setRightPanelMode('ai'); break;
      case 'fullscreen': toggleFullscreen(); break;
      case 'startDebug':
      case 'runWithoutDebug': handleRunCode(); break;
      case 'stop': setIsRunning(false); break;
      case 'newTerminal': setTerminalCollapsed(false); break;
      case 'about':
        setNotifications(prev => [{ id: Date.now(), title: 'About HENU', message: 'Version 2.1.0 - Built with ❤️', time: 'Just now', unread: true }, ...prev]);
        break;
      default: console.log('Menu action:', action);
    }
  };

  return (
    <div ref={containerRef} className="h-screen w-screen bg-black overflow-hidden relative select-none" onMouseMove={handleMouseMove}>
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-red-950/10 to-black"></div>

      {/* Animated Grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
          animation: 'gridMove 20s linear infinite'
        }} />
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="absolute w-px h-px bg-red-500/20 rounded-full" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${3 + Math.random() * 4}s infinite ease-in-out`,
            animationDelay: `${Math.random() * 2}s`,
            boxShadow: '0 0 20px 2px rgba(239, 68, 68, 0.3)'
          }} />
        ))}
      </div>

      <div className="relative z-10 h-full flex flex-col">
        {/* Unified Single Header Bar */}
        <div className="h-10 bg-gradient-to-r from-[#1a1a1a] via-[#1e1e1e] to-[#1a1a1a] border-b border-red-900/30 flex items-center justify-between px-2 select-none shadow-[0_0_20px_rgba(239,68,68,0.15)]">
          {/* Left Section: Logo, HENU, Menu Items, Layout Buttons */}
          <div className="flex items-center h-full space-x-3 menu-container">
            {/* Logo */}
            <div className="flex items-center space-x-2 cursor-pointer px-1">
              <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain" />
              <div className="text-red-400 font-bold tracking-wider text-sm">HENU</div>
            </div>

            {/* Separator */}
            <div className="h-4 w-px bg-white/10"></div>

            {/* Menu Items */}
            {Object.keys(menuConfig).map((menuName) => (
              <div key={menuName} className="relative">
                <div
                  className={`px-2 h-10 flex items-center text-[11px] cursor-pointer transition-colors duration-150 ${activeMenu === menuName ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                  onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === menuName ? null : menuName); }}
                  onMouseEnter={() => { if (activeMenu && activeMenu !== menuName) setActiveMenu(menuName); }}
                >
                  {menuName}
                </div>
                {activeMenu === menuName && (
                  <div className="absolute top-full left-0 mt-0 bg-[#252526] border border-white/10 rounded-md shadow-xl py-1 min-w-56 z-[9999]">
                    {menuConfig[menuName].map((item, idx) => (
                      item.divider ? (
                        <div key={idx} className="h-px bg-white/10 my-1 mx-2" />
                      ) : (
                        <div key={idx} className="px-3 py-1.5 flex items-center justify-between text-[12px] text-gray-300 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors" onClick={() => item.action && handleMenuAction(item.action)}>
                          <span>{item.label}</span>
                          {item.shortcut && <span className="text-gray-500 text-[11px] ml-8">{item.shortcut}</span>}
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Separator */}
            <div className="h-4 w-px bg-white/10"></div>

            {/* Layout Buttons */}
            <div className="flex items-center space-x-1">
              <button onClick={() => handleLayoutChange('default')} className={`px-2 py-1 text-[10px] rounded transition-all ${layoutMode === 'default' ? 'bg-red-900/40 text-red-300' : 'text-gray-400 hover:text-red-300 hover:bg-red-900/20'}`}>
                <Layout size={12} className="inline mr-1" />Default
              </button>
              <button onClick={() => handleLayoutChange('code')} className={`px-2 py-1 text-[10px] rounded transition-all ${layoutMode === 'code' ? 'bg-red-900/40 text-red-300' : 'text-gray-400 hover:text-red-300 hover:bg-red-900/20'}`}>
                <Split size={12} className="inline mr-1" />Code
              </button>
              <button onClick={() => handleLayoutChange('terminal')} className={`px-2 py-1 text-[10px] rounded transition-all ${layoutMode === 'terminal' ? 'bg-red-900/40 text-red-300' : 'text-gray-400 hover:text-red-300 hover:bg-red-900/20'}`}>
                <Grid3x3 size={12} className="inline mr-1" />Terminal
              </button>
            </div>
          </div>

          {/* Middle: Window Title */}
          <div className="flex-1 text-center text-gray-500 text-[11px] font-medium truncate px-4">
            {/* Folder path removed - now displayed in code editor */}
          </div>

          {/* Right Section: Control Buttons and Window Controls */}
          <div className="flex items-center h-full space-x-2">
            {/* Control Buttons */}
            <div className="flex items-center space-x-0.5 bg-black/40 rounded-lg p-0.5 border border-red-900/20">
              <button onClick={handleRunCode} className={`p-1.5 rounded transition-all ${isRunning ? 'bg-yellow-900/30 text-yellow-300' : 'hover:bg-red-900/30 text-red-400 hover:text-red-300'}`} title={isRunning ? 'Stop' : 'Run'}>
                {isRunning ? <Square size={13} className="animate-pulse" /> : <Play size={13} />}
              </button>
              <button onClick={() => handleLayoutChange('ai')} className="p-1.5 hover:bg-purple-900/30 rounded transition-all text-purple-400 hover:text-purple-300" title="AI Assistant">
                <Zap size={13} />
              </button>
              <button
                onClick={() => setRightPanelMode(rightPanelMode === 'preview' ? 'ai' : 'preview')}
                className={`p-1.5 rounded transition-all ${rightPanelMode === 'preview' ? 'bg-red-900/40 text-red-300' : 'text-red-400 hover:bg-red-900/30'
                  }`}
                title="Toggle Preview"
              >
                <Eye size={13} />
              </button>
              <button
                onClick={() => {
                  setRightPanelMode('git');
                  setRightPanelCollapsed(false);
                }}
                className={`p-1.5 rounded transition-all ${rightPanelMode === 'git' ? 'bg-red-900/40 text-red-300' : 'text-red-400 hover:bg-red-900/30'
                  }`}
                title="Git Panel"
              >
                <GitBranch size={13} />
              </button>
              <div className="relative notifications-container">
                <button onClick={() => setShowNotifications(!showNotifications)} className="p-1.5 hover:bg-red-900/30 rounded transition-all text-red-400 hover:text-red-300 relative" title="Notifications">
                  <Bell size={13} />
                  {notifications.filter(n => n.unread).length > 0 && (
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-600 rounded-full flex items-center justify-center text-[8px]">{notifications.filter(n => n.unread).length}</div>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-96 bg-gray-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-red-900/30 py-2 z-[9999]">
                    <div className="px-4 py-3 border-b border-red-900/20 flex justify-between items-center">
                      <h3 className="text-red-400 font-bold">Notifications</h3>
                      <button onClick={clearNotifications} className="text-xs text-gray-500 hover:text-gray-300">Mark all read</button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map(notification => (
                        <div key={notification.id} className={`px-4 py-3 hover:bg-red-900/10 transition-colors ${notification.unread ? 'bg-red-900/5' : ''}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-gray-200">{notification.title}</div>
                              <div className="text-sm text-gray-400 mt-1">{notification.message}</div>
                            </div>
                            <div className="text-xs text-gray-500">{notification.time}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={toggleFullscreen} className="p-1.5 hover:bg-red-900/30 rounded transition-all text-red-400 hover:text-red-300" title="Fullscreen">
                <Maximize2 size={13} />
              </button>
              <button onClick={() => handleLayoutChange('default')} className="p-1.5 hover:bg-red-900/30 rounded transition-all text-red-400 hover:text-red-300" title="Reset Layout">
                <RotateCcw size={13} />
              </button>
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-white/10"></div>

            {/* Window Controls */}
            <div className="flex items-center h-full">
              <div className="w-10 h-full flex items-center justify-center text-gray-400 hover:bg-white/10 cursor-pointer transition-colors" onClick={handleMinimize} title="Minimize">
                <Minus size={14} />
              </div>
              <div className="w-10 h-full flex items-center justify-center text-gray-400 hover:bg-white/10 cursor-pointer transition-colors" onClick={handleMaximize} title="Maximize">
                <Square size={10} strokeWidth={1.5} />
              </div>
              <div className="w-10 h-full flex items-center justify-center text-gray-400 hover:bg-red-600 hover:text-white cursor-pointer transition-colors" onClick={handleClose} title="Close">
                <X size={14} />
              </div>
            </div>
          </div>
        </div>

        {/* Main Workspace Area */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Sidebar */}
          {!sidebarCollapsed && (
            <>
              <div ref={sidebarRef} className="border-r border-red-900/20 overflow-hidden hover-lift transition-all duration-300" style={{ width: `${panelLayouts.sidebar.width}px` }}>
                <Panel title="FILE SYSTEM" className="h-full rounded-none" onCollapse={() => setSidebarCollapsed(true)}>
                  <FileExplorer />
                </Panel>
              </div>
              <div className="w-1 cursor-col-resize hover:bg-red-500/50 active:bg-red-500 transition-colors" onMouseDown={(e) => startResizing('sidebar', e)} />
            </>
          )}

          {sidebarCollapsed && (
            <div className="absolute left-2 top-1/2 transform -translate-y-1/2 z-20">
              <button onClick={() => setSidebarCollapsed(false)} className="p-2 bg-black/80 backdrop-blur-sm border border-red-900/30 rounded-r-lg hover:bg-red-900/30 transition-all hover:translate-x-1">
                <ChevronRight size={20} className="text-red-400" />
              </button>
            </div>
          )}

          {/* Middle Area - Code Editor & Terminal */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 border-b border-red-900/20 overflow-hidden hover-lift transition-all duration-300" style={{ height: terminalCollapsed ? '100%' : `calc(100% - ${panelLayouts.terminal.height}px - 8px)`, opacity: terminalCollapsed ? 1 : 0.98 }}>
              <Panel
                title="CODE EDITOR"
                className="h-full rounded-none"
                isActive={activeTab === 'editor'}
                onClick={() => setActiveTab('editor')}
                centerContent={
                  <div className="text-xs text-gray-400 font-mono flex items-center space-x-2">
                    <span className="text-red-400">📁</span>
                    <span>siddarth2-main\siddarth2-main</span>
                  </div>
                }
              >
                <CodeEditor />
              </Panel>
            </div>

            {!terminalCollapsed && (
              <>
                <div className="h-1 cursor-row-resize hover:bg-red-500/50 active:bg-red-500 transition-colors" onMouseDown={(e) => startResizing('terminal', e)} />
                <div ref={terminalRef} className="border-t border-red-900/20 overflow-hidden hover-lift transition-all duration-300" style={{ height: `${panelLayouts.terminal.height}px` }}>
                  <Panel title="TERMINAL" className="h-full rounded-none" onCollapse={() => setTerminalCollapsed(true)} isActive={activeTab === 'terminal'} onClick={() => setActiveTab('terminal')}>
                    <Terminal />
                  </Panel>
                </div>
              </>
            )}

            {terminalCollapsed && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-20">
                <button onClick={() => setTerminalCollapsed(false)} className="p-2 bg-black/80 backdrop-blur-sm border border-red-900/30 rounded-t-lg hover:bg-red-900/30 transition-all hover:-translate-y-1">
                  <ChevronLeft size={20} className="text-red-400 rotate-90" />
                </button>
              </div>
            )}
          </div>

          {/* Right Panel */}
          {!rightPanelCollapsed && (
            <>
              <div className="w-1 cursor-col-resize hover:bg-red-500/50 active:bg-red-500 transition-colors" onMouseDown={(e) => startResizing('rightPanel', e)} />
              <div ref={rightPanelRef} className="border-l border-red-900/20 overflow-hidden hover-lift transition-all duration-300" style={{ width: `${panelLayouts.rightPanel.width}px` }}>
                <Panel
                  title={
                    rightPanelMode === 'preview' ? "LIVE PREVIEW" :
                      rightPanelMode === 'git' ? "GIT" :
                        "AI AGENT"
                  }
                  className="h-full rounded-none"
                  onCollapse={() => setRightPanelCollapsed(true)}
                >
                  {rightPanelMode === 'preview' ? <Preview /> :
                    rightPanelMode === 'git' ? <GitPanel /> :
                      <AIAgent />}
                </Panel>
              </div>
            </>
          )}

          {rightPanelCollapsed && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 z-20">
              <button onClick={() => setRightPanelCollapsed(false)} className="p-2 bg-black/80 backdrop-blur-sm border border-red-900/30 rounded-l-lg hover:bg-red-900/30 transition-all hover:-translate-x-1">
                <ChevronLeft size={20} className="text-red-400" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Status Bar */}
        <div className="px-4 py-2 bg-black/60 backdrop-blur-md border-t border-red-900/30 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-4">
            <div className="text-gray-400 font-mono"><span className="text-red-400">Mode:</span> {layoutMode.toUpperCase()}</div>
            <div className="text-gray-400 font-mono"><span className="text-green-400">Panel:</span> {!sidebarCollapsed ? '📁' : '❌'} {!terminalCollapsed ? '💻' : '❌'} {!rightPanelCollapsed ? (rightPanelMode === 'preview' ? '👁️' : rightPanelMode === 'git' ? '🔀' : '🤖') : '❌'}</div>
            <div className="text-gray-400 font-mono"><span className="text-blue-400">Cursor:</span> {mousePos.x}, {mousePos.y}</div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
              </div>
              <span className="text-gray-500">System Normal</span>
            </div>
            <div className="h-4 w-px bg-red-900/30"></div>
            <div className="flex items-center space-x-1">
              <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full" style={{ width: '75%' }}></div>
              </div>
              <span className="text-gray-500">75% CPU</span>
            </div>
          </div>
        </div>
      </div>

      <StatusHUD />

      <style>{`
        .hover-lift { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .hover-lift:hover { box-shadow: 0 20px 40px rgba(239, 68, 68, 0.15), 0 0 30px rgba(239, 68, 68, 0.1); transform: translateY(-2px); }
        .control-bar { position: relative; backdrop-filter: blur(20px); }
        .control-bar::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.5), transparent); animation: scan-line 3s linear infinite; }
        @keyframes scan-line { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes float { 0%, 100% { transform: translateY(0) translateX(0); } 50% { transform: translateY(-20px) translateX(10px); } }
        @keyframes gridMove { 0% { transform: translateX(0) translateY(0); } 100% { transform: translateX(50px) translateY(50px); } }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.3); border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(239, 68, 68, 0.5); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(239, 68, 68, 0.7); }
      `}</style>
    </div>
  );
};