import { useEffect, useState, useRef, useCallback } from 'react';
import { useOS, FileSystemNode } from '../context/OSContext';
import { codeRunner, ExecutionResult } from '../services/CodeRunner';
import { TabBar } from './TabBar';
import {
  Code2, Save, Search, FileText,
  Eye, EyeOff, Type,
  Play, Square, Terminal,
  Loader, AlertCircle
} from 'lucide-react';

export const CodeEditor = () => {
  const { state, updateFileContent, addTerminalCommand, openTab, closeTab } = useOS();
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState(''); // Track original content for dirty state
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set());
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [isDirty, setIsDirty] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [theme, setTheme] = useState<'dark' | 'light' | 'oled'>('dark');
  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [showOutput, setShowOutput] = useState(false);
  const [isLoadingPython, setIsLoadingPython] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const currentFile = state.activeFile;

  // Initialize code runner
  useEffect(() => {
    codeRunner.init();
    return () => codeRunner.cleanup();
  }, []);

  useEffect(() => {
    if (currentFile && currentFile.type === 'file') {
      const fileContent = currentFile.content || '';
      setContent(fileContent);
      setOriginalContent(fileContent); // Track original for dirty detection
      setIsDirty(false);
      setWordCount(countWords(fileContent));
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    } else {
      setContent('');
      setOriginalContent('');
      setIsDirty(false);
      setWordCount(0);
      setOutput('');
      setShowOutput(false);
    }
  }, [currentFile?.id]);

  useEffect(() => {
    if (showOutput && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, showOutput]);

  // Track dirty state for tabs
  useEffect(() => {
    if (currentFile && content !== originalContent) {
      setDirtyTabs(prev => new Set(prev).add(currentFile.id));
      setIsDirty(true);
    } else if (currentFile) {
      setDirtyTabs(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentFile.id);
        return newSet;
      });
      setIsDirty(false);
    }
  }, [content, originalContent, currentFile]);

  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Tab - Next tab
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const currentIndex = state.openTabs.findIndex(tab => tab.id === currentFile?.id);
        if (currentIndex !== -1 && state.openTabs.length > 1) {
          const nextIndex = (currentIndex + 1) % state.openTabs.length;
          openTab(state.openTabs[nextIndex]);
        }
      }
      // Ctrl+Shift+Tab - Previous tab
      else if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = state.openTabs.findIndex(tab => tab.id === currentFile?.id);
        if (currentIndex !== -1 && state.openTabs.length > 1) {
          const nextIndex = currentIndex === 0 ? state.openTabs.length - 1 : currentIndex - 1;
          openTab(state.openTabs[nextIndex]);
        }
      }
      // Ctrl+W - Close current tab
      else if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (currentFile) {
          handleTabClose(currentFile, e as any);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.openTabs, currentFile, openTab]);

  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setWordCount(countWords(newContent));

    if (currentFile && currentFile.content !== newContent) {
      setIsDirty(true);
    } else {
      setIsDirty(false);
    }
  };

  const handleSave = () => {
    if (currentFile) {
      updateFileContent(currentFile.id, content);
      setOriginalContent(content); // Update original content
      setIsDirty(false);

      // Remove from dirty tabs
      setDirtyTabs(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentFile.id);
        return newSet;
      });

      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-green-900 text-green-300 px-3 py-2 rounded text-sm z-50';
      toast.textContent = `Saved: ${currentFile.name}`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    }
  };

  // Tab management handlers
  const handleTabClick = (file: FileSystemNode) => {
    openTab(file);
  };

  const handleTabClose = (file: FileSystemNode, e: React.MouseEvent) => {
    e.stopPropagation();

    // Check if file has unsaved changes
    if (dirtyTabs.has(file.id)) {
      const confirmClose = window.confirm(
        `"${file.name}" has unsaved changes. Close anyway?`
      );
      if (!confirmClose) return;
    }

    closeTab(file.id);

    // Remove from dirty tabs
    setDirtyTabs(prev => {
      const newSet = new Set(prev);
      newSet.delete(file.id);
      return newSet;
    });
  };

  // Real code execution
  const handleRunCode = useCallback(async () => {
    if (!currentFile?.content) return;

    setIsRunning(true);
    setShowOutput(true);

    const ext = getFileExtension(currentFile.name);
    let result: ExecutionResult | undefined;

    try {
      switch (ext) {
        case 'html':
          result = await codeRunner.runHTML(content);
          break;
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
          result = await codeRunner.runJavaScript(content);
          break;
        case 'py':
          // Load Pyodide if not loaded
          if (!(window as any).pyodide) {
            setIsLoadingPython(true);
            setOutput('Loading Python runtime (Pyodide)... This may take a moment.');

            const loaded = await codeRunner.loadPyodide();
            setIsLoadingPython(false);

            if (!loaded) {
              result = {
                success: false,
                output: 'Failed to load Python runtime. Please check your internet connection.',
                executionTime: 0
              };
              break;
            }
          }
          result = await codeRunner.runPython(content);
          break;
        case 'css':
          // For CSS, create HTML preview
          const cssHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>${content}</style>
            </head>
            <body>
              <h1>CSS Preview</h1>
              <div class="demo" style="padding: 20px; margin: 20px; border: 2px dashed #ccc;">
                <p>This is a preview of your CSS.</p>
                <button class="demo-btn">Demo Button</button>
              </div>
              <p>CSS applied successfully.</p>
            </body>
            </html>
          `;
          result = await codeRunner.runHTML(cssHtml);
          break;
        case 'json':
          try {
            JSON.parse(content);
            result = {
              success: true,
              output: '✅ JSON is valid',
              executionTime: 0
            };
          } catch (error: any) {
            result = {
              success: false,
              output: `❌ Invalid JSON: ${error.message}`,
              error: error.message,
              executionTime: 0
            };
          }
          break;
        default:
          result = {
            success: false,
            output: `❌ Cannot execute .${ext} files directly\nUse the terminal for execution.`,
            executionTime: 0
          };
      }

      if (!result) {
        setOutput(prev => `❌ Execution failed: No result returned\n${'─'.repeat(60)}\n${prev}`);
        setIsRunning(false);
        setIsLoadingPython(false);
        return;
      }

      setOutput(prev => {
        const timestamp = new Date().toLocaleTimeString();
        const timeInfo = result.executionTime > 0
          ? `\n⏱️ Execution time: ${result.executionTime.toFixed(2)}ms`
          : '';

        return `[${timestamp}] ${result.output}${timeInfo}\n${'─'.repeat(60)}\n${prev}`;
      });

      // Add to terminal history
      addTerminalCommand(`run ${currentFile.name}`, result.output);

      // Show success toast
      const toastType = result.success ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300';
      const toast = document.createElement('div');
      toast.className = `fixed top-4 right-4 ${toastType} px-3 py-2 rounded text-sm z-50`;
      toast.textContent = result.success ? 'Code executed successfully' : 'Execution failed';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);

    } catch (error: any) {
      setOutput(prev => `❌ Fatal Error: ${error.message}\n${error.stack || ''}\n${'─'.repeat(60)}\n${prev}`);

      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-red-900 text-red-300 px-3 py-2 rounded text-sm z-50';
      toast.textContent = `Execution error: ${error.message}`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } finally {
      setIsRunning(false);
      setIsLoadingPython(false);
    }
  }, [content, currentFile, addTerminalCommand]);

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || 'txt';
  };

  const handleSelectionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;

    const beforeCursor = text.substring(0, cursorPos);
    const lines = beforeCursor.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;

    setCursorLine(line);
    setCursorCol(col);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      setShowSearch(true);
      setTimeout(() => {
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
        searchInput?.focus();
      }, 0);
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      handleRunCode();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      setShowOutput(!showOutput);
    }

    if (e.key === 'Escape' && showSearch) {
      setShowSearch(false);
    }
  };

  const handleFormatCode = () => {
    if (!currentFile) return;

    const ext = getFileExtension(currentFile.name);
    let formatted = content;

    try {
      switch (ext) {
        case 'json':
          formatted = JSON.stringify(JSON.parse(content), null, 2);
          break;
        case 'html':
          // Simple HTML formatting
          formatted = content
            .replace(/>\s*</g, '>\n<')
            .replace(/</g, '\n<')
            .replace(/>/g, '>\n')
            .split('\n')
            .filter(line => line.trim())
            .map((line, i, arr) => {
              const trimmed = line.trim();
              if (trimmed.startsWith('</')) {
                return '  '.repeat(Math.max(0, arr.slice(0, i).filter(l => l.includes('<')).length - 1)) + trimmed;
              }
              return '  '.repeat(arr.slice(0, i).filter(l => l.includes('<')).length) + trimmed;
            })
            .join('\n');
          break;
        case 'js':
        case 'ts':
        case 'jsx':
        case 'tsx':
          // Basic JavaScript formatting
          formatted = content
            .replace(/\{/g, ' {\n')
            .replace(/\}/g, '\n}')
            .replace(/;/g, ';\n')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map(line => '  ' + line)
            .join('\n');
          break;
        case 'css':
          formatted = content
            .replace(/\{/g, ' {\n  ')
            .replace(/\}/g, '\n}\n')
            .replace(/;/g, ';\n')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .join('\n');
          break;
        case 'py':
          formatted = content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map(line => '  ' + line)
            .join('\n');
          break;
      }

      setContent(formatted);
      setIsDirty(true);
    } catch (error) {
      console.error('Formatting error:', error);
    }
  };

  const getFileIcon = () => {
    if (!currentFile) return '📄';

    const ext = getFileExtension(currentFile.name);
    switch (ext) {
      case 'html': return '🌐';
      case 'css': return '🎨';
      case 'js': return '⚡';
      case 'ts': return '🔷';
      case 'jsx': return '⚛️';
      case 'tsx': return '🦊';
      case 'json': return '{}';
      case 'py': return '🐍';
      case 'java': return '☕';
      case 'cpp': case 'c': return '🔧';
      case 'php': return '🐘';
      case 'rb': return '💎';
      case 'go': return '🐹';
      case 'rs': return '🦀';
      case 'md': return '📝';
      case 'sql': return '🗃️';
      default: return '📄';
    }
  };

  const getLanguageName = () => {
    if (!currentFile) return 'Plain Text';

    const ext = getFileExtension(currentFile.name);
    switch (ext) {
      case 'js': return 'JavaScript';
      case 'ts': return 'TypeScript';
      case 'jsx': return 'React JSX';
      case 'tsx': return 'React TSX';
      case 'html': return 'HTML';
      case 'css': return 'CSS';
      case 'json': return 'JSON';
      case 'py': return 'Python';
      case 'java': return 'Java';
      case 'cpp': return 'C++';
      case 'c': return 'C';
      case 'php': return 'PHP';
      case 'rb': return 'Ruby';
      case 'go': return 'Go';
      case 'rs': return 'Rust';
      case 'md': return 'Markdown';
      case 'sql': return 'SQL';
      case 'txt': return 'Text';
      default: return ext.toUpperCase();
    }
  };

  const getRunTooltip = () => {
    if (!currentFile) return 'Run Code';

    const ext = getFileExtension(currentFile.name);
    switch (ext) {
      case 'html': return 'Open HTML in new tab';
      case 'js': case 'ts': case 'jsx': case 'tsx': return 'Run JavaScript';
      case 'py': return 'Run Python (requires Pyodide)';
      case 'css': return 'Preview CSS';
      case 'json': return 'Validate JSON';
      default: return 'Execute File';
    }
  };

  const handleClearOutput = () => {
    setOutput('');
  };

  const handleCopyOutput = () => {
    navigator.clipboard.writeText(output);

    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-blue-900 text-blue-300 px-3 py-2 rounded text-sm z-50';
    toast.textContent = 'Output copied to clipboard';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  if (!currentFile || currentFile.type !== 'file') {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-b from-gray-900/90 to-black/90">
        <div className="text-center text-gray-500">
          <Code2 size={64} className="mx-auto mb-4 opacity-20 animate-pulse" />
          <div className="font-mono text-lg mb-2">No File Selected</div>
          <div className="text-sm text-gray-600 max-w-md mx-auto">
            Click on a file in the File Explorer to start editing
          </div>
        </div>
      </div>
    );
  }

  const lines = content.split('\n');
  const totalLines = lines.length;
  const fileExt = getFileExtension(currentFile.name);

  return (
    <div
      className="h-full flex flex-col bg-gray-950"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Tab Bar */}
      <TabBar
        tabs={state.openTabs}
        activeTabId={currentFile?.id || null}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        dirtyTabs={dirtyTabs}
      />

      {/* Editor Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-900/90 backdrop-blur-sm">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className={`w-2 h-2 rounded-full ${isDirty ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
          <span className="text-2xl">{getFileIcon()}</span>
          <div className="flex-1 min-w-0">
            <div className="text-gray-300 text-sm font-mono truncate flex items-center space-x-2">
              <span>{currentFile.name}</span>
              {isDirty && <span className="text-yellow-500 text-xs">●</span>}
              <span className="text-gray-600 text-xs">({getLanguageName()})</span>
            </div>
            <div className="text-gray-600 text-xs font-mono mt-0.5 truncate">
              {currentFile.path || `/${currentFile.name}`}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {showSearch && (
            <div className="flex items-center space-x-2 bg-gray-800 px-2 py-1 rounded">
              <Search size={14} className="text-gray-400" />
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search..."
                className="bg-transparent text-sm text-gray-300 focus:outline-none w-32"
                autoFocus
              />
              <button
                onClick={() => setShowSearch(false)}
                className="text-gray-500 hover:text-gray-300"
              >
                ✕
              </button>
            </div>
          )}

          <button
            onClick={() => setShowSearch(true)}
            className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-300 transition-colors"
            title="Search (Ctrl+F)"
          >
            <Search size={16} />
          </button>

          <button
            onClick={handleFormatCode}
            className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-300 transition-colors"
            title="Format Code"
          >
            <Type size={16} />
          </button>

          <button
            onClick={handleRunCode}
            disabled={isRunning || isLoadingPython}
            className={`p-2 rounded transition-colors flex items-center space-x-1 ${isRunning || isLoadingPython
              ? 'bg-yellow-900/40 text-yellow-300'
              : 'bg-green-900/40 hover:bg-green-800/40 text-green-300 hover:text-green-200'
              }`}
            title={`${getRunTooltip()} (Ctrl+R)`}
          >
            {isRunning || isLoadingPython ? (
              <>
                <Loader size={16} className="animate-spin" />
                <span className="text-xs hidden sm:inline">
                  {isLoadingPython ? 'Loading Python...' : 'Running...'}
                </span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span className="text-xs hidden sm:inline">Run</span>
              </>
            )}
          </button>

          <button
            onClick={() => setShowOutput(!showOutput)}
            className={`p-2 rounded transition-colors ${showOutput
              ? 'bg-blue-900/40 text-blue-300'
              : 'hover:bg-gray-800 text-gray-400 hover:text-gray-300'
              }`}
            title="Toggle Output (Ctrl+E)"
          >
            <Terminal size={16} />
          </button>

          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="p-2 bg-blue-900/40 hover:bg-blue-800/40 rounded text-blue-300 hover:text-blue-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center space-x-1"
            title="Save (Ctrl+S)"
          >
            <Save size={16} />
            <span className="text-xs hidden sm:inline">Save</span>
          </button>
        </div>
      </div>

      {/* Editor Toolbar */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between bg-gray-900/80 text-xs">
        <div className="flex items-center space-x-4">
          <div className="text-gray-400">
            <span className="text-green-400 font-mono">{cursorLine}:{cursorCol}</span>
          </div>
          <div className="text-gray-400">
            <span className="text-purple-400 font-mono">{totalLines} lines</span>
          </div>
          <div className="text-gray-400">
            <span className="text-blue-400 font-mono">{wordCount} words</span>
          </div>
          <div className="text-gray-400">
            <span className="text-yellow-400 font-mono">{content.length} chars</span>
          </div>
          <div className="text-gray-400">
            <span className="text-cyan-400 font-mono">.{fileExt}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-300"
          >
            {showLineNumbers ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
          >
            <option value={12}>12px</option>
            <option value={14}>14px</option>
            <option value={16}>16px</option>
            <option value={18}>18px</option>
            <option value={20}>20px</option>
          </select>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as any)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="oled">OLED</option>
          </select>
        </div>
      </div>

      {/* Editor and Output Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative overflow-hidden" ref={editorRef}>
          {/* Line Numbers */}
          {showLineNumbers && (
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gray-900/50 border-r border-gray-800 overflow-y-auto">
              <div className="py-4">
                {lines.map((_, i) => (
                  <div
                    key={i}
                    className={`text-right pr-3 text-xs font-mono h-6 flex items-center justify-end ${i + 1 === cursorLine
                      ? 'text-green-400 bg-green-900/20 font-bold'
                      : 'text-gray-600'
                      }`}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Text Editor */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onSelect={handleSelectionChange}
            className={`absolute inset-0 w-full h-full bg-transparent text-gray-300 font-mono focus:outline-none resize-none p-4 ${showLineNumbers ? 'pl-16' : 'pl-4'
              } ${theme === 'oled' ? 'bg-black' : theme === 'light' ? 'bg-white text-gray-900' : ''}`}
            style={{
              caretColor: '#10b981',
              lineHeight: '1.6',
              tabSize: 2,
              fontSize: `${fontSize}px`,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace"
            }}
            spellCheck={false}
            placeholder="Start typing here..."
          />

          {/* Highlight current line */}
          {cursorLine > 0 && (
            <div
              className="absolute left-0 right-0 bg-green-900/10 border-l-2 border-green-500"
              style={{
                top: `${(cursorLine - 1) * 1.6 * fontSize}px`,
                height: `${1.6 * fontSize}px`,
                left: showLineNumbers ? '48px' : '0'
              }}
            ></div>
          )}
        </div>

        {/* Output Panel */}
        {showOutput && (
          <div className={`border-t border-gray-800 ${showOutput ? 'h-64' : 'h-0'} transition-all duration-300`}>
            <div className="px-4 py-2 bg-gray-900/80 text-xs text-gray-400 font-mono flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Terminal size={12} />
                <span>Output</span>
                {fileExt === 'py' && !(window as any).pyodide && (
                  <div className="flex items-center space-x-1 text-yellow-400">
                    <AlertCircle size={10} />
                    <span>Python runtime not loaded</span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyOutput}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center space-x-1"
                  title="Copy Output"
                >
                  <FileText size={10} />
                  <span>Copy</span>
                </button>
                <button
                  onClick={handleClearOutput}
                  className="text-xs text-gray-500 hover:text-gray-300 flex items-center space-x-1"
                  title="Clear Output"
                >
                  <Square size={10} />
                  <span>Clear</span>
                </button>
                <button
                  onClick={() => setShowOutput(false)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                  title="Close Output"
                >
                  ✕
                </button>
              </div>
            </div>
            <div
              ref={outputRef}
              className="p-4 text-sm font-mono text-gray-300 whitespace-pre overflow-auto bg-black/80 h-full"
            >
              {output || (
                <div className="text-gray-600">
                  <div className="mb-4">Output will appear here after running the code.</div>
                  <div className="text-xs space-y-1">
                    <div>✓ Click <span className="text-green-400">Run</span> or press <kbd className="px-1 bg-gray-800 rounded">Ctrl+R</kbd></div>
                    <div>✓ For HTML files, a new tab will open</div>
                    <div>✓ For Python, Pyodide will be loaded automatically</div>
                    <div>✓ For JavaScript, code runs in sandboxed environment</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 border-t border-gray-800 flex items-center justify-between text-xs font-mono bg-gray-900/90">
        <div className="flex items-center space-x-4">
          <div className="text-gray-600">
            <span className="text-green-400">Ln {cursorLine}</span>,
            <span className="text-green-400"> Col {cursorCol}</span>
          </div>
          <div className="text-gray-600">
            <span className="text-blue-400">{totalLines} lines</span>
          </div>
          <div className="text-gray-600">
            <span className="text-purple-400">{content.length} chars</span>
          </div>
          {searchText && (
            <div className="text-gray-600">
              <span className="text-yellow-400">
                {content.toLowerCase().split(searchText.toLowerCase()).length - 1} matches
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2 text-gray-600">
          <div className="flex items-center space-x-1">
            <div className={`px-2 py-0.5 rounded ${isRunning ? 'bg-yellow-900/40 text-yellow-400' : 'bg-gray-800'}`}>
              {isRunning ? '▶ Running...' : 'Ready'}
            </div>
          </div>
          <div className="hidden sm:block">
            <span className="text-green-400">UTF-8</span>
            <span className="mx-1">•</span>
            <span className="text-blue-400">UNIX (LF)</span>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="px-4 py-1 border-t border-gray-800 text-xs text-gray-600 bg-gray-900/90 hidden md:flex items-center space-x-4">
        <div><span className="text-gray-400">Ctrl+S</span> Save</div>
        <div><span className="text-gray-400">Ctrl+F</span> Find</div>
        <div><span className="text-gray-400">Ctrl+R</span> Run</div>
        <div><span className="text-gray-400">Ctrl+E</span> Toggle Output</div>
        <div><span className="text-gray-400">Ctrl+Z</span> Undo</div>
        <div><span className="text-gray-400">Ctrl+Y</span> Redo</div>
      </div>
    </div>
  );
};