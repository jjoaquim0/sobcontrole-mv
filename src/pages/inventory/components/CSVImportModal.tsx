import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';
import { CSVImportResult } from '../../../services/inventoryService';

export interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<CSVImportResult>;
  isLoading?: boolean;
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  isLoading = false,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CSVImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset states
  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setPreviewRows([]);
      setPreviewHeaders([]);
      setProgress(0);
      setResult(null);
    }
  }, [isOpen]);

  // Handle fake animated progress bar
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(interval);
            return 95;
          }
          return prev + Math.floor(Math.random() * 15) + 5;
        });
      }, 150);
    } else if (!isLoading && progress > 0) {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // CSV template file link generator
  const getCsvTemplateUri = () => {
    const csvContent = 
      'nome,descricao,sku,preco_custo,preco_venda,quantidade_atual,quantidade_minima,unidade,categoria\n' +
      'Teclado Gamer Mecânico,Teclado mecânico RGB Switch Blue,SKU-TCGMR01,120.00,249.90,15,3,Unidade,Eletrônicos\n' +
      'Mouse Sem Fio Office,Mouse óptico recarregável bluetooth,SKU-MSEG02,45.50,95.00,20,5,Unidade,Eletrônicos\n' +
      'Cadeira Gamer Racer,Cadeira reclinável com almofadas lombar e cervical,SKU-CADGAM,680.00,1199.00,5,2,Unidade,Mobiliário';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    return URL.createObjectURL(blob);
  };

  // Drag and Drop triggers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const parseFilePreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length === 0) return;

      const separator = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(separator).map(h => h.trim().replace(/^["']|["']$/g, ''));
      
      const rows = lines.slice(1, 6).map(line => {
        let fields: string[] = [];
        let insideQuotes = false;
        let currentField = '';

        for (let charIdx = 0; charIdx < line.length; charIdx++) {
          const char = line[charIdx];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === separator && !insideQuotes) {
            fields.push(currentField.trim().replace(/^["']|["']$/g, ''));
            currentField = '';
          } else {
            currentField += char;
          }
        }
        fields.push(currentField.trim().replace(/^["']|["']$/g, ''));
        return fields;
      });

      setPreviewHeaders(headers);
      setPreviewRows(rows);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        setSelectedFile(file);
        parseFilePreview(file);
      } else {
        toast.error('Por favor, selecione apenas arquivos CSV.');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith('.csv')) {
        setSelectedFile(file);
        parseFilePreview(file);
      } else {
        toast.error('Por favor, selecione apenas arquivos CSV.');
      }
    }
  };

  const handleImportClick = async () => {
    if (!selectedFile) return;
    try {
      const importResult = await onImport(selectedFile);
      setResult(importResult);
    } catch (e) {
      toast.error('Erro técnico ao processar importação.');
    }
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
            className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-2xl z-10 max-h-[90vh] overflow-y-auto transition-colors duration-300"
          >
            
            {/* Header */}
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Upload className="w-5 h-5 text-[#10b981]" />
                <h3 className="text-lg font-bold">Importar Produtos via CSV</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              
              {!selectedFile && !result && (
                <>
                  {/* Instructions and Download Template */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200/50 dark:border-white/5 gap-3">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Instruções de Importação</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Certifique-se de que seu arquivo CSV possui as colunas estruturadas.</p>
                    </div>
                    <a
                      href={getCsvTemplateUri()}
                      download="modelo_estoque_gestly.csv"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#10b981] border border-gray-200 dark:border-white/10 hover:bg-[#10b981]/10 rounded-xl transition-all duration-200 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" /> Modelo CSV
                    </a>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                      dragActive
                        ? 'border-[#10b981] bg-[#10b981]/5'
                        : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept=".csv"
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 text-[#10b981]">
                      <Upload className="w-6 h-6 animate-pulse" />
                    </div>
                    <h5 className="text-sm font-bold text-gray-800 dark:text-gray-200">Arraste seu arquivo CSV ou clique para selecionar</h5>
                    <p className="text-xs text-gray-400 mt-1">Apenas arquivos com extensão .csv são suportados</p>
                  </div>
                </>
              )}

              {selectedFile && !result && (
                <div className="space-y-4">
                  {/* Selected File Banner */}
                  <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200/50 dark:border-white/5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-8 h-8 text-[#10b981] shrink-0" />
                      <div className="min-w-0">
                        <h5 className="text-sm font-bold text-gray-900 dark:text-white truncate">{selectedFile.name}</h5>
                        <p className="text-xs text-gray-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    {!isLoading && (
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="text-gray-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-xl transition-all duration-200"
                      >
                        <X className="w-4.5 h-4.5" />
                      </button>
                    )}
                  </div>

                  {/* CSV Header and Rows Preview */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pré-visualização (Primeiras 5 linhas)</span>
                    <div className="border border-gray-100 dark:border-white/5 rounded-xl overflow-x-auto bg-gray-50 dark:bg-white/5">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200/60 dark:border-white/5 text-[10px] uppercase font-bold tracking-wider text-gray-400">
                            {previewHeaders.map((h, i) => (
                              <th key={i} className="px-3 py-2 shrink-0">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="border-b border-gray-200/20 dark:border-white/5 text-xs text-gray-700 dark:text-gray-300">
                              {row.map((cell, cellIdx) => (
                                <td key={cellIdx} className="px-3 py-2 max-w-[150px] truncate">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Loading State Progress Bar */}
                  {isLoading && (
                    <div className="space-y-2 mt-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 text-[#10b981] animate-spin" /> Processando inserção em lote...
                        </span>
                        <span className="font-bold text-[#10b981]">{progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-[#10b981]"
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {result && (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Success Banner */}
                  {result.success > 0 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Importação Concluída</h4>
                        <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                          {result.success} produtos foram adicionados com sucesso ao estoque da empresa.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Errors Summary Banner */}
                  {result.errors.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-2 flex flex-col">
                      <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-red-700 dark:text-red-400">
                            Algumas linhas apresentaram erros ({result.errors.length})
                          </h4>
                          <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                            Os seguintes problemas foram identificados e impediram o cadastro desses itens específicos:
                          </p>
                        </div>
                      </div>
                      
                      {/* Log errors box */}
                      <div className="border border-red-500/10 rounded-lg p-3 max-h-[160px] overflow-y-auto bg-black/5 dark:bg-black/30 font-mono text-[10px] text-red-500 space-y-1.5">
                        {result.errors.map((err, idx) => (
                          <div key={idx} className="flex gap-1.5">
                            <span className="text-red-600/60 dark:text-red-500/60 shrink-0">[{idx + 1}]</span>
                            <span>{err}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Actions Footer */}
            <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-white/5 pt-4 mt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200"
              >
                {result ? 'Fechar' : 'Cancelar'}
              </button>
              
              {!result && selectedFile && (
                <button
                  type="button"
                  onClick={handleImportClick}
                  disabled={isLoading}
                  className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isLoading ? 'Importando...' : 'Iniciar Importação'}
                </button>
              )}
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
