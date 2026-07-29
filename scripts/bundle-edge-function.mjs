/**
 * Gera uma versão de arquivo único da Edge Function ai-gateway.
 *
 * Uso: node scripts/bundle-edge-function.mjs
 * Saída: dist-edge/ai-gateway.ts
 *
 * Serve para o deploy pelo editor web do Supabase, que não recebe bem a árvore
 * de arquivos em supabase/functions/_shared/. O deploy pela CLI continua sendo
 * o caminho preferido e não precisa deste arquivo.
 *
 * Imports resolvidos pelo Deno em runtime (jsr:, npm:, https:, node:) seguem
 * externos; somente os imports relativos do projeto são inlinados.
 */
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

const keepRemoteExternal = {
  name: 'keep-remote-external',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^(jsr:|npm:|https:|node:|deno:)/ }, (args) => ({
      path: args.path,
      external: true,
    }));
  },
};

mkdirSync('dist-edge', { recursive: true });

await build({
  entryPoints: ['supabase/functions/ai-gateway/index.ts'],
  outfile: 'dist-edge/ai-gateway.ts',
  bundle: true,
  format: 'esm',
  target: 'esnext',
  platform: 'neutral',
  charset: 'utf8',
  legalComments: 'none',
  plugins: [keepRemoteExternal],
  banner: {
    js: [
      // O esbuild remove as anotações de tipo, então o arquivo gerado é, na
      // prática, JavaScript com extensão .ts. Sem @ts-nocheck o Deno acusaria
      // centenas de "implicitly has an any type". Os tipos continuam validados
      // no código-fonte original, que é o que passa por deno check.
      '// @ts-nocheck',
      '// ai-gateway — arquivo unico gerado a partir de',
      '// supabase/functions/ai-gateway/index.ts e supabase/functions/_shared/ai/**.',
      '// Gerado por scripts/bundle-edge-function.mjs para colar no editor do Supabase.',
      '// NAO edite aqui: altere os arquivos originais e gere de novo.',
    ].join('\n'),
  },
});

console.log('dist-edge/ai-gateway.ts gerado.');
