import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { BiModuleCard } from './BiModuleCard';
import { AnalyticsModuleWithAccess } from '../../../hooks/useAnalyticsModules';
import { BiModuleContent } from '../biModulesContent';
import { AnalyticsModuleAccessStatus } from '../../../types';

const baseModule: Omit<AnalyticsModuleWithAccess, 'accessStatus'> = {
  id: '1',
  key: 'sales_analytics',
  name: 'Analytics de Vendas',
  category: 'vendas',
  minPlan: 'enterprise',
  isAddon: true,
  isComingSoon: false,
  isActive: true,
  routePath: '/relatorios/vendas-pipeline',
  displayOrder: 1,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const content: BiModuleContent = {
  description: 'Funil de vendas, conversão por etapa e previsão de receita.',
  benefits: ['Benefício 1', 'Benefício 2', 'Benefício 3'],
  metrics: ['Funil de vendas', 'Ticket médio'],
  icon: Sparkles,
};

const renderCard = (accessStatus: AnalyticsModuleAccessStatus, overrides: Partial<AnalyticsModuleWithAccess> = {}) => {
  const onUnlock = vi.fn();
  render(
    <MemoryRouter>
      <BiModuleCard module={{ ...baseModule, ...overrides, accessStatus }} content={content} onUnlock={onUnlock} />
    </MemoryRouter>
  );
  return { onUnlock };
};

describe('BiModuleCard', () => {
  it('estado "available": mostra badge Disponível e CTA "Acessar análise"', () => {
    renderCard('available');
    expect(screen.getByText('Disponível')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /acessar análise/i })).toBeInTheDocument();
    expect(screen.queryByText('Recurso premium')).not.toBeInTheDocument();
  });

  it('estado "contracted": mostra badge Contratado e CTA "Acessar análise"', () => {
    renderCard('contracted');
    expect(screen.getByText('Contratado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /acessar análise/i })).toBeInTheDocument();
  });

  it('estado "coming_soon": mostra "Em breve" e nenhum CTA de ação', () => {
    renderCard('coming_soon');
    expect(screen.getAllByText('Em breve').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /acessar análise/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /desbloquear módulo|conhecer plano/i })).not.toBeInTheDocument();
  });

  it('estado "locked" com is_addon=true: mostra selo Recurso premium e CTA "Desbloquear módulo", chamando onUnlock ao clicar', () => {
    const { onUnlock } = renderCard('locked', { isAddon: true });
    expect(screen.getByText('Recurso premium')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /desbloquear módulo/i });
    fireEvent.click(button);
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('estado "locked" com is_addon=false: mostra CTA "Conhecer plano"', () => {
    renderCard('locked', { isAddon: false });
    expect(screen.getByRole('button', { name: /conhecer plano/i })).toBeInTheDocument();
  });
});
