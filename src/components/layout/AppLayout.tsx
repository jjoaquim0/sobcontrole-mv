import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-themeBg-light dark:bg-themeBg-dark transition-colors duration-300">
      {/* Sidebar de navegação */}
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />

      {/* Container principal de conteúdo */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar / Header */}
        <Header />

        {/* Área de conteúdo rolável */}
        <main className="flex-1 overflow-y-auto bg-[#f0f2f5] dark:bg-[#0f1117] p-6 transition-colors duration-300">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
export default AppLayout;
