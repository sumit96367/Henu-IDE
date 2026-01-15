import { OSProvider, useOS } from './context/OSContext';
import { SplashScreen } from './components/SplashScreen';
import { Workspace } from './components/Workspace';

function OSContent() {
  const { state } = useOS();

  if (state.phase === 'boot' || state.phase === 'splash') {
    return <SplashScreen />;
  }

  return <Workspace />;
}

function App() {
  return (
    <OSProvider>
      <OSContent />
    </OSProvider>
  );
}

export default App;
