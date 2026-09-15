import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { AnalyzerWorkspace } from './components/AnalyzerWorkspace';
import { Methodology } from './components/Methodology';
import { Footer } from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <AnalyzerWorkspace />
        <Methodology />
      </main>
      <Footer />
    </div>
  );
}

export default App;
