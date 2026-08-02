import type { CSSProperties } from 'react';

/* ==========================================================================
   Identidade visual SobControle (direção "S modular")
   --------------------------------------------------------------------------
   Fonte da verdade dos arquivos originais: `Logo/logo-2b/` + `Logo/Sobcontrole
   Manual de Marca.dc.html`. Regras do manual respeitadas aqui:
   - ângulo, abertura e espessura dos arcos (9/72 do viewBox) nunca mudam;
   - sem sombra, contorno, gradiente ou inclinação sobre o símbolo;
   - wordmark sempre minúsculo, Archivo 600, tracking -3%;
   - redução mínima: símbolo 16px, lockup horizontal 120px de largura.

   Paleta oficial: azul-noite #16193B · violeta #6D4AFF (#8F76FF sobre fundo
   escuro) · neutros #FFFFFF / #F8F8FB / #5B636D · monocromática #14181D.
   ========================================================================== */

/**
 * Variantes autorizadas do manual.
 * - `cor`    — azul-noite + violeta, para fundos claros
 * - `escuro` — branco + violeta claro, para fundos escuros (azul-noite)
 * - `branco` — monocromática branca, para fotos e fundos coloridos
 * - `mono`   — monocromática escura (impressão, 1 cor)
 * - `auto`   — `cor` no tema claro e `escuro` no tema escuro (somente app logado,
 *              onde a classe `.dark` do <html> é a fonte da verdade do tema)
 */
export type LogoVariant = 'cor' | 'escuro' | 'branco' | 'mono' | 'auto';

/** Classes de stroke por variante: [arco superior, arco inferior]. */
const VARIANT_STROKES: Record<LogoVariant, [string, string]> = {
  cor: ['stroke-[#16193B]', 'stroke-[#6D4AFF]'],
  escuro: ['stroke-white', 'stroke-[#8F76FF]'],
  branco: ['stroke-white', 'stroke-white'],
  mono: ['stroke-[#14181D]', 'stroke-[#14181D]'],
  auto: ['stroke-[#16193B] dark:stroke-white', 'stroke-[#6D4AFF] dark:stroke-[#8F76FF]'],
};

/** Cor do wordmark por variante. */
const VARIANT_TEXT: Record<LogoVariant, string> = {
  cor: 'text-[#16193B]',
  escuro: 'text-white',
  branco: 'text-white',
  mono: 'text-[#14181D]',
  auto: 'text-[#16193B] dark:text-white',
};

/**
 * Símbolo isolado: dois arcos independentes que se encaixam formando um S.
 * Redução mínima de 16px — abaixo disso os arcos deixam de ler como um S.
 */
export function LogoSymbol({
  className = 'w-8 h-8',
  variant = 'auto',
  title,
}: {
  className?: string;
  variant?: LogoVariant;
  title?: string;
}) {
  const [topStroke, bottomStroke] = VARIANT_STROKES[variant];

  return (
    <svg
      viewBox="0 0 72 72"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <path
        d="M50 21 A15 15 0 1 0 36 36"
        fill="none"
        strokeWidth={9}
        strokeLinecap="round"
        className={topStroke}
      />
      <path
        d="M22 51 A15 15 0 1 0 36 36"
        fill="none"
        strokeWidth={9}
        strokeLinecap="round"
        className={bottomStroke}
      />
    </svg>
  );
}

/**
 * Ícone de app: símbolo em branco/violeta claro sobre o quadrado azul-noite.
 * As proporções vêm de `Logo/logo-2b/app-icon.svg`: cantos de 22% do lado e
 * símbolo ocupando 56% da caixa (288/512). As medidas do símbolo são
 * percentuais de largura/altura — e não padding — porque padding percentual
 * resolveria contra o elemento pai, não contra o próprio quadrado.
 */
export function LogoAppIcon({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[22%] bg-[#16193B] ${className}`}
    >
      <LogoSymbol className="w-[56%] h-[56%]" variant="escuro" />
    </span>
  );
}

/** Wordmark isolado — Archivo 600, minúsculo, tracking -3% (regra do manual). */
export function LogoWordmark({
  className = 'text-xl',
  variant = 'auto',
}: {
  className?: string;
  variant?: LogoVariant;
}) {
  return (
    <span
      className={`font-brand font-semibold lowercase leading-none tracking-[-0.03em] ${VARIANT_TEXT[variant]} ${className}`}
    >
      sobcontrole
    </span>
  );
}

/**
 * Lockup principal (símbolo + wordmark). `orientation="vertical"` empilha os
 * elementos, como o lockup vertical dos arquivos originais.
 *
 * O elemento inteiro é exposto como uma única imagem acessível, então o
 * símbolo e o texto ficam ocultos para leitores de tela.
 */
export function Logo({
  className = '',
  symbolClassName = 'w-9 h-9',
  wordmarkClassName = 'text-2xl',
  variant = 'auto',
  orientation = 'horizontal',
  label = 'SobControle',
}: {
  className?: string;
  symbolClassName?: string;
  wordmarkClassName?: string;
  variant?: LogoVariant;
  orientation?: 'horizontal' | 'vertical';
  label?: string;
}) {
  const isVertical = orientation === 'vertical';

  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex ${
        isVertical ? 'flex-col gap-2.5' : 'flex-row gap-2.5'
      } items-center ${className}`}
    >
      <LogoSymbol className={`shrink-0 ${symbolClassName}`} variant={variant} />
      <LogoWordmark className={wordmarkClassName} variant={variant} />
    </span>
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
