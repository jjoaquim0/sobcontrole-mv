import { z } from 'zod';
import { isSafeHttpsUrl } from './peopleDocsDomain';

const httpsUrl = (message: string) => z.string().trim().min(1, message).refine(isSafeHttpsUrl, 'Use um link que comece com https://.');
const optionalHttpsUrl = z.string().trim().optional().refine((value) => !value || isSafeHttpsUrl(value), 'Use um link que comece com https://.');
const integerText = (min: number, max: number, message: string) =>
  z.string().trim().optional().refine((value) => !value || (/^\d+$/.test(value) && Number(value) >= min && Number(value) <= max), message);

export const requirementSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do documento.').max(120, 'Use até 120 caracteres.'),
  description: z.string().trim().max(1000, 'Use até 1.000 caracteres.').optional(),
  target: z.enum(['employee', 'contract']),
  contractId: z.string().optional(),
  postId: z.string().optional(),
  validityMonths: integerText(1, 120, 'Informe de 1 a 120 meses, ou deixe em branco.'),
  isActive: z.boolean(),
}).refine((values) => !values.postId || (values.target === 'employee' && Boolean(values.contractId)), {
  path: ['postId'], message: 'Escolha o contrato antes do posto.',
});

export const submissionSchema = z.object({
  documentUrl: httpsUrl('Cole o link do documento no Drive.'),
  issuedOn: z.string().optional(),
  expiresOn: z.string().optional(),
  notes: z.string().trim().max(1000, 'Use até 1.000 caracteres.').optional(),
}).refine((values) => !values.issuedOn || !values.expiresOn || values.expiresOn >= values.issuedOn, {
  path: ['expiresOn'], message: 'A validade deve ser igual ou posterior à emissão.',
});

export const absenceSchema = z.object({
  employeeId: z.string().min(1, 'Selecione o funcionário.'),
  kind: z.enum(['vacation', 'medical_leave', 'leave', 'other']),
  startDate: z.string().min(1, 'Informe o início.'),
  endDate: z.string().min(1, 'Informe o fim.'),
  notes: z.string().trim().max(500, 'Use até 500 caracteres.').optional(),
}).refine((values) => !values.startDate || !values.endDate || values.endDate >= values.startDate, {
  path: ['endDate'], message: 'O fim deve ser igual ou posterior ao início.',
});

export const deliverySchema = z.object({
  employeeId: z.string().min(1, 'Selecione o funcionário.'),
  postId: z.string().optional(),
  category: z.enum(['uniform', 'ppe']),
  itemName: z.string().trim().min(2, 'Informe o item entregue.').max(120, 'Use até 120 caracteres.'),
  quantity: z.string().trim().refine((value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 100, 'Informe de 1 a 100.'),
  size: z.string().trim().max(20, 'Use até 20 caracteres.').optional(),
  caNumber: z.string().trim().max(30, 'Use até 30 caracteres.').optional(),
  deliveredOn: z.string().min(1, 'Informe a data da entrega.'),
  replaceBy: z.string().optional(),
  evidenceUrl: optionalHttpsUrl,
  notes: z.string().trim().max(500, 'Use até 500 caracteres.').optional(),
})
  .refine((values) => values.category !== 'ppe' || Boolean(values.caNumber?.trim()), {
    path: ['caNumber'], message: 'Informe o número do CA do EPI.',
  })
  .refine((values) => !values.replaceBy || !values.deliveredOn || values.replaceBy >= values.deliveredOn, {
    path: ['replaceBy'], message: 'A troca deve ser igual ou posterior à entrega.',
  });

export const returnSchema = z.object({
  returnedOn: z.string().min(1, 'Informe a data da devolução.'),
  note: z.string().trim().max(500, 'Use até 500 caracteres.').optional(),
});

export const reviewRejectSchema = z.object({
  note: z.string().trim().min(3, 'Explique o motivo da recusa.').max(500, 'Use até 500 caracteres.'),
});
