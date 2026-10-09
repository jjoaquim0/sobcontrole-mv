import { supabase } from '@/lib/supabase';
import { assertPeopleCompany } from '@/services/peopleService';
import { allocateEmployee, contractErrorMessage, savePost } from '@/services/contractsService';
import { saveObligationTemplate } from '@/services/obligationsService';
import type { ImportReferences, PlannedAction } from '@/pages/initialImport/importDomain';

export const getImportReferences = async (): Promise<ImportReferences> => {
  const companyId = assertPeopleCompany();
  const today = new Date().toISOString().slice(0, 10);
  const [contracts, posts, employees, allocations, templates] = await Promise.all([
    supabase.from('service_contracts').select('id, title, contract_number, status').eq('company_id', companyId).is('deleted_at', null),
    supabase.from('service_posts').select('id, contract_id, name').eq('company_id', companyId),
    supabase.from('employees').select('id, full_name, status').eq('company_id', companyId).is('deleted_at', null),
    supabase.from('service_post_allocations').select('post_id, employee_id').eq('company_id', companyId).or(`end_date.is.null,end_date.gte.${today}`),
    supabase.from('service_obligation_templates').select('name, contract_id').eq('company_id', companyId),
  ]);
  const failed = [contracts, posts, employees, allocations, templates].find((response) => response.error);
  if (failed) throw new Error(contractErrorMessage(failed.error, 'Não foi possível carregar os cadastros para conferir o arquivo.'));
  return {
    contracts: ((contracts.data || []) as { id: string; title: string; contract_number?: string | null; status: string }[])
      .map((row) => ({ id: row.id, title: row.title, contractNumber: row.contract_number || undefined, status: row.status })),
    posts: ((posts.data || []) as { id: string; contract_id: string; name: string }[]).map((row) => ({ id: row.id, contractId: row.contract_id, name: row.name })),
    employees: ((employees.data || []) as { id: string; full_name: string; status: string }[]).map((row) => ({ id: row.id, fullName: row.full_name, status: row.status })),
    openAllocations: ((allocations.data || []) as { post_id: string; employee_id: string }[]).map((row) => ({ postId: row.post_id, employeeId: row.employee_id })),
    templates: ((templates.data || []) as { name: string; contract_id?: string | null }[]).map((row) => ({ name: row.name, contractId: row.contract_id || undefined })),
  };
};

/** Grava uma linha pelas mesmas RPCs das telas: as regras do banco valem para a importação. */
export const runImportAction = async (action: PlannedAction): Promise<void> => {
  if (action.kind === 'post') await savePost(action.contractId, action.input);
  else if (action.kind === 'allocation') await allocateEmployee({ postId: action.postId, employeeId: action.employeeId, allocationRole: action.allocationRole, startDate: action.startDate, notes: 'Importado na carga inicial' });
  else await saveObligationTemplate(action.input);
};
