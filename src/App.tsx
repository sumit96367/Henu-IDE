import { useState, useEffect } from 'react';
import { OSProvider, useOS } from './context/OSContext';
import { ThemeProvider } from './context/ThemeContext';
import { SplashScreen } from './components/SplashScreen';
import { Workspace } from './components/Workspace';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Auth } from './components/Auth';
import { supabase } from './services/supabase';

type AppPhase = 'splash' | 'auth' | 'welcome' | 'workspace';

interface OpenFolder {
  name: string;
  path: string;
  fileSystem?: any[];
}

function AppContent() {
  const [phase, setPhase] = useState<AppPhase>('splash');
  const [session, setSession] = useState<any>(null);
  const { updateFileSystem, setCurrentPath } = useOS();

  // Check for session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-transition from splash to auth/welcome after splash completes
  useEffect(() => {
    if (phase === 'splash') {
      const timer = setTimeout(() => {
        if (!session) {
          setPhase('auth');
        } else {
          setPhase('welcome');
        }
      }, 2500); // Match splash screen duration
      return () => clearTimeout(timer);
    }
  }, [phase, session]);

  // Handle session established while on auth screen
  useEffect(() => {
    if (session && phase === 'auth') {
      setPhase('welcome');
    }
  }, [session, phase]);

  const handleOpenFolder = (folder: OpenFolder) => {
    // Update the file system in context if we have file data
    if (folder.fileSystem && folder.fileSystem.length > 0) {
      updateFileSystem(folder.fileSystem);
    }

    // Update current path
    setCurrentPath(folder.path);

    // Transition to workspace
    setPhase('workspace');
  };

  // Show splash screen during boot
  if (phase === 'splash') {
    return <SplashScreen />;
  }

  // Show auth screen if not signed in
  if (phase === 'auth' || !session) {
    return <Auth onAuthenticated={() => setPhase('welcome')} />;
  }

  // Show welcome screen if no folder is open
  if (phase === 'welcome') {
    return (
      <WelcomeScreen
        onOpenFolder={handleOpenFolder}
        onCloneRepo={(_url, name) => {
          handleOpenFolder({
            name,
            path: `/home/user/projects/${name}`,
            fileSystem: []
          });
        }}
      />
    );
  }

  // Show workspace with the opened folder
  return <Workspace />;
}

function App() {
  return (
    <ThemeProvider>
      <OSProvider>
        <AppContent />
      </OSProvider>
    </ThemeProvider>
  );
}

export default App;
