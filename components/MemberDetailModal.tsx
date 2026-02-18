import React, { useState, useEffect } from 'react';
import { FamilyMember, Gender } from '../types';
import { generateBiography } from '../services/geminiService';
import { normalizeDate } from '../App';
import { X, Sparkles, Save, User, GitBranch, Info, Trash2, AlertTriangle, MapPin, Calendar, History, Phone, Mail } from 'lucide-react';

interface Props {
  member: FamilyMember | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: FamilyMember) => void;
  onDelete?: (id: string) => void;
  allMembers: FamilyMember[];
}

export const MemberDetailModal: React.FC<Props> = ({ member, isOpen, onClose, onSave, onDelete, allMembers }) => {
  const [formData, setFormData] = useState<FamilyMember | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [extraNotes, setExtraNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'BIO'>('DETAILS');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (member) {
      const fatherName = member.fatherName || (member.fatherId ? allMembers.find(m => m.id === member.fatherId)?.name : '');
      const motherName = member.motherName || (member.motherId ? allMembers.find(m => m.id === member.motherId)?.name : '');
      
      setFormData({ 
        ...member,
        fatherName,
        motherName
      });
      setExtraNotes('');
      setShowDeleteConfirm(false);
      setActiveTab('DETAILS');
    }
  }, [member, allMembers]);

  if (!isOpen || !formData) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => prev ? { ...prev, [name]: value } : null);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'birthDate' || name === 'deathDate') {
        const normalized = normalizeDate(value);
        if (normalized !== value) {
            setFormData(prev => prev ? { ...prev, [name]: normalized } : null);
        }
    }
  };

  const handleGenerateBio = async () => {
    if (!formData) return;
    setIsAiLoading(true);
    const context = `世代: ${formData.generation || '未知'}, 字號: ${formData.courtesyName || '無'}, 配偶: ${formData.spouseName || '無'}, 父親: ${formData.fatherName || '未知'}, 母親: ${formData.motherName || '未知'}, 出生: ${formData.birthDate || '未知'}, 逝世: ${formData.deathDate || '未知'}. ${extraNotes}`;
    const bio = await generateBiography(formData, context);
    setFormData(prev => prev ? { ...prev, biography: bio } : null);
    setIsAiLoading(false);
  };

  const handleConfirmDelete = () => {
      if (onDelete && formData) {
          onDelete(formData.id);
      }
  };

  const handleSave = () => {
      if (!formData) return;
      
      const updatedMember = { 
          ...formData,
          birthDate: normalizeDate(formData.birthDate),
          deathDate: normalizeDate(formData.deathDate)
      };
      
      if (updatedMember.fatherName) {
          const father = allMembers.find(m => m.name === updatedMember.fatherName);
          if (father) {
              updatedMember.fatherId = father.id;
          } else {
              updatedMember.fatherId = undefined; 
          }
      } else {
          updatedMember.fatherId = 'virtual_root'; 
      }

      if (updatedMember.motherName) {
          const mother = allMembers.find(m => m.name === updatedMember.motherName);
          if (mother) {
              updatedMember.motherId = mother.id;
          } else {
               updatedMember.motherId = undefined;
          }
      }

      onSave(updatedMember);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative">
        
        {showDeleteConfirm && (
            <div className="absolute inset-0 z-50 bg-white/95 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
                <div className="bg-red-50 p-4 rounded-full mb-4">
                    <AlertTriangle size={48} className="text-red-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">確定要移除此成員？</h3>
                <p className="text-gray-600 mb-8 max-w-sm">
                    您正在嘗試移除 <span className="font-bold text-gray-900">{formData.name}</span>。
                    此動作無法復原，且可能會影響族譜的連結結構。
                </p>
                <div className="flex gap-4 w-full max-w-xs">
                    <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-3 px-4 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition"
                    >
                        取消
                    </button>
                    <button 
                        onClick={handleConfirmDelete}
                        className="flex-1 py-3 px-4 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition shadow-lg shadow-red-200"
                    >
                        確認移除
                    </button>
                </div>
            </div>
        )}

        <div className="bg-heritage-green text-white p-6 flex justify-between items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/asfalt-dark.png')]"></div>
            <div className="flex items-center gap-5 z-10">
                 <div className="w-20 h-20 rounded-full border-4 border-heritage-gold bg-white flex items-center justify-center text-heritage-green font-bold text-3xl shadow-lg">
                    {formData.name.charAt(0)}
                 </div>
                 <div>
                    <div className="flex items-baseline gap-3">
                        <h2 className="text-3xl font-serif font-bold">{formData.name}</h2>
                        {formData.courtesyName && <span className="bg-heritage-gold/20 border border-heritage-gold/30 px-2 py-0.5 rounded text-sm text-heritage-gold">字 {formData.courtesyName}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-heritage-cream/80 text-sm">
                        {formData.generation && <span className="flex items-center gap-1"><GitBranch size={14}/> 第 {formData.generation} 世</span>}
                        {formData.spouseName && <span>配偶: {formData.spouseName}</span>}
                    </div>
                 </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition z-10">
                <X size={24} />
            </button>
        </div>

        <div className="flex border-b border-gray-200 px-6 pt-4 bg-gray-50">
            <button 
                onClick={() => setActiveTab('DETAILS')}
                className={`pb-3 px-4 text-sm font-semibold transition border-b-2 ${activeTab === 'DETAILS' ? 'border-heritage-green text-heritage-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                基本資料
            </button>
            <button 
                onClick={() => setActiveTab('BIO')}
                className={`pb-3 px-4 text-sm font-semibold transition border-b-2 ${activeTab === 'BIO' ? 'border-heritage-green text-heritage-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                傳記與筆記
            </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-heritage-cream/20">
            {activeTab === 'DETAILS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <User size={14}/> 身份資訊
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                             <label className="block">
                                <span className="text-gray-700 text-sm font-medium">姓名</span>
                                <input 
                                    type="text" 
                                    name="name" 
                                    value={formData.name} 
                                    onChange={handleChange}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-stone-50 border px-3 py-2 focus:border-heritage-gold focus:ring-1 focus:ring-heritage-gold outline-none"
                                />
                            </label>
                             <label className="block">
                                <span className="text-gray-700 text-sm font-medium">字號</span>
                                <input 
                                    type="text" 
                                    name="courtesyName" 
                                    value={formData.courtesyName || ''} 
                                    onChange={handleChange}
                                    placeholder="如: 興, 天"
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-stone-50 border px-3 py-2 focus:border-heritage-gold focus:ring-1 focus:ring-heritage-gold outline-none"
                                />
                            </label>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <label className="block">
                                <span className="text-gray-700 text-sm font-medium">世代 (世)</span>
                                <input 
                                    type="number" 
                                    name="generation" 
                                    value={formData.generation || ''} 
                                    onChange={handleChange}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-stone-50 border px-3 py-2 focus:border-heritage-gold focus:ring-1 focus:ring-heritage-gold outline-none"
                                />
                            </label>
                             <label className="block">
                                <span className="text-gray-700 text-sm font-medium">性別</span>
                                <select 
                                    name="gender" 
                                    value={formData.gender} 
                                    onChange={handleChange}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-stone-50 border px-3 py-2 focus:border-heritage-gold outline-none"
                                >
                                    <option value={Gender.Male}>男性</option>
                                    <option value={Gender.Female}>女性</option>
                                    <option value={Gender.Other}>其他</option>
                                </select>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-4 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Info size={14}/> 詳細資料
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                             <label className="block">
                                <span className="text-gray-700 text-sm font-medium">父親姓名</span>
                                <input 
                                    type="text" 
                                    name="fatherName" 
                                    value={formData.fatherName || ''} 
                                    onChange={handleChange}
                                    placeholder="輸入父親姓名以連結"
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-stone-50 border px-3 py-2 focus:border-heritage-gold outline-none"
                                />
                            </label>
                             <label className="block">
                                <span className="text-gray-700 text-sm font-medium">母親姓名</span>
                                <input 
                                    type="text" 
                                    name="motherName" 
                                    value={formData.motherName || ''} 
                                    onChange={handleChange}
                                    placeholder="輸入母親姓名"
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-stone-50 border px-3 py-2 focus:border-heritage-gold outline-none"
                                />
                            </label>
                        </div>

                         <div className="grid grid-cols-2 gap-4">
                            <label className="block">
                                <span className="text-gray-700 text-sm font-medium">配偶姓名</span>
                                <input 
                                    type="text" 
                                    name="spouseName" 
                                    value={formData.spouseName || ''} 
                                    onChange={handleChange}
                                    placeholder="配偶姓名"
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-stone-50 border px-3 py-2 focus:border-heritage-gold outline-none"
                                />
                            </label>
                            <label className="block">
                                <span className="text-gray-700 text-sm font-medium flex items-center gap-1">配偶電話</span>
                                <input 
                                    type="text" 
                                    name="spousePhone" 
                                    value={formData.spousePhone || ''} 
                                    onChange={handleChange}
                                    placeholder="配偶電話"
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-stone-50 border px-3 py-2 focus:border-heritage-gold outline-none"
                                />
                            </label>
                        </div>

                         <div className="grid grid-cols-2 gap-4">
                            <label className="block">
                                <span className="text-gray-700 text-sm font-medium flex items-center gap-1"><Calendar size={12}/> 出生日期</span>
                                <input 
                                    type="text" 
                                    name="birthDate" 
                                    placeholder="1979/5/14"
                                    value={formData.birthDate || ''} 
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-stone-50 border px-3 py-2 focus:border-heritage-gold outline-none"
                                />
                            </label>
                            <label className="block">
                                <span className="text-gray-700 text-sm font-medium flex items-center gap-1"><History size={12}/> 逝世/享壽年</span>
                                <input 
                                    type="text" 
                                    name="deathDate" 
                                    placeholder="YYYY/M/D 或 壽數"
                                    value={formData.deathDate || ''} 
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-stone-50 border px-3 py-2 focus:border-heritage-gold outline-none"
                                />
                            </label>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <label className="block">
                                <span className="text-gray-700 text-sm font-medium">居住地</span>
                                <div className="relative">
                                  <input 
                                      type="text" 
                                      name="location" 
                                      value={formData.location || ''} 
                                      onChange={handleChange}
                                      className="mt-1 block w-full rounded-md border-gray-300 bg-stone-50 border px-3 py-2 focus:border-heritage-gold outline-none pr-8"
                                  />
                                  <MapPin size={14} className="absolute right-3 top-3.5 text-gray-400" />
                                </div>
                            </label>
                            <label className="block">
                                <span className="text-gray-700 text-sm font-medium flex items-center gap-1"><Phone size={12}/> 本人電話</span>
                                <input 
                                    type="text" 
                                    name="phone" 
                                    value={formData.phone || ''} 
                                    onChange={handleChange}
                                    placeholder="09xx-xxx-xxx"
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-stone-50 border px-3 py-2 focus:border-heritage-gold outline-none"
                                />
                            </label>
                        </div>

                        <label className="block">
                            <span className="text-gray-700 text-sm font-medium flex items-center gap-1"><Mail size={12}/> 電子郵件</span>
                            <div className="relative">
                                <input 
                                    type="email" 
                                    name="email" 
                                    value={formData.email || ''} 
                                    onChange={handleChange}
                                    placeholder="example@mail.com"
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-stone-50 border px-3 py-2 focus:border-heritage-gold outline-none pr-8"
                                />
                                <Mail size={14} className="absolute right-3 top-3.5 text-gray-400" />
                            </div>
                        </label>
                        
                        <div className="pt-2 text-[10px] text-gray-400">
                            <p>系統 ID: {formData.id}</p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'BIO' && (
                <div className="space-y-6">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-blue-800 flex items-center gap-2">
                                <Sparkles size={18} className="text-heritage-gold" />
                                Gemini AI 家族史官
                            </h3>
                        </div>
                        <p className="text-sm text-blue-600 mb-3 leading-relaxed">
                            告訴 AI 關於 {formData.name} 的故事、軼事或家族傳說，AI 將為其撰寫一段優美的傳記。
                        </p>
                        <textarea
                            className="w-full p-3 text-sm border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300 mb-3 min-h-[80px] bg-white/80"
                            rows={3}
                            placeholder="輸入額外筆記：例如「曾擔任村長，為人急公好義...」或「搬遷至台北的過程...」"
                            value={extraNotes}
                            onChange={(e) => setExtraNotes(e.target.value)}
                        />
                         <button 
                            onClick={handleGenerateBio}
                            disabled={isAiLoading}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2 shadow-sm"
                        >
                            {isAiLoading ? '正在撰寫歷史...' : '生成傳記'}
                        </button>
                    </div>

                    <div>
                        <label className="block mb-2 text-gray-700 font-medium font-serif text-lg">傳記內容</label>
                        <textarea 
                            name="biography"
                            rows={12}
                            value={formData.biography || ''} 
                            onChange={handleChange}
                            className="block w-full rounded-md border-gray-300 bg-white border px-6 py-4 focus:border-heritage-gold outline-none leading-loose font-serif text-gray-800 shadow-inner text-lg"
                            placeholder="在此輸入或編輯傳記..."
                        />
                    </div>
                </div>
            )}
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-between gap-3 bg-gray-50">
             <div>
                 {onDelete && (
                    <button 
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2.5 rounded-lg text-red-500 hover:bg-red-50 font-medium transition flex items-center gap-2"
                        title="移除成員"
                    >
                        <Trash2 size={18} />
                    </button>
                 )}
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-lg text-gray-600 hover:bg-gray-200 font-medium transition"
                >
                    取消
                </button>
                <button 
                    onClick={handleSave}
                    className="px-6 py-2.5 rounded-lg bg-heritage-gold text-white hover:bg-yellow-600 font-medium shadow-lg shadow-orange-100 transition flex items-center gap-2 transform active:scale-95"
                >
                    <Save size={18} />
                    確認修改
                </button>
            </div>
      </div>
    </div>
  );
};