import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Palette, Sun, Moon, Upload, ImageIcon, Check } from 'lucide-react';
import { useThemeStore } from '../../../store/themeStore';
import { useSettings } from '../../../hooks/useSettings';

const COLOR_PRESETS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

const cardClass = 'bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm p-6';
const labelClass = 'text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400';

export const AppearanceTab: React.FC = () => {
  const { theme, setTheme } = useThemeStore();
  const { settings, isLoading, updateSettings, isSavingSettings, uploadLogo, isUploadingLogo } = useSettings();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [primaryColor, setPrimaryColor] = useState('#10b981');
  const [logoPreview, setLogoPreview] = useState<string>('');

  useEffect(() => {
    if (settings) {
      setPrimaryColor(settings.primaryColor || '#10b981');
      setLogoPreview(settings.logoUrl || '');
    }
  }, [settings]);

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    await uploadLogo(file).catch(() => undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    await updateSettings({ primaryColor }).catch(() => undefined);
  };

  const ThemePreview: React.FC<{ mode: 'light' | 'dark'; label: string; icon: React.ReactNode }> = ({
    mode,
    label,
    icon,
  }) => {
    const isActive = theme === mode;
    return (
      <button
        type="button"
        onClick={() => setTheme(mode)}
        className={`flex-1 rounded-2xl border-2 p-3 text-left transition-all duration-200 ${
          isActive
            ? 'border-[#10b981] ring-2 ring-[#10b981]/20'
            : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
        }`}
      >
        <div
          className={`rounded-xl overflow-hidden border ${
            mode === 'light' ? 'bg-[#f0f2f5] border-gray-200' : 'bg-[#0f1117] border-white/10'
          }`}
        >
          <div className={`h-6 flex items-center gap-1 px-2 ${mode === 'light' ? 'bg-white' : 'bg-[#1a1d27]'}`}>
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="p-3 space-y-2">
            <div className={`h-2 w-2/3 rounded ${mode === 'light' ? 'bg-gray-300' : 'bg-white/20'}`} />
            <div className={`h-2 w-1/2 rounded ${mode === 'light' ? 'bg-gray-200' : 'bg-white/10'}`} />
            <div className="h-6 w-16 rounded-lg" style={{ backgroundColor: primaryColor }} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white">
            {icon}
            {label}
          </span>
          {isActive && <Check className="w-4 h-4 text-[#10b981]" />}
        </div>
      </button>
    );
  };

  if (isLoading) {
    return (
      <div className={cardClass}>
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4 mb-6">
          <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            <Palette className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Aparência</h2>
            <p className="text-sm text-gray-500 dark:text-white/50">Tema, logomarca e cor de destaque</p>
          </div>
        </div>

        <label className={labelClass}>Tema da Interface</label>
        <div className="flex flex-col sm:flex-row gap-4 mt-2">
          <ThemePreview mode="light" label="Claro" icon={<Sun className="w-4 h-4" />} />
          <ThemePreview mode="dark" label="Escuro" icon={<Moon className="w-4 h-4" />} />
        </div>
      </div>

      <div className={cardClass}>
        <label className={labelClass}>Logomarca</label>
        <div className="flex items-center gap-5 mt-3">
          <div className="w-20 h-20 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
            {logoPreview ? (
              <img src={logoPreview} alt="Logomarca da empresa" className="w-full h-full object-contain" />
            ) : (
              <ImageIcon className="w-8 h-8 text-gray-300 dark:text-white/20" />
            )}
          </div>
          <div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingLogo}
              className="border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200 disabled:opacity-70"
            >
              {isUploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isUploadingLogo ? 'Enviando...' : 'Enviar Logomarca'}
            </button>
            <p className="text-xs text-gray-500 dark:text-white/50 mt-2">PNG, JPG ou SVG até 2MB.</p>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <label className={labelClass}>Cor Primária</label>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setPrimaryColor(preset)}
              className={`w-10 h-10 rounded-xl transition-transform duration-200 flex items-center justify-center ${
                primaryColor.toLowerCase() === preset.toLowerCase() ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#1a1d27] scale-105' : ''
              }`}
              style={{ backgroundColor: preset, boxShadow: `0 0 0 1px rgba(0,0,0,0.05)` }}
              title={preset}
            >
              {primaryColor.toLowerCase() === preset.toLowerCase() && <Check className="w-4 h-4 text-white" />}
            </button>
          ))}

          <label className="flex items-center gap-2 ml-2 cursor-pointer">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded-xl border border-gray-200 dark:border-white/10 bg-transparent cursor-pointer p-0.5"
            />
            <span className="text-sm font-mono text-gray-600 dark:text-gray-300">{primaryColor.toUpperCase()}</span>
          </label>
        </div>

        <div className="flex justify-end border-t border-gray-100 dark:border-white/5 pt-5 mt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSavingSettings}
            className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-70"
          >
            {isSavingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSavingSettings ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
};
