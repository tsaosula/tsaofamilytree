import React, { useState } from 'react';
import { FamilyMember } from '../types';
import { X, Send, Cloud, Loader2, AlertCircle, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  members: FamilyMember[];
  changeLog: string[];
  scriptUrl?: string;
  onCloudSync: () => Promise<void>;
}

const SubmitModal: React.FC<Props> = ({ isOpen, onClose, members, changeLog, scriptUrl, onCloudSync }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [isConflict, setIsConflict] = useState(false);

  if (!isOpen) return null;

  const handleCloudSyncInternal = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setIsConflict(false);
    try {
      await onCloudSync();
      setSyncSuccess(true);
      setTimeout(() => {
        onClose();
        setSyncSuccess(false);
      }, 1500);
    } catch (err: any) {
      if (err.message === "CONFLICT") {
        setIsConflict(true);
        setSyncError("資料已被他人更新！為了安全起見，請先關閉視窗並點擊「重新讀取」，整合他人修改後再重新提交。");
      } else {
        setSyncError(err.message || "同步失敗，請檢查資料庫設定或網路。");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className={`p-6 shrink-0 flex justify-between items-start text-white ${isConflict ? 'bg-orange-600' : 'bg-heritage-green'}`}>
          <div>
            <h2 className="text-xl font-serif font-bold flex items-center gap-2">
              {isConflict ? <AlertTriangle size={20}/> : <Cloud size={20} />}
              {isConflict ? '版本衝突警告' : '雲端資料同步'}
            </h2>
            <p className="text-white/80 text-xs mt-1">
              {isConflict ? '檢測到同時編輯衝突' : changeLog.length > 0 ? `尚有 ${changeLog.length} 項未同步的變更` : '資料已是最新狀態'}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-white/10 rounded transition text-white/80 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          <div className="space-y-4">
            <div className={`p-6 rounded-2xl border-2 transition-all duration-300 ${
              syncSuccess 
                ? 'bg-green-50 border-green-500' 
                : isConflict
                ? 'bg-orange-50 border-orange-500'
                : syncError 
                ? 'bg-red-50 border-red-200'
                : 'bg-heritage-cream/30 border-stone-200'
            }`}>
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`p-4 rounded-full shadow-lg ${
                  syncSuccess 
                    ? 'bg-green-500 text-white' 
                    : isSyncing 
                    ? 'bg-heritage-gold text-white animate-pulse' 
                    : isConflict
                    ? 'bg-orange-500 text-white'
                    : 'bg-heritage-green text-white'
                }`}>
                  {syncSuccess ? (
                    <CheckCircle2 size={32} />
                  ) : isSyncing ? (
                    <Loader2 size={32} className="animate-spin" />
                  ) : isConflict ? (
                    <RefreshCw size={32} />
                  ) : (
                    <Cloud size={32} />
                  )}
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-800">
                    {syncSuccess ? '同步完成' : isSyncing ? '驗證版本中...' : isConflict ? '同步遭拒' : '同步至 Google Sheets'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {syncSuccess 
                      ? '所有資料已成功儲存。' 
                      : isConflict
                      ? '有人比您早一步存檔了。'
                      : '將目前的本地修改與雲端進行同步。'}
                  </p>
                </div>

                {syncError && (
                  <div className={`w-full flex items-center gap-2 text-xs p-3 rounded-xl mt-2 border ${
                    isConflict ? 'text-orange-800 bg-white border-orange-100' : 'text-red-600 bg-white border-red-100'
                  }`}>
                    {isConflict ? <AlertTriangle size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                    <span className="text-left font-medium">{syncError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Change Log Preview */}
            {!isConflict && changeLog.length > 0 && !syncSuccess && (
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">待更新清單</h4>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                  {changeLog.map((log, i) => (
                    <div key={i} className="text-xs text-stone-600 flex items-start gap-2">
                      <span className="text-heritage-gold mt-1">•</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-3">
            {isConflict ? (
              <button 
                onClick={onClose}
                className="w-full py-3.5 bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-700 transition transform active:scale-95"
              >
                <RefreshCw size={20} /> 我了解了，去重新讀取
              </button>
            ) : (
              <button 
                onClick={handleCloudSyncInternal}
                disabled={isSyncing || syncSuccess || !scriptUrl}
                className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-md ${
                  syncSuccess 
                    ? 'bg-green-500 text-white cursor-default' 
                    : !scriptUrl
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-heritage-green text-white hover:bg-green-800'
                }`}
              >
                {isSyncing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    正在檢查版本...
                  </>
                ) : syncSuccess ? (
                  <>
                    <CheckCircle2 size={20} />
                    同步成功
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    立即同步
                  </>
                )}
              </button>
            )}
            
            {!scriptUrl && (
              <p className="text-[10px] text-center text-red-500 font-medium bg-red-50 p-2 rounded-lg">
                尚未設定 Google Script URL。
              </p>
            )}

            {!isConflict && (
              <button 
                onClick={onClose}
                disabled={isSyncing}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition font-medium"
              >
                取消
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmitModal;