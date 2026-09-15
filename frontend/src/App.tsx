import { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { AnalyzerWorkspace } from './components/AnalyzerWorkspace';
import { Methodology } from './components/Methodology';
import { Footer } from './components/Footer';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProfilePage } from './pages/ProfilePage';

type ViewType = 'home' | 'login' | 'register' | 'profile';

function MainApp() {
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'login' || hash === 'register' || hash === 'profile') {
      return hash as ViewType;
    }
    return 'home';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'login' || hash === 'register' || hash === 'profile') {
        setCurrentView(hash as ViewType);
      } else if (hash === '' || hash === 'analyzer' || hash === 'methodology' || hash === 'architecture') {
        setCurrentView('home');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (view: ViewType) => {
    setCurrentView(view);
    if (view === 'home') {
      window.location.hash = '';
    } else {
      window.location.hash = view;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-gray-200 flex flex-col justify-between">
      <Navbar currentView={currentView} onNavigate={handleNavigate} />
      
      <main className="flex-1">
        {currentView === 'home' && (
          <>
            <Hero />
            <AnalyzerWorkspace />
            <Methodology />
          </>
        )}

        {currentView === 'login' && (
          <LoginPage onNavigate={handleNavigate} />
        )}

        {currentView === 'register' && (
          <RegisterPage onNavigate={handleNavigate} />
        )}

        {currentView === 'profile' && (
          <ProfilePage onNavigate={handleNavigate} />
        )}
      </main>

      <Footer />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

export default App;
