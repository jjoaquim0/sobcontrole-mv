import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  allocateEmployee,
  AllocationInput,
  ContractFilters,
  ContractInput,
  ContractVersionInput,
  endAllocation,
  EndAllocationInput,
  getContractDetails,
  getContracts,
  PostInput,
  saveContract,
  saveContractVersion,
  savePost,
} from '@/services/contractsService';

const onError = (error: Error) => toast.error(error.message);

export const useContracts = (filters: ContractFilters = {}) => {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['contracts', 'list', filters], queryFn: () => getContracts(filters) });
  const save = useMutation({
    mutationFn: ({ input, id }: { input: ContractInput; id?: string }) => saveContract(input, id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success(variables.id ? 'Contrato atualizado com sucesso.' : 'Contrato cadastrado com sucesso.');
    },
    onError,
  });
  return {
    contracts: list.data || [],
    isLoading: list.isLoading,
    isError: list.isError,
    refetch: list.refetch,
    saveContract: save.mutateAsync,
    isSaving: save.isPending,
  };
};

export const useContractDetails = (id: string) => {
  const queryClient = useQueryClient();
  const details = useQuery({
    queryKey: ['contracts', 'detail', id],
    queryFn: () => getContractDetails(id),
    enabled: Boolean(id),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contracts'] });

  const contract = useMutation({
    mutationFn: (input: ContractInput) => saveContract(input, id),
    onSuccess: () => { invalidate(); toast.success('Contrato atualizado com sucesso.'); },
    onError,
  });
  const version = useMutation({
    mutationFn: ({ input, versionId }: { input: ContractVersionInput; versionId?: string }) => saveContractVersion(id, input, versionId),
    onSuccess: (_, variables) => { invalidate(); toast.success(variables.versionId ? 'Versão atualizada.' : 'Versão registrada.'); },
    onError,
  });
  const post = useMutation({
    mutationFn: ({ input, postId }: { input: PostInput; postId?: string }) => savePost(id, input, postId),
    onSuccess: (_, variables) => { invalidate(); toast.success(variables.postId ? 'Posto atualizado.' : 'Posto cadastrado.'); },
    onError,
  });
  const allocate = useMutation({
    mutationFn: (input: AllocationInput) => allocateEmployee(input),
    onSuccess: () => { invalidate(); toast.success('Funcionário alocado no posto.'); },
    onError,
  });
  const endAlloc = useMutation({
    mutationFn: (input: EndAllocationInput) => endAllocation(input),
    onSuccess: () => { invalidate(); toast.success('Alocação encerrada.'); },
    onError,
  });

  return {
    details,
    saveContract: contract.mutateAsync,
    isSavingContract: contract.isPending,
    saveVersion: version.mutateAsync,
    isSavingVersion: version.isPending,
    savePost: post.mutateAsync,
    isSavingPost: post.isPending,
    allocateEmployee: allocate.mutateAsync,
    isAllocating: allocate.isPending,
    endAllocation: endAlloc.mutateAsync,
    isEndingAllocation: endAlloc.isPending,
  };
};
