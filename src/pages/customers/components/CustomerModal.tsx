import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Search, MapPin } from 'lucide-react';
import { Customer } from '../../../types';
import { toast } from 'sonner';

// Validadores estritos de CPF e CNPJ
const validateCPF = (cpf: string) => {
  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCpf.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCpf.charAt(10))) return false;

  return true;
};

const validateCNPJ = (cnpj: string) => {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleanCnpj)) return false;

  let size = cleanCnpj.length - 2;
  let numbers = cleanCnpj.substring(0, size);
  const digits = cleanCnpj.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = cleanCnpj.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
};

// Zod Schema
const customerSchema = z.object({
  fullName: z.string().min(3, 'O nome deve conter pelo menos 3 caracteres'),
  document: z.string()
    .min(1, 'O documento (CPF ou CNPJ) é obrigatório')
    .refine((val) => {
      const clean = val.replace(/\D/g, '');
      if (clean.length === 11) return validateCPF(clean);
      if (clean.length === 14) return validateCNPJ(clean);
      return false;
    }, 'CPF ou CNPJ inválido (verifique os dígitos verificadores)'),
  email: z.string().optional().or(z.literal('')).refine(
    (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    'Formato de e-mail inválido'
  ),
  phone: z.string().optional().or(z.literal('')),
  cep: z.string().optional().or(z.literal('')),
  logradouro: z.string().optional().or(z.literal('')),
  number: z.string().optional().or(z.literal('')),
  complement: z.string().optional().or(z.literal('')),
  bairro: z.string().optional().or(z.literal('')),
  cidade: z.string().optional().or(z.literal('')),
  estado: z.string().optional().or(z.literal('')),
});

type CustomerForm = z.infer<typeof customerSchema>;

export interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer; // Se fornecido, modo edição
  onSave: (data: any) => Promise<void>;
  isLoading?: boolean;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSave,
  isLoading = false,
}) => {
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      fullName: '',
      document: '',
      email: '',
      phone: '',
      cep: '',
      logradouro: '',
      number: '',
      complement: '',
      bairro: '',
      cidade: '',
      estado: '',
    },
  });

  // Preencher formulário em caso de edição
  useEffect(() => {
    if (customer && isOpen) {
      let addr = { cep: '', logradouro: '', number: '', complement: '', bairro: '', cidade: '', estado: '' };
      try {
        if (customer.address) {
          addr = JSON.parse(customer.address);
        }
      } catch (e) {
        addr.logradouro = customer.address; // Fallback se for string pura
      }

      reset({
        fullName: customer.fullName,
        document: customer.document,
        email: customer.email || '',
        phone: customer.phone || '',
        cep: addr.cep || '',
        logradouro: addr.logradouro || '',
        number: addr.number || '',
        complement: addr.complement || '',
        bairro: addr.bairro || '',
        cidade: addr.cidade || '',
        estado: addr.estado || '',
      });
    } else if (!customer && isOpen) {
      reset({
        fullName: '',
        document: '',
        email: '',
        phone: '',
        cep: '',
        logradouro: '',
        number: '',
        complement: '',
        bairro: '',
        cidade: '',
        estado: '',
      });
    }
  }, [customer, isOpen, reset]);

  // Máscara dinâmica de CPF e CNPJ
  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 14) val = val.slice(0, 14);

    if (val.length <= 11) {
      val = val.replace(/(\d{3})(\d)/, '$1.$2');
      val = val.replace(/(\d{3})(\d)/, '$1.$2');
      val = val.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      val = val.replace(/^(\d{2})(\d)/, '$1.$2');
      val = val.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
      val = val.replace(/\.(\d{3})(\d)/, '.$1/$2');
      val = val.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
    setValue('document', val, { shouldValidate: true });
  };

  // Máscara de Telefone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 11) val = val.slice(0, 11);

    if (val.length > 10) {
      val = val.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (val.length > 5) {
      val = val.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    } else if (val.length > 2) {
      val = val.replace(/^(\d{2})(\d)/, '($1) $2');
    } else if (val.length > 0) {
      val = val.replace(/^(\d)/, '($1');
    }
    setValue('phone', val, { shouldValidate: true });
  };

  // Máscara de CEP
  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);

    if (val.length > 5) {
      val = val.replace(/^(\d{5})(\d)/, '$1-$2');
    }
    setValue('cep', val, { shouldValidate: true });
  };

  // Integração ViaCEP no onBlur
  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const rawCep = e.target.value.replace(/\D/g, '');
    if (!rawCep) return;
    
    if (rawCep.length !== 8) {
      setCepError('CEP deve conter 8 dígitos');
      return;
    }

    setCepError(null);
    setIsSearchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
      const data = await res.json();

      if (data.erro) {
        setCepError('CEP não encontrado');
      } else {
        setValue('logradouro', data.logradouro || '');
        setValue('bairro', data.bairro || '');
        setValue('cidade', data.localidade || '');
        setValue('estado', data.uf || '');
        // UX Detail: Focar no campo "Número" automaticamente
        document.getElementById('addr-number')?.focus();
      }
    } catch (err) {
      setCepError('Erro de conexão ao pesquisar CEP');
    } finally {
      setIsSearchingCep(false);
    }
  };

  const onSubmit = async (formValues: CustomerForm) => {
    const addressObj = {
      cep: formValues.cep,
      logradouro: formValues.logradouro,
      number: formValues.number,
      complement: formValues.complement,
      bairro: formValues.bairro,
      cidade: formValues.cidade,
      estado: formValues.estado,
    };

    const payload = {
      fullName: formValues.fullName,
      document: formValues.document,
      email: formValues.email,
      phone: formValues.phone,
      address: JSON.stringify(addressObj),
    };

    await onSave(payload);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isLoading ? undefined : onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm"
          />

          {/* Container Dialog */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-lg z-10 max-h-[90vh] overflow-y-auto transition-colors duration-300"
          >
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {customer ? 'Editar Cliente' : 'Novo Cliente'}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  {customer ? 'Atualize as informações cadastrais' : 'Cadastre um novo cliente multi-tenant'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              
              {/* Grid de Contato */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Nome Completo */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Nome Completo / Razão Social *
                  </label>
                  <input
                    type="text"
                    placeholder="Nome completo do cliente"
                    {...register('fullName')}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                  />
                  {errors.fullName && (
                    <p className="text-xs text-red-500 font-medium">{errors.fullName.message}</p>
                  )}
                </div>

                {/* Documento */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    CPF ou CNPJ *
                  </label>
                  <input
                    type="text"
                    placeholder="000.000.000-00 / 00.000.000/0000-00"
                    {...register('document')}
                    onChange={handleDocumentChange}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                  />
                  {errors.document && (
                    <p className="text-xs text-red-500 font-medium">{errors.document.message}</p>
                  )}
                </div>

                {/* Telefone */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Telefone
                  </label>
                  <input
                    type="text"
                    placeholder="(00) 90000-0000"
                    {...register('phone')}
                    onChange={handlePhoneChange}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                  />
                </div>

                {/* E-mail */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    E-mail
                  </label>
                  <input
                    type="text"
                    placeholder="email@cliente.com"
                    {...register('email')}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Seção Endereço */}
              <div className="border-t border-gray-100 dark:border-white/5 pt-4 mt-2">
                <div className="flex items-center gap-1.5 mb-3 text-gray-700 dark:text-gray-300">
                  <MapPin className="w-4 h-4 text-[#10b981]" />
                  <span className="text-xs font-bold uppercase tracking-wider">Endereço de Faturamento</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* CEP */}
                  <div className="space-y-1 relative">
                    <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                      CEP
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="00000-000"
                        {...register('cep')}
                        onChange={handleCepChange}
                        onBlur={handleCepBlur}
                        className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                      />
                      {isSearchingCep && (
                        <span className="absolute inset-y-0 right-3 flex items-center">
                          <Loader2 className="w-4 h-4 text-[#10b981] animate-spin" />
                        </span>
                      )}
                    </div>
                    {cepError && (
                      <p className="text-[10px] text-red-500 font-semibold">{cepError}</p>
                    )}
                  </div>

                  {/* Logradouro */}
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                      Logradouro
                    </label>
                    <input
                      type="text"
                      placeholder="Rua, Avenida..."
                      {...register('logradouro')}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                    />
                  </div>

                  {/* Número */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                      Número
                    </label>
                    <input
                      type="text"
                      id="addr-number"
                      placeholder="Ex: 123"
                      {...register('number')}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                    />
                  </div>

                  {/* Bairro */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                      Bairro
                    </label>
                    <input
                      type="text"
                      placeholder="Bairro"
                      {...register('bairro')}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                    />
                  </div>

                  {/* Complemento */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                      Complemento
                    </label>
                    <input
                      type="text"
                      placeholder="Sala, Apto..."
                      {...register('complement')}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                    />
                  </div>

                  {/* Cidade */}
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                      Cidade
                    </label>
                    <input
                      type="text"
                      placeholder="Cidade"
                      {...register('cidade')}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                    />
                  </div>

                  {/* Estado */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                      Estado
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: SP"
                      {...register('estado')}
                      maxLength={2}
                      className="w-full px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200 uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-white/5 pt-4 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoading ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>

            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
