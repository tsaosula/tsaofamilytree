
import React, { useState } from 'react';
import { Search, User, ArrowRight, X } from 'lucide-react';
import { FamilyMember } from '../types';

interface Props {
  isOpen: boolean;
  members: FamilyMember[];
  onConfirm: (memberId: string) => void;
  onSkip: () => void;
}

const WelcomeModal: React.FC<Props> = ({ isOpen, members, onConfirm, onSkip }) => {
  const [inputName, setInputName] = useState('');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<FamilyMember[]>([]);

  if (!isOpen) return null;

  const handleSearch = () => {
    if (!inputName.trim()) return;
    
    const searchTerm = inputName.trim();
    // Exact match priority, then fuzzy
    const exactMatch = members.find(m => m.name === searchTerm);
    
    if (exactMatch) {
        onConfirm(exactMatch.id);
        return;
    }

    // Fuzzy Search for suggestions
    const matches = members.filter(m => 
        m.name.includes(searchTerm) || 
        (m.courtesyName && m.courtesyName.includes(searchTerm))
    ).slice(0, 5); // Limit to 5

    if (matches.length === 0) {
        setError(`抱歉，族譜中找不到「${searchTerm}」。請嘗試其他名字或直接進入。`);
        setSuggestions([]);
    } else {
        setError('');
        setSuggestions(matches);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-heritage-green/90 backdrop-blur-sm animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative border border-heritage-gold/30">
        
        <div className="bg-heritage-cream p-8 text-center border-b border-stone-200 relative overflow-hidden">
             {/* Decorative Background Pattern */}
            <div className="absolute top-0 left-0 w-full h-full opacity-5 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
            
            <div className="w-16 h-16 bg-heritage-green text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg ring-4 ring-heritage-gold/20 relative z-10">
                <User size={32} />
            </div>
            <h2 className="text-2xl font-serif font-bold text-heritage-green mb-2 relative z-10">歡迎回到曹家</h2>
            <p className="text-stone-600 text-sm relative z-10">
                請輸入您的姓名，我們將為您定位在族譜中的位置。
            </p>
        </div>

        <div className="p-8 space-y-6 bg-white">
            <div className="relative">
                <input 
                    type="text" 
                    value={inputName}
                    onChange={(e) => { setInputName(e.target.value); setError(''); setSuggestions([]); }}
                    onKeyDown={handleKeyDown}
                    placeholder="輸入您的姓名 (例如: 曹德秀)"
                    className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-heritage-gold focus:border-transparent transition text-lg"
                />
                <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
            </div>

            {error && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg text-center font-medium animate-in slide-in-from-top-2">
                    {error}
                </div>
            )}

            {suggestions.length > 0 && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">您是...</p>
                    {suggestions.map(m => (
                        <button 
                            key={m.id}
                            onClick={() => onConfirm(m.id)}
                            className="w-full flex items-center justify-between p-3 rounded-lg border border-stone-100 bg-stone-50 hover:bg-heritage-cream hover:border-heritage-gold/50 transition group text-left"
                        >
                            <span className="font-medium text-stone-800">{m.name} {m.courtesyName && <span className="text-sm text-stone-500">({m.courtesyName})</span>}</span>
                            <span className="text-xs text-stone-400 group-hover:text-heritage-gold">
                                {m.fatherName ? `父: ${m.fatherName}` : `第 ${m.generation} 世`}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <button 
                onClick={handleSearch}
                disabled={!inputName.trim()}
                className="w-full py-3.5 bg-heritage-green text-white rounded-xl font-bold shadow-lg hover:bg-green-800 hover:shadow-xl hover:-translate-y-0.5 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                尋找我的位置 <ArrowRight size={18} />
            </button>

            <div className="text-center pt-2">
                <button 
                    onClick={onSkip}
                    className="text-stone-400 text-sm hover:text-stone-600 transition flex items-center gap-1 mx-auto"
                >
                    直接進入瀏覽 <X size={12} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
