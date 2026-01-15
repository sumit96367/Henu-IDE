import { useState, useRef, useEffect, useCallback } from 'react';
import { useOS } from '../context/OSContext';
import {
  Play, Square, RotateCcw, Eye, Maximize2, Smartphone, Tablet,
  Monitor, Play as PlayIcon, RefreshCw, ZoomIn, ZoomOut,
  RotateCw, RotateCcw as RotateCcwIcon, Download, Upload,
  Code, EyeOff, Type, Layers, Smartphone as MobileIcon,
  Tablet as TabletIcon, Monitor as LaptopIcon, Monitor as DesktopIcon,
  Maximize2 as FullscreenIcon, Minus, Plus, Settings,
  Wifi, Battery, Clock, Signal, MoreVertical,
  AlertCircle, CheckCircle, XCircle, Loader2,
  Smartphone as PhoneCall, Smartphone as PhoneOff,
  Volume2, VolumeX, WifiOff
} from 'lucide-react';

type DeviceMode = 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'fullscreen';
type DeviceOrientation = 'portrait' | 'landscape';
type PreviewMode = 'live' | 'static' | 'responsive';
type Theme = 'light' | 'dark' | 'system';

const deviceSizes = {
  mobile: {
    portrait: { width: 360, height: 780 },
    landscape: { width: 780, height: 360 },
    label: 'iPhone 14 Pro',
    bezel: 12,
    notch: true,
    statusBar: true
  },
  tablet: {
    portrait: { width: 820, height: 1180 },
    landscape: { width: 1180, height: 820 },
    label: 'iPad Air',
    bezel: 20,
    notch: false,
    statusBar: true
  },
  laptop: {
    portrait: { width: 1440, height: 900 },
    landscape: { width: 1440, height: 900 },
    label: 'MacBook Pro 14"',
    bezel: 15,
    notch: true,
    statusBar: false
  },
  desktop: {
    portrait: { width: 1920, height: 1080 },
    landscape: { width: 1920, height: 1080 },
    label: 'Desktop HD',
    bezel: 1,
    notch: false,
    statusBar: false
  },
  fullscreen: {
    portrait: { width: '100%', height: '100%' },
    landscape: { width: '100%', height: '100%' },
    label: 'Fullscreen',
    bezel: 0,
    notch: false,
    statusBar: false
  },
};

export const Preview = ({ isFullscreen = false }: { isFullscreen?: boolean }) => {
  const { state, vfs } = useOS();
  const [isRunning, setIsRunning] = useState(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [orientation, setOrientation] = useState<DeviceOrientation>('landscape');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('live');
  const [theme, setTheme] = useState<Theme>('system');
  const [zoom, setZoom] = useState(100);
  const [html, setHtml] = useState('');
  const [css, setCss] = useState('');
  const [js, setJs] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [networkRequests, setNetworkRequests] = useState<any[]>([]);
  const [deviceFrame, setDeviceFrame] = useState(true);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [deviceTime, setDeviceTime] = useState(new Date());
  const [deviceBattery, setDeviceBattery] = useState(85);
  const [deviceSignal, setDeviceSignal] = useState(4);
  const [deviceWifi, setDeviceWifi] = useState(true);
  const [deviceVolume, setDeviceVolume] = useState(70);
  const [interactionHistory, setInteractionHistory] = useState<string[]>([]);
  const [screenshotHistory, setScreenshotHistory] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const recordIntervalRef = useRef<NodeJS.Timeout>();
  const deviceTimeIntervalRef = useRef<NodeJS.Timeout>();

  // Initialize device time
  useEffect(() => {
    deviceTimeIntervalRef.current = setInterval(() => {
      setDeviceTime(new Date());
    }, 1000);

    return () => {
      if (deviceTimeIntervalRef.current) {
        clearInterval(deviceTimeIntervalRef.current);
      }
    };
  }, []);

  // Load project files
  useEffect(() => {
    const loadProjectFiles = () => {
      const htmlFile = state.fileSystem.find(f => f.name === 'index.html' || f.name.endsWith('.html'));
      const cssFile = state.fileSystem.find(f => f.name === 'style.css' || f.name.endsWith('.css'));
      const jsFile = state.fileSystem.find(f => f.name === 'script.js' || f.name.endsWith('.js'));

      if (htmlFile) {
        setHtml(htmlFile.content || '');
      } else {
        setHtml(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HENU Preview</title>
    <style>
        ${css || ''}
    </style>
</head>
<body>
    <div style="padding: 2rem; font-family: system-ui, -apple-system, sans-serif;">
        <h1>🎨 Welcome to HENU Preview</h1>
        <p>Create HTML, CSS, and JS files to see your project here!</p>
        <div style="margin-top: 2rem; padding: 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px;">
            <h3>💡 Quick Start</h3>
            <ul>
                <li>Create <code>index.html</code> file</li>
                <li>Add <code>style.css</code> for styling</li>
                <li>Include <code>script.js</code> for interactivity</li>
            </ul>
        </div>
    </div>
    <script>
        ${js || ''}
    </script>
</body>
</html>`);
      }

      if (cssFile) {
        setCss(cssFile.content || '');
      }

      if (jsFile) {
        setJs(jsFile.content || '');
      }
    };

    loadProjectFiles();
  }, [state.fileSystem]);

  // Update iframe content
  useEffect(() => {
    if (isRunning && iframeRef.current) {
      setLoading(true);
      setError(null);

      const combinedHtml = `
        <!DOCTYPE html>
        <html lang="en" class="${theme} ${wireframeMode ? 'wireframe' : ''} ${showGrid ? 'grid-overlay' : ''}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Preview - HENU</title>
            <style>
                ${css}
                ${wireframeMode ? `
                    * { outline: 1px solid rgba(255, 0, 0, 0.1) !important; }
                    div, section, article, header, footer, main, nav, aside { background: rgba(0, 100, 255, 0.03) !important; }
                ` : ''}
                ${showGrid ? `
                    body::before {
                        content: '';
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-image: 
                            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
                        background-size: 20px 20px;
                        pointer-events: none;
                        z-index: 9999;
                    }
                ` : ''}
                body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
                .system { color-scheme: normal; }
                .light { color-scheme: light; }
                .dark { color-scheme: dark; }
            </style>
        </head>
        <body>
            ${html}
            <script>
                // Console intercept
                const originalLog = console.log;
                const originalError = console.error;
                const originalWarn = console.warn;
                
                console.log = function(...args) {
                    window.parent.postMessage({ type: 'CONSOLE_LOG', data: args.join(' ') }, '*');
                    originalLog.apply(console, args);
                };
                
                console.error = function(...args) {
                    window.parent.postMessage({ type: 'CONSOLE_ERROR', data: args.join(' ') }, '*');
                    originalError.apply(console, args);
                };
                
                console.warn = function(...args) {
                    window.parent.postMessage({ type: 'CONSOLE_WARN', data: args.join(' ') }, '*');
                    originalWarn.apply(console, args);
                };
                
                // Error handling
                window.addEventListener('error', function(e) {
                    window.parent.postMessage({ 
                        type: 'RUNTIME_ERROR', 
                        data: {
                            message: e.message,
                            filename: e.filename,
                            lineno: e.lineno,
                            colno: e.colno
                        }
                    }, '*');
                });
                
                // Network monitoring
                const originalFetch = window.fetch;
                window.fetch = function(...args) {
                    window.parent.postMessage({ 
                        type: 'NETWORK_REQUEST', 
                        data: {
                            url: args[0],
                            method: 'GET',
                            timestamp: Date.now()
                        }
                    }, '*');
                    return originalFetch.apply(this, args);
                };
                
                // User interaction tracking
                ['click', 'input', 'keydown', 'scroll', 'mouseover'].forEach(eventType => {
                    window.addEventListener(eventType, function(e) {
                        window.parent.postMessage({ 
                            type: 'USER_INTERACTION', 
                            data: {
                                event: eventType,
                                target: e.target?.tagName || 'unknown',
                                timestamp: Date.now()
                            }
                        }, '*');
                    }, { capture: true });
                });
                
                ${js}
            </script>
        </body>
        </html>
      `;

      try {
        const doc = iframeRef.current.contentDocument;
        if (doc) {
          doc.open();
          doc.write(combinedHtml);
          doc.close();
          setLoading(false);
        }
      } catch (err) {
        setError('Failed to load preview');
        setLoading(false);
      }
    }
  }, [html, css, js, isRunning, theme, wireframeMode, showGrid]);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'CONSOLE_LOG') {
        setConsoleOutput(prev => [...prev.slice(-9), `[LOG] ${event.data.data}`]);
      } else if (event.data.type === 'CONSOLE_ERROR') {
        setConsoleOutput(prev => [...prev.slice(-9), `[ERROR] ${event.data.data}`]);
        setError(event.data.data);
      } else if (event.data.type === 'CONSOLE_WARN') {
        setConsoleOutput(prev => [...prev.slice(-9), `[WARN] ${event.data.data}`]);
      } else if (event.data.type === 'RUNTIME_ERROR') {
        setError(`Runtime Error: ${event.data.data.message}`);
        setConsoleOutput(prev => [...prev.slice(-9), `[RUNTIME] ${event.data.data.message}`]);
      } else if (event.data.type === 'NETWORK_REQUEST') {
        setNetworkRequests(prev => [...prev.slice(-4), event.data.data]);
      } else if (event.data.type === 'USER_INTERACTION') {
        setInteractionHistory(prev => [...prev.slice(-4), `${event.data.data.event} on ${event.data.data.target}`]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Recording functionality
  useEffect(() => {
    if (recording) {
      recordIntervalRef.current = setInterval(() => {
        setRecordTime(prev => prev + 1);
      }, 1000);
    } else if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
    }

    return () => {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }
    };
  }, [recording]);

  const handleRun = () => {
    setIsRunning(true);
    setConsoleOutput([]);
    setNetworkRequests([]);
    setInteractionHistory([]);
  };

  const handleStop = () => {
    setIsRunning(false);
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
    }
  };

  const handleReload = () => {
    setIsRunning(false);
    setTimeout(() => setIsRunning(true), 100);
  };

  const handleScreenshot = () => {
    if (iframeRef.current && previewRef.current) {
      const canvas = document.createElement('canvas');
      const iframe = iframeRef.current;
      const context = canvas.getContext('2d');

      if (context && iframe.contentWindow) {
        const size = deviceSizes[deviceMode][orientation];
        canvas.width = typeof size.width === 'number' ? size.width : 1920;
        canvas.height = typeof size.height === 'number' ? size.height : 1080;

        // This would require proper implementation with html2canvas
        const screenshotUrl = canvas.toDataURL('image/png');
        setScreenshotHistory(prev => [screenshotUrl, ...prev.slice(0, 4)]);

        // Show success message
        setConsoleOutput(prev => [...prev, `[SYSTEM] Screenshot captured: ${deviceMode} ${orientation}`]);
      }
    }
  };

  const handleToggleRecording = () => {
    setRecording(!recording);
    if (!recording) {
      setRecordTime(0);
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(200, prev + 10));
  const handleZoomOut = () => setZoom(prev => Math.max(25, prev - 10));
  const handleZoomReset = () => setZoom(100);

  const handleToggleOrientation = () => {
    setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait');
  };

  const handleDeviceSimulation = (battery: number, signal: number) => {
    setDeviceBattery(battery);
    setDeviceSignal(signal);
    setDeviceWifi(true);
  };

  const size = deviceSizes[deviceMode][orientation];
  const deviceInfo = deviceSizes[deviceMode];

  const renderDeviceFrame = () => {
    if (!deviceFrame || deviceMode === 'fullscreen') return null;

    const frameStyle = {
      padding: deviceInfo.bezel,
      backgroundColor: '#1a1a1a',
      borderRadius: deviceMode === 'mobile' ? '24px' :
        deviceMode === 'tablet' ? '16px' : '8px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
      position: 'relative' as const,
      overflow: 'hidden',
    };

    const notchStyle = {
      width: '40%',
      height: '20px',
      backgroundColor: '#000',
      position: 'absolute' as const,
      top: deviceInfo.bezel,
      left: '50%',
      transform: 'translateX(-50%)',
      borderRadius: '0 0 12px 12px',
      zIndex: 10,
    };

    const statusBarStyle = {
      height: '24px',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      fontSize: '12px',
      color: '#fff',
      position: 'absolute' as const,
      top: deviceInfo.bezel + (deviceInfo.notch ? 20 : 0),
      left: deviceInfo.bezel,
      right: deviceInfo.bezel,
      zIndex: 5,
    };

    return (
      <div style={frameStyle} className="relative">
        {deviceInfo.notch && <div style={notchStyle} />}
        {deviceInfo.statusBar && (
          <div style={statusBarStyle}>
            <div className="flex items-center space-x-2">
              <span>{deviceTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              {deviceMode === 'mobile' && (
                <>
                  <PhoneCall size={10} />
                  <Signal size={10} style={{ opacity: deviceSignal * 0.25 }} />
                  <Wifi size={10} style={{ opacity: deviceWifi ? 1 : 0.3 }} />
                </>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {deviceMode === 'mobile' && (
                <>
                  <Battery size={12} />
                  <span>{deviceBattery}%</span>
                </>
              )}
              <Volume2 size={12} />
            </div>
          </div>
        )}

        {/* Device buttons */}
        {deviceMode === 'mobile' && orientation === 'portrait' && (
          <>
            <div className="absolute left-0 top-1/4 w-1 h-12 bg-gray-800 rounded-r-md"></div>
            <div className="absolute left-0 top-2/4 w-1 h-20 bg-gray-800 rounded-r-md"></div>
            <div className="absolute right-0 top-1/3 w-1 h-16 bg-gray-800 rounded-l-md"></div>
          </>
        )}
      </div>
    );
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-black z-50 flex flex-col">
        <div className="p-4 border-b border-blue-900/30 bg-black/90 backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Eye className="text-blue-500 animate-pulse" size={20} />
              <span className="text-blue-300 font-mono text-sm tracking-wider">FULLSCREEN PREVIEW</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <div className="px-2 py-1 bg-blue-900/30 rounded border border-blue-700/50">
                <span className="text-blue-300">{zoom}%</span>
              </div>
              <div className="px-2 py-1 bg-gray-900/50 rounded border border-gray-700/50">
                <span className="text-gray-300">{size.width}×{size.height}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleReload}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Reload"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={handleScreenshot}
              className="p-2 hover:bg-blue-900/30 rounded-lg transition-colors text-gray-400 hover:text-blue-300"
              title="Take Screenshot"
            >
              <Download size={16} />
            </button>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
            >
              Exit Fullscreen
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center overflow-auto bg-gradient-to-br from-gray-950 to-black">
          {isRunning ? (
            <div className="relative" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center' }}>
              {renderDeviceFrame()}
              <iframe
                ref={iframeRef}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin"
                title="Project Preview"
              />
            </div>
          ) : (
            <div className="text-center text-gray-500 p-8">
              <PlayIcon size={64} className="mx-auto mb-6 opacity-30" />
              <div className="font-mono text-lg mb-2">Preview is not running</div>
              <div className="text-sm text-gray-600 mb-6">Click Run to start the preview</div>
              <button
                onClick={handleRun}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg flex items-center space-x-2 mx-auto"
              >
                <Play size={16} />
                <span>Run Preview</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-900 to-black" ref={previewRef}>
      {/* Top Control Bar */}
      <div className="p-3 border-b border-blue-900/30 bg-gray-900/80 space-y-3">
        {/* First Row: Main Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <Eye className="text-blue-500" size={16} />
              <span className="text-xs text-gray-500 font-mono uppercase tracking-wider">Interactive Preview</span>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            </div>

            <div className="flex items-center space-x-1 bg-black/80 rounded-lg p-1 border border-blue-900/30">
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="p-1.5 hover:bg-blue-900/30 disabled:opacity-50 rounded transition-colors text-blue-400 flex items-center space-x-1"
                title="Run"
              >
                <Play size={14} />
                <span className="text-xs">Run</span>
              </button>
              <button
                onClick={handleStop}
                disabled={!isRunning}
                className="p-1.5 hover:bg-red-900/30 disabled:opacity-50 rounded transition-colors text-red-400 flex items-center space-x-1"
                title="Stop"
              >
                <Square size={14} />
                <span className="text-xs">Stop</span>
              </button>
              <button
                onClick={handleReload}
                className="p-1.5 hover:bg-blue-900/30 rounded transition-colors text-blue-400 flex items-center space-x-1"
                title="Reload"
              >
                <RotateCcw size={14} />
                <span className="text-xs">Reload</span>
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Zoom Controls */}
            <div className="flex items-center space-x-1 bg-black/60 rounded-lg border border-blue-900/20">
              <button
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-blue-900/20 rounded-l transition-colors text-gray-400 hover:text-white"
              >
                <Minus size={14} />
              </button>
              <div className="px-2 py-1 text-xs text-gray-300 min-w-[60px] text-center">
                {zoom}%
              </div>
              <button
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-blue-900/20 rounded-r transition-colors text-gray-400 hover:text-white"
              >
                <Plus size={14} />
              </button>
              <button
                onClick={handleZoomReset}
                className="p-1.5 hover:bg-blue-900/20 border-l border-blue-900/20 transition-colors text-gray-400 hover:text-white"
              >
                <RotateCcwIcon size={12} />
              </button>
            </div>

            {/* Mode Controls */}
            <button
              onClick={() => setWireframeMode(!wireframeMode)}
              className={`p-1.5 rounded transition-colors ${wireframeMode
                  ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/50'
                  : 'hover:bg-gray-800 text-gray-400'
                }`}
              title="Wireframe Mode"
            >
              <Code size={14} />
            </button>

            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded transition-colors ${showGrid
                  ? 'bg-green-900/30 text-green-400 border border-green-700/50'
                  : 'hover:bg-gray-800 text-gray-400'
                }`}
              title="Show Grid"
            >
              <Layers size={14} />
            </button>

            <button
              onClick={handleToggleRecording}
              className={`p-1.5 rounded transition-colors ${recording
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'hover:bg-red-900/20 text-red-400'
                }`}
              title={recording ? `Recording (${recordTime}s)` : "Start Recording"}
            >
              {recording ? <Square size={14} /> : <Play size={14} />}
            </button>
          </div>
        </div>

        {/* Second Row: Device Selection */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="text-xs text-gray-500">Device:</div>
            <div className="flex items-center space-x-1 bg-black/60 rounded-lg border border-blue-900/20 p-1">
              <button
                onClick={() => setDeviceMode('mobile')}
                className={`flex items-center space-x-1 px-2 py-1 rounded transition-all ${deviceMode === 'mobile'
                    ? 'bg-blue-900/40 text-blue-300 border border-blue-600'
                    : 'hover:bg-blue-900/20 text-gray-400'
                  }`}
              >
                <MobileIcon size={12} />
                <span className="text-xs">Mobile</span>
              </button>
              <button
                onClick={() => setDeviceMode('tablet')}
                className={`flex items-center space-x-1 px-2 py-1 rounded transition-all ${deviceMode === 'tablet'
                    ? 'bg-blue-900/40 text-blue-300 border border-blue-600'
                    : 'hover:bg-blue-900/20 text-gray-400'
                  }`}
              >
                <TabletIcon size={12} />
                <span className="text-xs">Tablet</span>
              </button>
              <button
                onClick={() => setDeviceMode('laptop')}
                className={`flex items-center space-x-1 px-2 py-1 rounded transition-all ${deviceMode === 'laptop'
                    ? 'bg-blue-900/40 text-blue-300 border border-blue-600'
                    : 'hover:bg-blue-900/20 text-gray-400'
                  }`}
              >
                <LaptopIcon size={12} />
                <span className="text-xs">Laptop</span>
              </button>
              <button
                onClick={() => setDeviceMode('desktop')}
                className={`flex items-center space-x-1 px-2 py-1 rounded transition-all ${deviceMode === 'desktop'
                    ? 'bg-blue-900/40 text-blue-300 border border-blue-600'
                    : 'hover:bg-blue-900/20 text-gray-400'
                  }`}
              >
                <DesktopIcon size={12} />
                <span className="text-xs">Desktop</span>
              </button>
              <button
                onClick={() => setDeviceMode('fullscreen')}
                className={`flex items-center space-x-1 px-2 py-1 rounded transition-all ${deviceMode === 'fullscreen'
                    ? 'bg-blue-900/40 text-blue-300 border border-blue-600'
                    : 'hover:bg-blue-900/20 text-gray-400'
                  }`}
              >
                <FullscreenIcon size={12} />
                <span className="text-xs">Full</span>
              </button>
            </div>

            {/* Orientation Toggle */}
            {deviceMode !== 'desktop' && deviceMode !== 'fullscreen' && (
              <button
                onClick={handleToggleOrientation}
                className="flex items-center space-x-1 px-2 py-1 bg-black/60 hover:bg-blue-900/20 rounded border border-blue-900/20 text-gray-400 hover:text-blue-300 transition-colors"
              >
                <RotateCw size={12} />
                <span className="text-xs">{orientation === 'portrait' ? 'Portrait' : 'Landscape'}</span>
              </button>
            )}

            {/* Device Frame Toggle */}
            {deviceMode !== 'fullscreen' && (
              <button
                onClick={() => setDeviceFrame(!deviceFrame)}
                className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${deviceFrame
                    ? 'bg-gray-800 text-gray-300 border border-gray-700'
                    : 'hover:bg-gray-800 text-gray-400'
                  }`}
              >
                <Smartphone size={12} />
                <span className="text-xs">Frame</span>
              </button>
            )}
          </div>

          {/* Theme Selector */}
          <div className="flex items-center space-x-2">
            <div className="text-xs text-gray-500">Theme:</div>
            <div className="flex items-center space-x-1 bg-black/60 rounded-lg border border-blue-900/20 p-1">
              {(['light', 'dark', 'system'] as Theme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${theme === t
                      ? 'bg-blue-900/40 text-blue-300'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                    }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Device Simulation */}
            {deviceMode === 'mobile' && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleDeviceSimulation(100, 4)}
                  className="p-1.5 hover:bg-green-900/20 rounded text-green-400"
                  title="Full Battery & Signal"
                >
                  <Battery size={12} />
                </button>
                <button
                  onClick={() => handleDeviceSimulation(20, 1)}
                  className="p-1.5 hover:bg-red-900/20 rounded text-red-400"
                  title="Low Battery & Signal"
                >
                  <Battery size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Preview Area */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-gradient-to-br from-gray-950 to-black relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                <div className="text-sm text-gray-300">Loading Preview...</div>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute top-4 right-4 bg-red-900/30 border border-red-700/50 rounded-lg p-3 max-w-sm z-10">
              <div className="flex items-center space-x-2">
                <AlertCircle className="text-red-400" size={16} />
                <span className="text-sm text-red-300">{error}</span>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                  <XCircle size={14} />
                </button>
              </div>
            </div>
          )}

          {isRunning ? (
            <div
              className="relative transition-all duration-300"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'center',
                width: typeof size.width === 'number' ? `${size.width}px` : '100%',
                height: typeof size.height === 'number' ? `${size.height}px` : '100%',
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            >
              {deviceFrame && deviceMode !== 'fullscreen' ? (
                <div className="relative">
                  {renderDeviceFrame()}
                  <div className="overflow-hidden" style={{
                    width: typeof size.width === 'number' ? size.width : '100%',
                    height: typeof size.height === 'number' ? size.height : '100%',
                    margin: deviceInfo.bezel,
                    borderRadius: deviceMode === 'mobile' ? '12px' : '8px',
                  }}>
                    <iframe
                      ref={iframeRef}
                      className="w-full h-full border-0"
                      sandbox="allow-scripts allow-same-origin"
                      title="Project Preview"
                    />
                  </div>
                </div>
              ) : (
                <div className="border-4 border-gray-800 rounded-lg shadow-2xl overflow-hidden bg-white">
                  <iframe
                    ref={iframeRef}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts allow-same-origin"
                    title="Project Preview"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-600 p-8">
              <div className="relative mb-6">
                <PlayIcon size={64} className="mx-auto opacity-30" />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-xl"></div>
              </div>
              <div className="font-mono text-lg mb-2">Preview Ready</div>
              <div className="text-sm text-gray-600 mb-6">Run your project to see it in action</div>
              <button
                onClick={handleRun}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg flex items-center space-x-2 mx-auto transition-all hover:scale-105"
              >
                <Play size={16} />
                <span>Run Preview</span>
              </button>
            </div>
          )}

          {/* Metrics Overlay */}
          {showMetrics && isRunning && (
            <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-3 border border-gray-700/50 text-xs">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">Size:</span>
                  <span className="text-gray-300">{size.width}×{size.height}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">Zoom:</span>
                  <span className="text-gray-300">{zoom}%</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">Mode:</span>
                  <span className="text-gray-300">{deviceMode} {orientation}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel - Console & Info */}
        <div className="w-80 border-l border-gray-800 bg-black/40 flex flex-col">
          {/* Tab Header */}
          <div className="border-b border-gray-800 flex space-x-1 p-2">
            <button className="px-3 py-1.5 rounded bg-gray-800 text-gray-300 text-xs">Console</button>
            <button className="px-3 py-1.5 rounded text-gray-500 hover:text-gray-300 text-xs">Network</button>
            <button className="px-3 py-1.5 rounded text-gray-500 hover:text-gray-300 text-xs">Elements</button>
            <button className="px-3 py-1.5 rounded text-gray-500 hover:text-gray-300 text-xs">Screenshots</button>
          </div>

          {/* Console Output */}
          <div className="flex-1 overflow-auto p-3 font-mono text-xs">
            <div className="space-y-2">
              <div className="text-gray-500 mb-2">Console Output:</div>
              {consoleOutput.length === 0 ? (
                <div className="text-gray-600 italic">No console output yet...</div>
              ) : (
                consoleOutput.map((line, i) => (
                  <div key={i} className={`p-2 rounded ${line.includes('[ERROR]') ? 'bg-red-900/20 text-red-300' :
                      line.includes('[WARN]') ? 'bg-yellow-900/20 text-yellow-300' :
                        line.includes('[SYSTEM]') ? 'bg-blue-900/20 text-blue-300' :
                          'bg-gray-900/30 text-gray-300'
                    }`}>
                    {line}
                  </div>
                ))
              )}
            </div>

            {/* Network Requests */}
            {networkRequests.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-gray-500">Network Requests:</div>
                {networkRequests.map((req, i) => (
                  <div key={i} className="p-2 bg-gray-900/30 rounded text-gray-400">
                    <div className="flex items-center justify-between">
                      <span className="truncate">{req.url}</span>
                      <span className="text-green-400">GET</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Interaction History */}
            {interactionHistory.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-gray-500">Recent Interactions:</div>
                {interactionHistory.map((interaction, i) => (
                  <div key={i} className="p-2 bg-purple-900/20 rounded text-purple-300">
                    {interaction}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className="border-t border-gray-800 p-2 text-xs text-gray-500 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                {isRunning ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span>Running</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-gray-500"></div>
                    <span>Stopped</span>
                  </>
                )}
              </div>
              <div className="hidden sm:block">
                <span>{deviceInfo.label}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {recording && (
                <div className="flex items-center space-x-1 text-red-400">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  <span>Rec {recordTime}s</span>
                </div>
              )}
              <button
                onClick={() => setShowMetrics(!showMetrics)}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
                title="Toggle Metrics"
              >
                <Type size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};