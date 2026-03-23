import './App.css';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import Navbar from './components/Navbar';
import OnboardingModal, { loadSelection } from './components/OnboardingModal';
import Feed from './pages/Feed';
import Foundations from './pages/Foundations';
import Search from './pages/Search';

function App() {
  const [selection, setSelection] = useState(() => loadSelection());
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    if (!selection.role || !selection.industry) {
      setOnboardingOpen(true);
    }
  }, [selection.role, selection.industry]);

  const headerRole = useMemo(() => selection.role, [selection.role]);
  const headerIndustry = useMemo(() => selection.industry, [selection.industry]);

  return (
    <BrowserRouter>
      <div className="appShell">
        <Navbar
          role={headerRole}
          industry={headerIndustry}
          onChangeSelection={() => setOnboardingOpen(true)}
        />

        <main className="main">
          <Routes>
            <Route path="/" element={<Feed role={selection.role} industry={selection.industry} onOpenOnboarding={() => setOnboardingOpen(true)} />} />
            <Route path="/foundations" element={<Foundations role={selection.role} />} />
            <Route
              path="/search"
              element={<Search role={selection.role} industry={selection.industry} />}
            />
          </Routes>
        </main>

        <OnboardingModal
          open={onboardingOpen}
          initialRole={selection.role}
          initialIndustry={selection.industry}
          onClose={(next) => {
            setOnboardingOpen(false);
            if (next?.role && next?.industry) setSelection(next);
          }}
        />
      </div>
    </BrowserRouter>
  );
}

export default App;
