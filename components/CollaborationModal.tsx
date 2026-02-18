
import React, { useRef, useState } from 'react';
import { FamilyMember } from '../types';
import { Download, Upload, Users, Merge, FileJson, Check, ArrowRight, Cloud } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentMembers: FamilyMember[];
  onMerge: (newMembers: FamilyMember[]) => void;
}

const CollaborationModal: React.FC<Props> = ({ isOpen, onClose, currentMembers, onMerge }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mergeStats, setMergeStats] = useState<{ added: number; updated: number; total: number } | null>(null);
  const [previewMembers, setPreviewMembers] = useState<FamilyMember[] | null>(null);

  if (!isOpen) return null;

  const handleDownloadSnapshot = () => {
    const data = JSON.stringify(currentMembers, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `family_tree_snapshot_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        let importedData: FamilyMember[] = [];

        if (file.name.endsWith('.json')) {
          importedData = JSON.parse(content);
        } else {
          alert("目前僅支援 JSON 格式專案檔。");
          return;
        }

        if (!Array.isArray(importedData)) throw new Error("無效的資料格式");

        // Analyze Merge
        let added = 0;
        let updated = 0;
        const currentIds = new Set(currentMembers.map(m => m.id));

        importedData.forEach(m => {
          if (m.id === 'virtual_root') return;
          if (currentIds.has(m.id)) {
            updated++;
          } else {
            added++;
          }
        });

        setMergeStats({ added, updated, total: importedData.length });
        setPreviewMembers(importedData);

      } catch (err) {
        alert("讀取檔案失敗，請確認檔案格式正確。");
        console.error(err);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmMerge = () => {
    if (previewMembers) {
      onMerge(previewMembers);
      setMergeStats(null);
      setPreviewMembers(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col relative animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-heritage-green text-white p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full">
              <Users size={24} className="text-heritage-gold" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold">資料匯入/匯出</h2>
              <p className="text-heritage-cream/70 text-sm">備份或還原家族資料</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex gap-4 items-start">
            <Cloud className="text-blue-500 shrink-0 mt-1" size={20} />
            <div className="text-sm text-gray-600 space-y-1">
              <p className="font-bold text-gray-800">雲端模式已啟用</p>
              <p>
                您的所有變更都會自動儲存至雲端資料庫。
                此處功能僅供手動「備份下載」或「大量匯入」歷史檔案使用。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export */}
            <div className="border border-stone-200 rounded-xl p-5 hover:border-heritage-gold/50 transition bg-white shadow-sm flex flex-col">
              <div className="mb-4 bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center text-blue-600">
                <Download size={24} />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">下載備份</h3>
              <p className="text-sm text-gray-500 mb-6 flex-1">
                將目前的最新資料匯出為 JSON 檔案，以供離線保存或轉移。
              </p>
              <button 
                onClick={handleDownloadSnapshot}
                className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-gray-700 font-medium rounded-lg transition flex items-center justify-center gap-2"
              >
                <Download size={16} /> 下載檔案
              </button>
            </div>

            {/* Import/Merge */}
            <div className="border border-stone-200 rounded-xl p-5 hover:border-heritage-gold/50 transition bg-white shadow-sm flex flex-col">
               <div className="mb-4 bg-green-50 w-12 h-12 rounded-full flex items-center justify-center text-green-600">
                <Merge size={24} />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">匯入還原</h3>
              <p className="text-sm text-gray-500 mb-6 flex-1">
                讀取 JSON 備份檔並合併至目前的雲端資料庫中。
              </p>
              <label className="w-full py-2.5 bg-heritage-green hover:bg-green-800 text-white font-medium rounded-lg transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-green-100">
                <Upload size={16} /> 選擇檔案
                <input 
                  type="file" 
                  accept=".json" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>

          {/* Merge Preview State */}
          {mergeStats && (
            <div className="animate-in slide-in-from-bottom-5 fade-in duration-300 bg-heritage-cream/30 border border-heritage-gold rounded-xl p-5">
              <h3 className="font-bold text-heritage-brown mb-4 flex items-center gap-2">
                <FileJson size={20}/> 準備匯入
              </h3>
              <div className="flex items-center gap-8 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">+{mergeStats.added}</div>
                  <div className="text-xs text-gray-500 uppercase font-medium">新增成員</div>
                </div>
                <div className="text-gray-300"><ArrowRight /></div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{mergeStats.updated}</div>
                  <div className="text-xs text-gray-500 uppercase font-medium">更新資料</div>
                </div>
                 <div className="text-gray-300"><ArrowRight /></div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800">{currentMembers.length + mergeStats.added}</div>
                  <div className="text-xs text-gray-500 uppercase font-medium">匯入後總數</div>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setMergeStats(null); setPreviewMembers(null); }}
                  className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 font-medium transition"
                >
                  取消
                </button>
                <button 
                  onClick={confirmMerge}
                  className="flex-1 py-2 rounded-lg bg-heritage-gold text-white hover:bg-yellow-600 font-medium transition flex items-center justify-center gap-2 shadow-md"
                >
                  <Check size={18} /> 確認匯入
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default CollaborationModal;
