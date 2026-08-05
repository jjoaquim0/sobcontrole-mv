/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Orçamento por chunk. O build avisa quando algum passar deste limite —
    // é o sinal para dividir a rota em vez de deixar o bundle crescer calado.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Forma de função em vez de objeto: atribui cada módulo pelo caminho
        // do arquivo. A forma de objeto deixava um pacote absorver o outro
        // quando havia dependência entre eles (react acabava dentro do router).
        // A ordem importa — a primeira correspondência vence.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // Pesado e restrito a dashboard, financial e reports. Inclui as
          // dependências d3-*, que só existem por causa do recharts.
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor')) {
            return 'vendor-charts';
          }
          // Restrito a agenda e pipeline.
          if (id.includes('@dnd-kit')) return 'vendor-dnd';
          // Usado em 48 arquivos: ganha cache próprio por ser grande e mudar pouco.
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
            return 'vendor-motion';
          }
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('/zod/')) {
            return 'vendor-forms';
          }
          if (id.includes('@supabase') || id.includes('@tanstack') || id.includes('/zustand/')) {
            return 'vendor-data';
          }
          if (id.includes('react-router') || id.includes('@remix-run')) return 'vendor-router';
          // Sem isto o Rollup emite um chunk por ícone (~20 requisições de
          // menos de 1 kB só na landing). Um chunk único troca esse enxame de
          // round-trips por uma requisição cacheável.
          if (id.includes('lucide-react')) return 'vendor-icons';
          // Núcleo presente em toda navegação.
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
