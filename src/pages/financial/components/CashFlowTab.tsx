import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { useFinancial } from '../../../hooks/useFinancial';
import { ArrowDownCircle, ArrowUpCircle, Loader2, Scale, TrendingUp } from 'lucide-react';

const formatMoney = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const PERIODS: { value: number; label: string }[] = [
  { value: 7, label: 'Últimos 7 dias' },
  { value: 30, label: 'Últimos 30 dias' },
  { value: 90, label: 'Últimos 90 dias' },
];

export const CashFlowTab: React.FC = () => {
  const [days, setDays] = useState(7);

  const { cashFlow, isCashFlowLoading } = useFinancial({
    cashFlowRange: { days },
    enableReceivables: false,
    enablePayables: false,
    enableCategories: false,
  });

  const totalEntradas = cashFlow.reduce((sum, p) => sum + p.entradas, 0);
  const totalSaidas = cashFlow.reduce((sum, p) => sum + p.saidas, 0);
  const saldoFinal = totalEntradas - totalSaidas;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400 font-semibold">
          Entradas e saídas efetivadas (contas quitadas) no período selecionado.
        </p>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-4 py-2.5 pr-8 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer self-start"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Entradas</span>
            <ArrowDownCircle className="w-5 h-5 text-[#10b981]" />
          </div>
          <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{formatMoney(totalEntradas)}</h3>
        </div>
        <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Saídas</span>
            <ArrowUpCircle className="w-5 h-5 text-red-500" />
          </div>
          <h3 className="text-2xl font-bold text-red-500 dark:text-red-400 mt-2">{formatMoney(totalSaidas)}</h3>
        </div>
        <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Saldo</span>
            <Scale className="w-5 h-5 text-blue-500" />
          </div>
          <h3
            className={`text-2xl font-bold mt-2 ${
              saldoFinal >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500 dark:text-red-400'
            }`}
          >
            {formatMoney(saldoFinal)}
          </h3>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-[#10b981]" />
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">Fluxo de Caixa por Período</h4>
        </div>

        {isCashFlowLoading ? (
          <div className="h-72 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#10b981]" />
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlow} margin={{ top: 5, bottom: 5, left: 5, right: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => formatMoney(Number(v))} />
                <Tooltip
                  formatter={(value: number) => formatMoney(Number(value))}
                  contentStyle={{ borderRadius: 12, border: '1px solid rgba(148,163,184,0.2)', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar name="Entradas" dataKey="entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar name="Saídas" dataKey="saidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/5 bg-gray-50/75 dark:bg-white/[0.02]">
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Período</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Entradas</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Saídas</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {cashFlow.map((p) => (
                <tr key={p.date} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-150">
                  <td className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">{p.date}</td>
                  <td className="px-6 py-3 text-sm text-emerald-600 dark:text-emerald-400 font-semibold">{formatMoney(p.entradas)}</td>
                  <td className="px-6 py-3 text-sm text-red-500 dark:text-red-400 font-semibold">{formatMoney(p.saidas)}</td>
                  <td
                    className={`px-6 py-3 text-sm font-bold ${
                      p.saldo >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500 dark:text-red-400'
                    }`}
                  >
                    {formatMoney(p.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CashFlowTab;
