import type { CSSProperties } from 'react';

/**
 * Marca de 4 quadrantes usada na landing page, adaptada para o app logado.
 * fill="currentColor" (em vez do branco fixo da landing) para funcionar em tema claro e escuro.
 */
export function LogoMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className}>
      <path d="M 0 128 C 70.692 128 128 185.308 128 256 L 64 256 C 64 220.654 35.346 192 0 192 Z M 256 192 C 220.654 192 192 220.654 192 256 L 128 256 C 128 185.308 185.308 128 256 128 Z M 128 0 C 128 70.692 70.692 128 0 128 L 0 64 C 35.346 64 64 35.346 64 0 Z M 192 0 C 192 35.346 220.654 64 256 64 L 256 128 C 185.308 128 128 70.692 128 0 Z" />
    </svg>
  );
}

/** Rótulo de contexto (ponto + label + tag opcional), mesmo padrão usado no início de cada seção da landing. */
export function SectionEyebrow({ label, tag }: { label: string; tag?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white" />
        <span className="text-sm font-medium text-gray-600 dark:text-white/70">{label}</span>
      </div>
      {tag && (
        <span className="px-2 py-0.5 rounded-full border border-black/10 dark:border-white/10 text-gray-500 dark:text-white/50 text-xs">
          {tag}
        </span>
      )}
    </div>
  );
}

/** Gradiente navy -> ciano usado para destacar uma palavra em títulos (mesmo da landing). */
export const gradientTextStyle: CSSProperties = {
  backgroundImage:
    'linear-gradient(to right, #091020 0%, #0B2551 12.5%, #A4F4FD 32.5%, #00d2ff 50%, #0B2551 67.5%, #091020 87.5%, #091020 100%)',
  backgroundSize: '200% auto',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
  filter: 'url(#app-noise)',
};

/** Blobs de gradiente com blur para dar profundidade ambiente sem depender de vídeo de fundo. */
export function GlowOrbs() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div
        className="absolute -top-40 -right-40 w-[36rem] h-[36rem] rounded-full blur-3xl opacity-20 dark:opacity-25"
        style={{ background: 'radial-gradient(circle, #00d2ff 0%, transparent 70%)' }}
      />
      <div
        className="absolute -bottom-40 -left-40 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-10 dark:opacity-20"
        style={{ background: 'radial-gradient(circle, #0B2551 0%, transparent 70%)' }}
      />
    </div>
  );
}

/** Filtro de ruído/grain SVG usado atrás de textos com gradiente shiny (mesmo id usado pela landing, escopado para a árvore do app). */
export function NoiseFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <filter id="app-noise">
        <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0" />
        <feComposite in2="SourceGraphic" operator="in" result="noise" />
        <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
      </filter>
    </svg>
  );
}
