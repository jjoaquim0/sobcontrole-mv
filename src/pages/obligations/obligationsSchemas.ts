import { z } from 'zod';
import { isSafeHttpsUrl } from './obligationsDomain';

const integerText = (min: number, max: number, message: string) =>
  z.string().trim().refine((value) => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max, message);
const optionalHttpsUrl = z.string().trim().optional().refine((value) => !value || isSafeHttpsUrl(value), 'Use um link que comece com https://.');

export const templateSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da obrigação.').max(120, 'Use até 120 caracteres.'),
  description: z.string().trim().max(1000, 'Use até 1.000 caracteres.').optional(),
  contractId: z.string().optional(),
  recurrence: z.enum(['monthly', 'quarterly', 'yearly']),
  referenceMonth: z.string().optional(),
  dueDay: integerText(1, 31, 'Informe um dia de 1 a 31.'),
  dueMonthOffset: z.enum(['0', '1', '2']),
  defaultResponsibleId: z.string().optional(),
  requiresEvidence: z.boolean(),
  isActive: z.boolean(),
}).refine((values) => values.recurrence === 'monthly' || Boolean(values.referenceMonth), {
  path: ['referenceMonth'], message: 'Escolha o mês de referência.',
});

export const itemSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do item.').max(120, 'Use até 120 caracteres.'),
  description: z.string().trim().max(1000, 'Use até 1.000 caracteres.').optional(),
  dueDate: z.string().min(1, 'Informe o prazo.'),
  responsibleId: z.string().optional(),
  requiresEvidence: z.boolean(),
});

export const itemEditSchema = z.object({
  dueDate: z.string().min(1, 'Informe o prazo.'),
  responsibleId: z.string().optional(),
});

export const evidenceSchema = (requiresEvidence: boolean) => z.object({
  evidenceUrl: requiresEvidence
    ? z.string().trim().min(1, 'Cole o link da evidência no Drive.').refine(isSafeHttpsUrl, 'Use um link que comece com https://.')
    : optionalHttpsUrl,
  note: z.string().trim().max(1000, 'Use até 1.000 caracteres.').optional(),
});

export const sendSchema = (today: string) => z.object({
  sentOn: z.string().min(1, 'Informe a data do envio.').refine((value) => value <= today, 'A data do envio não pode ser futura.'),
  sentTo: z.string().trim().min(2, 'Informe para quem o pacote foi enviado.').max(200, 'Use até 200 caracteres.'),
  proofUrl: z.string().trim().min(1, 'Cole o link do comprovante de envio.').refine(isSafeHttpsUrl, 'Use um link que comece com https://.'),
  note: z.string().trim().max(1000, 'Use até 1.000 caracteres.').optional(),
});
