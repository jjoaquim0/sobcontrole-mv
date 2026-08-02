export const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value ?? 0);

export const formatCompactCurrency = (value?: number | null) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value ?? 0);

export const formatNumber = (value?: number | null, maximumFractionDigits = 0) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits }).format(value ?? 0);

export const formatPercentage = (value?: number | null) =>
  `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value ?? 0)}%`;

export const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(dateStr));
};

export const formatDateTime = (dateStr?: string | null) => {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
};
