import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Inbox from './components/Inbox';
import FeatureTriage from './components/FeatureTriage';
import LogoCloud from './components/LogoCloud';
import Testimonials from './components/Testimonials';
import Pricing from './components/Pricing';
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
        <Inbox />
        <FeatureTriage />
        <LogoCloud />
        <Testimonials />
        <Pricing />
        <FinalCTA />
      </div>
    </div>
  );
};

export default Landing;
