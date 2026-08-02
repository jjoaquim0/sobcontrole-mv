import React from 'react';
import { MotionConfig } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import AllInOne from './components/AllInOne';
import Inbox from './components/Inbox';
import FeatureTriage from './components/FeatureTriage';
import Modules from './components/Modules';
import GestlyHighlight from './components/GestlyHighlight';
import ValueFlow from './components/ValueFlow';
import LogoCloud from './components/LogoCloud';
import TargetAudience from './components/TargetAudience';
import Testimonials from './components/Testimonials';
import Benefits from './components/Benefits';
import ProductPreview from './components/ProductPreview';
import Security from './components/Security';
import Pricing from './components/Pricing';
import FAQ from './components/FAQ';
import FinalCTA from './components/FinalCTA';

/**
 * Faixa branca: alterna com o fundo cinza-azulado da página para criar ritmo
 * vertical sem introduzir bordas ou sombras adicionais entre as seções.
 */
const Band: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-landing-surface">{children}</div>
);

export const Landing: React.FC = () => {
  const { isAuthenticated } = useAuth();

  // Se já estiver logado, redireciona direto para o dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    // `landing-theme` declara os tokens `--landing-*` (src/index.css). O escopo
    // garante que o tema claro não vaze para o app autenticado nem seja afetado
    // pela classe `.dark` que o usuário possa ter salvo no <html>.
    <MotionConfig reducedMotion="user">
      <div className="landing-theme relative min-h-screen overflow-x-hidden bg-landing-bg text-landing-text">
        <Navbar />

        <main>
          <Hero />

          <Band>
            <AllInOne />
            <Inbox />
          </Band>

          <FeatureTriage />
          <Modules />

          <div className="bg-landing-surface-brand">
            <GestlyHighlight />
          </div>

          <Band>
            <ValueFlow />
            <LogoCloud />
            <TargetAudience />
          </Band>

          <Testimonials />
          <Benefits />

          <Band>
            <ProductPreview />
            <Security />
          </Band>

          <Pricing />

          <Band>
            <FAQ />
          </Band>

          <FinalCTA />
        </main>
      </div>
    </MotionConfig>
  );
};

export default Landing;
