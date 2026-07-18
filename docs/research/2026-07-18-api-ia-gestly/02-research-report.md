# Relatório de pesquisa — APIs de IA para o Gestly

## Conclusão executiva

Para o SobControle, a melhor relação entre capacidade, custo operacional e governança é a **Gemini API no plano pago**. Use `gemini-2.5-flash` para o uso cotidiano e `gemini-2.5-pro` somente para importações e análises complexas. A API oferece function calling, respostas estruturadas, busca em arquivos, contexto longo, cache e processamento em lote. No plano pago, o conteúdo não é usado para melhorar produtos; o plano gratuito não é apropriado para dados empresariais.

O **DeepSeek V4 Flash** é a alternativa de menor custo e tecnicamente consegue executar chat, JSON estruturado e ferramentas. Contudo, a política de privacidade declara processamento/armazenamento de dados na China e uso de conteúdo para operar e melhorar tecnologia. Por isso, não é recomendado como provedor único para CPF/CNPJ, dados bancários, documentos, e-mails ou histórico identificável de clientes.

## Comparativo

| Opção | Aderência ao Gestly | Custo | Dados e governança | Veredito |
| --- | --- | --- | --- | --- |
| **Gemini API paga** | Chat, funções, JSON schema, documentos, File Search, cache e lote. | Boa para volume, especialmente Flash e batch. | Conteúdo do plano pago não é usado para melhorar produtos; avaliar Vertex AI se forem necessários controles corporativos extras. | **Recomendação principal.** |
| **OpenAI API** | Excelente para ferramentas, saída estruturada, embeddings e RAG. | Muito competitiva com GPT-5 mini/nano. | Controles de retenção e dados documentados; exige configurar o uso adequado. | Melhor alternativa, ou opção preferida se a equipe quiser o ecossistema OpenAI. |
| **Claude API** | Muito forte em documentos, raciocínio e tool use. | Mais cara em alto volume. | Termos comerciais e controles de conteúdo fortes. | Premium para casos complexos, não necessário como padrão inicial. |
| **DeepSeek V4** | Contexto de 1M, tool calling e JSON; compatível com SDKs OpenAI/Anthropic. | A mais barata na comparação. | Risco relevante para CRM/financeiro na API direta. | Usar apenas dados minimizados, não sensíveis, ou como experimento separado. |

## DeepSeek V4: avaliação da sua ideia

O DeepSeek V4 é real e está disponível oficialmente como `deepseek-v4-flash` e `deepseek-v4-pro`; ambos têm contexto de 1 milhão de tokens, modos thinking/non-thinking e compatibilidade com APIs OpenAI e Anthropic. Os nomes antigos `deepseek-chat` e `deepseek-reasoner` serão descontinuados em 24/07/2026. [Lançamento oficial](https://api-docs.deepseek.com/news/news260424/) e [guia de início](https://api-docs.deepseek.com/quick_start/).

Ele também suporta chamadas de ferramenta e modo estrito para JSON Schema, em que a aplicação — e não o modelo — executa a ação solicitada. [Documentação de function calling](https://api-docs.deepseek.com/guides/function_calling/).

Em preço publicado por milhão de tokens, o V4 Flash custa US$0,0028 por entrada com cache, US$0,14 sem cache e US$0,28 de saída; o V4 Pro custa US$0,003625, US$0,435 e US$0,87, respectivamente. [Tabela oficial de preços](https://api-docs.deepseek.com/quick_start/pricing/).

**Ressalva decisiva:** a [política de privacidade do DeepSeek](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html) informa coleta de prompts, arquivos e histórico, processamento/armazenamento na China e uso de informações para operar, desenvolver e aprimorar seus serviços. Para um sistema brasileiro com dados de clientes e financeiro, isso exige avaliação jurídica/LGPD, minimização forte e contrato/garantias adequadas antes de qualquer uso em produção.

## Gemini API paga: por que se encaixa melhor

O Gemini permite que o Gestly solicite funções internas — por exemplo, consultar vendas agregadas ou criar um rascunho de follow-up — e a aplicação decide se executa ou não. [Function calling](https://ai.google.dev/gemini-api/docs/function-calling). Também produz saídas em JSON a partir de schema, útil para importar planilhas e classificar dados; a validação semântica continua obrigatória no backend. [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).

Para documentos e base de conhecimento, a API oferece contexto longo, cache e File Search. O cache é especialmente útil quando os mesmos documentos ou instruções são consultados repetidamente. [Contexto longo](https://ai.google.dev/gemini-api/docs/long-context) e [cache](https://ai.google.dev/gemini-api/docs/caching).

O plano pago inclui recursos de produção, batch com redução de custo e informa que o conteúdo não é usado para melhorar produtos; o gratuito pode usar conteúdo para melhoria. [Preços](https://ai.google.dev/gemini-api/docs/pricing) e [termos](https://ai.google.dev/gemini-api/terms).

## OpenAI: melhor alternativa

Se a prioridade for a maturidade de ferramentas e saídas estruturadas, OpenAI é a alternativa mais forte. `GPT-5 mini` suporta function calling, Structured Outputs, streaming e visão, com contexto de 400k e preço publicado de US$0,25/M de entrada, US$0,025/M de entrada em cache e US$2/M de saída. [Modelo GPT-5 mini](https://developers.openai.com/api/docs/models/gpt-5-mini).

Para classificação e extração em alto volume, `GPT-5 nano` custa US$0,05/M de entrada e US$0,40/M de saída. Para RAG, `text-embedding-3-small` custa US$0,02/M. [GPT-5 nano](https://developers.openai.com/api/docs/models/gpt-5-nano) e [embeddings](https://developers.openai.com/api/docs/models/text-embedding-3-small). A Batch API reduz 50% em tarefas assíncronas. [Batch API](https://platform.openai.com/docs/api-reference/batch/object?api-mode=responses).

Os controles de retenção e residência devem ser configurados para o caso de uso; a documentação descreve retenção, endpoints e opções de controle de dados. [Controles de dados](https://developers.openai.com/api/docs/guides/your-data#default-usage-policies-by-endpoint).

## Claude: referência de qualidade premium

Claude oferece tool use e saídas estruturadas confiáveis, bom para fluxos complexos e documentos. O Claude Haiku é mais barato que Sonnet, mas a tabela de preços ainda tende a ficar acima de soluções Flash para tráfego intenso. [Tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview), [saídas estruturadas](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) e [preços](https://platform.claude.com/docs/en/about-claude/pricing).

## Arquitetura segura, independente do fornecedor

1. A IA nunca recebe conexão direta ao Supabase nem chave privilegiada.
2. O backend oferece poucas ferramentas permitidas, como `consultar_resumo_vendas` ou `rascunhar_followup`.
3. A empresa do usuário é obtida da sessão/RLS, não de um argumento que o modelo possa inventar.
4. Operações de escrita, financeiras, exclusão e envio externo exigem validação no servidor e confirmação humana explícita.
5. Importações retornam uma prévia validada; só depois de aprovação humana os dados são gravados.
6. CPF/CNPJ, telefone, e-mail, dados bancários e anexos são mascarados ou omitidos quando não indispensáveis.
7. Logs não devem guardar prompts completos por padrão; registre uso, custo, falhas e identificador técnico sem dados sensíveis.

## Estimativa simples de custo

Para uma resposta típica com 3 mil tokens de entrada e 500 de saída, GPT-5 mini custaria cerca de US$0,00175 por interação; GPT-5 nano, cerca de US$0,00035. Os valores finais variam conforme contexto, cache, ferramentas e tamanho de resposta. Em Gemini, os preços são por modelo e nível; validar a tabela no início da implantação, pois modelos e preços evoluem rapidamente.
