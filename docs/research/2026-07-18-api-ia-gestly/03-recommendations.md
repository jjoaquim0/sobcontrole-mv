# Recomendação e próximos passos

## Decisão recomendada

Adotar **Gemini API no plano pago** como a única integração inicial de IA:

- `gemini-2.5-flash`: modelo padrão para chat, sugestões, classificação, resumo e importação simples.
- `gemini-2.5-pro`: acionado somente por fila para PDFs, planilhas extensas, análises de DRE/caixa e casos que falharem na validação com Flash.

Isso mantém uma única conta, uma API e um padrão técnico, sem pagar por um modelo premium em toda interação.

## Quando escolher outra opção

- **OpenAI:** escolha em vez de Gemini se a equipe preferir o ecossistema OpenAI e quiser um conjunto muito maduro de ferramentas, Structured Outputs e embeddings. A combinação GPT-5 mini + nano é excelente e competitiva.
- **Claude:** escolha para uma camada premium de análise complexa/documentos quando qualidade e confiabilidade justificarem custo maior.
- **DeepSeek V4 Flash:** escolha apenas para dados desidentificados e não sensíveis, como geração de texto genérico, testes ou classificação sem PII. Não o use para processar os dados completos do CRM e Open Finance sem validação LGPD e contratual.

## Ordem de implementação recomendada

1. Criar uma camada `AIProvider` no backend, sem acoplar a interface diretamente a um fornecedor.
2. Entregar o Gestly para perguntas de leitura, com ferramentas somente de consulta e dados agregados.
3. Adicionar sugestões de follow-up e mensagens como rascunhos, nunca como envio automático.
4. Criar importação CSV/XLSX em duas etapas: interpretação/preview e confirmação humana.
5. Adicionar RAG de documentos com filtro obrigatório por empresa.
6. Criar métricas de custo por empresa, limites de uso, logs sem PII e alertas de falha.
7. Antes de Open Finance, realizar avaliação LGPD, definir retenção e confirmar os termos/DPA do fornecedor.

## Critérios de aceite antes de produção

- Nenhuma chave de API no frontend.
- Nenhuma ferramenta genérica de SQL ou acesso direto a banco.
- Testes para isolamento de `company_id` e permissões.
- Schema e validação de toda resposta estruturada.
- Confirmação humana para gravação, envio e operações financeiras.
- Painel de custo, limite por empresa e mecanismo de desligamento da IA.
- Política de privacidade e consentimento atualizados.
