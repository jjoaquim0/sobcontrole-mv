export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => variables[key] ?? '');
}
