import { z } from 'zod';
import { MAX_PERIOD_DAYS, periodLengthDays } from './pilotDomain';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.');

export const snapshotSchema = z.object({
  label: z.string().trim().min(1, 'Informe o nome da medição.').max(120, 'Use até 120 caracteres.'),
  kind: z.enum(['baseline', 'checkpoint', 'final']),
  periodFrom: isoDate,
  periodTo: isoDate,
  offlineSteps: z.string().trim().optional().refine((value) => !value || (/^\d+$/.test(value) && Number(value) <= 1000), 'Use um número inteiro de 0 a 1000.'),
  notes: z.string().trim().max(4000, 'Use até 4000 caracteres.').optional(),
  decision: z.enum(['', 'expand', 'adjust', 'pause']).optional(),
}).superRefine((values, ctx) => {
  const length = periodLengthDays(values.periodFrom, values.periodTo);
  if (!Number.isNaN(length) && length < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periodTo'], message: 'A data final deve ser depois da inicial.' });
  if (!Number.isNaN(length) && length > MAX_PERIOD_DAYS) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periodTo'], message: `Use um período de até ${MAX_PERIOD_DAYS} dias.` });
  if (values.kind === 'final' && !values.decision) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['decision'], message: 'Registre a decisão da direção.' });
  if (values.kind === 'final' && !values.notes) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['notes'], message: 'Registre os motivos da decisão.' });
});

export type SnapshotForm = z.infer<typeof snapshotSchema>;
