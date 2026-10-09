import { z } from 'zod';
import { isSafeHttpsUrl } from './contractsDomain';

export const contractSchema = z.object({
  customerId: z.string().optional(),
  clientName: z.string().trim().min(2, 'Informe o cliente (tomador do serviço).'),
  title: z.string().trim().min(2, 'Informe um título para o contrato.'),
  contractNumber: z.string().trim().max(80, 'Use até 80 caracteres.').optional(),
  location: z.string().trim().max(200, 'Use até 200 caracteres.').optional(),
  scopeSummary: z.string().trim().max(2000, 'Use até 2.000 caracteres.').optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  cctReference: z.string().trim().max(200, 'Use até 200 caracteres.').optional(),
  sourceDocumentsUrl: z.string().trim().optional().refine((value) => !value || isSafeHttpsUrl(value), 'Use um link que comece com https://.'),
  validationStatus: z.enum(['pending', 'confirmed', 'historical']),
  status: z.enum(['draft', 'active', 'suspended', 'closed']),
  internalNotes: z.string().trim().max(2000, 'Use até 2.000 caracteres.').optional(),
})
  .refine((values) => !values.startDate || !values.endDate || values.endDate >= values.startDate, {
    path: ['endDate'], message: 'A data final deve ser igual ou posterior à data inicial.',
  })
  .refine((values) => values.status !== 'active' || values.validationStatus === 'confirmed', {
    path: ['status'], message: 'Para deixar o contrato ativo, marque a vigência como conferida.',
  });

export const versionSchema = z.object({
  kind: z.enum(['original', 'amendment']),
  title: z.string().trim().min(2, 'Informe o título da versão.'),
  signedAt: z.string().optional(),
  effectiveStart: z.string().optional(),
  effectiveEnd: z.string().optional(),
  documentUrl: z.string().trim().optional().refine((value) => !value || isSafeHttpsUrl(value), 'Use um link que comece com https://.'),
  changeSummary: z.string().trim().max(2000, 'Use até 2.000 caracteres.').optional(),
  validationStatus: z.enum(['pending', 'confirmed', 'historical']),
}).refine((values) => !values.effectiveStart || !values.effectiveEnd || values.effectiveEnd >= values.effectiveStart, {
  path: ['effectiveEnd'], message: 'A data final deve ser igual ou posterior à data inicial.',
});

export const postSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do posto.'),
  jobFunction: z.string().trim().min(2, 'Informe a função.'),
  workSchedule: z.string().trim().min(2, 'Informe a escala.'),
  requiredHeadcount: z.coerce.number({ invalid_type_error: 'Informe o quantitativo.' })
    .int('Use um número inteiro.').min(1, 'Mínimo de 1 pessoa.').max(500, 'Máximo de 500 pessoas.'),
  operationalManagerId: z.string().optional(),
  requirements: z.string().trim().max(2000, 'Use até 2.000 caracteres.').optional(),
  status: z.enum(['active', 'inactive']),
});

export const allocationSchema = z.object({
  employeeId: z.string().min(1, 'Selecione o funcionário.'),
  allocationRole: z.enum(['holder', 'substitute']),
  startDate: z.string().min(1, 'Informe a data de início.'),
  notes: z.string().trim().max(1000, 'Use até 1.000 caracteres.').optional(),
});

export const endAllocationSchema = z.object({
  endDate: z.string().min(1, 'Informe a data de encerramento.'),
  endReason: z.string().trim().min(3, 'Informe o motivo do encerramento.').max(500, 'Use até 500 caracteres.'),
});

export const transferSchema = z.object({
  toPostId: z.string().min(1, 'Selecione o posto de destino.'),
  transferDate: z.string().min(1, 'Informe a data da transferência.'),
  reason: z.string().trim().min(3, 'Informe o motivo da transferência.').max(500, 'Use até 500 caracteres.'),
});
