import React from 'react';
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

export const Landing: React.FC = () => {
  const { isAuthenticated } = useAuth();

  // Se já estiver logado, redireciona direto para o dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0c0c0c] text-white">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="c3-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0" />
          <feComposite in2="SourceGraphic" operator="in" result="noise" />
          <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
        </filter>
      </svg>

      <div className="relative z-10">
        <Navbar />
        <Hero />
        <AllInOne />
        <Inbox />
        <FeatureTriage />
        <Modules />
        <GestlyHighlight />
        <ValueFlow />
        <LogoCloud />
        <TargetAudience />
        <Testimonials />
        <Benefits />
        <ProductPreview />
        <Security />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </div>
    </div>
  );
};

export default Landing;
