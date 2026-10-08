import { z } from 'zod';
import { isSafeHttpsUrl } from './demandsDomain';

const priority = z.enum(['low', 'normal', 'high', 'urgent']);
const differentPeople = (values: { responsibleId?: string; approverId?: string }) =>
  !values.responsibleId || !values.approverId || values.responsibleId !== values.approverId;
const differentPeopleIssue = { path: ['approverId'], message: 'Responsável e aprovador devem ser pessoas diferentes.' };

export const demandSchema = z.object({
  typeId: z.string().min(1, 'Selecione o tipo de demanda.'),
  title: z.string().trim().min(3, 'Descreva a demanda em poucas palavras.').max(200, 'Use até 200 caracteres.'),
  description: z.string().trim().max(4000, 'Use até 4.000 caracteres.').optional(),
  priority,
  dueDate: z.string().optional(),
  contractId: z.string().optional(),
  postId: z.string().optional(),
  allocationId: z.string().optional(),
  employeeId: z.string().optional(),
  responsibleId: z.string().optional(),
  approverId: z.string().optional(),
}).refine(differentPeople, differentPeopleIssue);

export const demandUpdateSchema = z.object({
  title: z.string().trim().min(3, 'Descreva a demanda em poucas palavras.').max(200, 'Use até 200 caracteres.'),
  description: z.string().trim().max(4000, 'Use até 4.000 caracteres.').optional(),
  priority,
  dueDate: z.string().optional(),
});

export const assignSchema = z.object({
  responsibleId: z.string().optional(),
  approverId: z.string().optional(),
}).refine(differentPeople, differentPeopleIssue);

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Escreva o comentário.').max(4000, 'Use até 4.000 caracteres.'),
});

export const evidenceSchema = z.object({
  label: z.string().trim().min(2, 'Descreva a evidência.').max(200, 'Use até 200 caracteres.'),
  url: z.string().trim().refine((value) => isSafeHttpsUrl(value), 'Use um link que comece com https://.'),
});

export const reasonSchema = z.object({
  reason: z.string().trim().min(3, 'Informe o motivo.').max(1000, 'Use até 1.000 caracteres.'),
});

export const demandTypeSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do tipo.').max(120, 'Use até 120 caracteres.'),
  description: z.string().trim().max(1000, 'Use até 1.000 caracteres.').optional(),
  defaultDueDays: z.union([z.literal(''), z.coerce.number().int('Use um número inteiro.').min(0, 'Mínimo de 0 dias.').max(365, 'Máximo de 365 dias.')]).optional(),
  isActive: z.boolean(),
});

export const stageNameSchema = z.string().trim().min(2, 'Informe o nome da etapa.').max(80, 'Use até 80 caracteres.');
