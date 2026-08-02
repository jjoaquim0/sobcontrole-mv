import type { CSSProperties } from 'react'

/**
 * Constantes de estilo do tema claro da landing page pública.
 *
 * Mantidas fora de `components/shared.tsx` porque aquele módulo só exporta
 * componentes (regra `react-refresh/only-export-components`).
 *
 * As cores vêm dos tokens `--landing-*` declarados em `.landing-theme`
 * (`src/index.css`) e do mapeamento `theme.extend.colors.landing` do
 * Tailwind — nada aqui é aplicado ao app autenticado.
 */

/** Anel de foco padrão da landing, aplicado em todo link, botão e accordion. */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-brand focus-visible:ring-offset-2 focus-visible:ring-offset-landing-bg'

/**
 * Gradiente navy -> azul -> ciano da palavra de destaque do H1.
 *
 * Reescrito para o tema claro: a parada mais clara (`#0A85B5`) mantém ~3.9:1
 * sobre o fundo da landing (`#F5F8FC`), acima do mínimo WCAG AA para texto
 * grande (3:1). O filtro de ruído (`url(#c3-noise)`) foi removido porque o
 * grão preto multiplicado sujava o texto sobre fundo claro.
 */
export const gradientStyle: CSSProperties = {
  backgroundImage:
    'linear-gradient(to right, #0B2551 0%, #0B2551 12.5%, #0B5FBF 32.5%, #0A85B5 50%, #0B2551 67.5%, #0B2551 87.5%, #0B2551 100%)',
  backgroundSize: '200% auto',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
}
