import { AIServiceError } from '../errors.ts';
import type { AIProviderToolDefinition } from '../types.ts';
import type {
  AnyReadOnlyToolDefinition,
  ReadOnlyToolDefinition,
  ToolExecutionEnvironment,
  ToolExecutionResult,
} from './types.ts';

const FORBIDDEN_KEYS = new Set([
  'company_id',
  'companyid',
  'user_id',
  'userid',
  'sql',
  'table',
  'table_name',
  'column',
  'column_name',
  'filter',
  'filters',
]);

const containsForbiddenKey = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(containsForbiddenKey);
  if (typeof value !== 'object' || value === null) return false;
  return Object.entries(value).some(
    ([key, child]) => FORBIDDEN_KEYS.has(key.toLowerCase()) || containsForbiddenKey(child),
  );
};

const eraseDefinition = <Input>(
  definition: ReadOnlyToolDefinition<Input>,
): AnyReadOnlyToolDefinition => ({
  ...definition,
  parseInput: (value) => definition.parseInput(value),
  validateOutput: (value) => definition.validateOutput(value),
  execute: (environment, input) => definition.execute(environment, input as Input),
});

export class ReadOnlyToolRegistry {
  private readonly definitions = new Map<string, AnyReadOnlyToolDefinition>();

  register<Input>(definition: ReadOnlyToolDefinition<Input>): this {
    if (definition.mode !== 'read_only' || this.definitions.has(definition.name)) {
      throw new AIServiceError('configuration_error');
    }
    this.definitions.set(definition.name, eraseDefinition(definition));
    return this;
  }

  /**
   * Registra um catálogo heterogêneo de uma vez.
   *
   * `register` infere um único `Input`, então uma tupla com ferramentas de
   * entradas diferentes não passa por ele. Aqui os contratos já chegam com o
   * tipo apagado, e as mesmas validações continuam valendo.
   */
  registerAll(definitions: readonly AnyReadOnlyToolDefinition[]): this {
    for (const definition of definitions) {
      if (definition.mode !== 'read_only' || this.definitions.has(definition.name)) {
        throw new AIServiceError('configuration_error');
      }
      this.definitions.set(definition.name, definition);
    }
    return this;
  }

  toProviderTools(): AIProviderToolDefinition[] {
    return [...this.definitions.values()].map((definition) => ({
      type: 'function',
      name: definition.name,
      description: definition.description,
      parameters: definition.inputSchema,
      strict: true,
    }));
  }

  supports(name: string): boolean {
    return this.definitions.has(name);
  }

  async execute(
    name: string,
    serializedArguments: string,
    environment: ToolExecutionEnvironment,
  ): Promise<ToolExecutionResult> {
    const definition = this.definitions.get(name);
    if (!definition) throw new AIServiceError('tool_unavailable');

    if (!definition.allowedRoles.includes(environment.securityContext.role)) {
      // A negativa vem da sensibilidade declarada no contrato, e não de um nome
      // fixo: qualquer ferramenta financeira nova herda a mesma mensagem.
      throw new AIServiceError(
        definition.sensitivity === 'financial'
          ? 'financial_permission_denied'
          : 'permission_denied',
      );
    }

    if (!serializedArguments || serializedArguments.length > 5_000) {
      throw new AIServiceError('invalid_tool_arguments');
    }

    let rawInput: unknown;
    try {
      rawInput = JSON.parse(serializedArguments);
    } catch {
      throw new AIServiceError('invalid_tool_arguments');
    }

    if (containsForbiddenKey(rawInput)) {
      throw new AIServiceError('invalid_tool_arguments');
    }

    const input = definition.parseInput(rawInput);
    const result = await definition.execute(environment, input);
    const validatedOutput = definition.validateOutput(result.output);

    if (
      result.metadata.toolName !== definition.name ||
      result.metadata.recordCount < 0 ||
      result.metadata.recordCount > definition.maxResults ||
      containsForbiddenKey(validatedOutput)
    ) {
      throw new AIServiceError('tool_query_failed');
    }

    return { output: validatedOutput, metadata: result.metadata };
  }
}

