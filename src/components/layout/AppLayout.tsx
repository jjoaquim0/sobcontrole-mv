import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { GlowOrbs, NoiseFilter } from '../shared/brand';
import { ChatButton, ChatPanel } from '../chat';

export const AppLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[#f8fafc] dark:bg-[#0a0b0e] transition-colors duration-300">
      <NoiseFilter />
      <GlowOrbs />

      {/* Sidebar de navegação */}
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />

      {/* Container principal de conteúdo */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Topbar / Header */}
        <Header />

        {/* Área de conteúdo rolável */}
        <main className="flex-1 overflow-y-auto p-6 transition-colors duration-300">
          <Outlet />
        </main>
      </div>

      {/* Chatbot Gestly */}
      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <ChatButton isOpen={isChatOpen} onToggle={() => setIsChatOpen((prev) => !prev)} />
    </div>
  );
};
export default AppLayout;
