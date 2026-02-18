import React, { useState, useCallback, useMemo, useEffect } from 'react';
import TreeVisualization from './components/TreeVisualization';
import { MemberDetailModal } from './components/MemberDetailModal';
import FamilyChat from './components/FamilyChat';
import WelcomeModal from './components/WelcomeModal';
import SubmitModal from './components/SubmitModal';
import { FamilyMember, Gender } from './types';
import { Search, Plus, BookOpen, Download, Send, Table as TableIcon, Network, Trash2, Filter, Menu, X, RefreshCw, AlertTriangle, User, Link as LinkIcon, Loader2, CloudOff, Cloud, Save, CheckCircle2, Clock, Settings, Edit3 } from 'lucide-react';

// ============================================================================
// 設定區域：Google Sheet 資料庫連結
// ============================================================================

const DEFAULT_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vREBe9rpbcDfVjUsO9Yqr8ZbkZajnaGQ7F3iW9Q3I9QMzXqb6QZUb-rSPXGaB_GEEE3i7e3cEZR_Mde/pub?output=csv"; 
const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyRw2eAT5aLXQGLxuQ2G3t1i4otLhr_OWBXDR82ceFmjnkZp0KNh7XgSAMY7dFcXJMy/exec"
const REQUIRED_SCRIPT_VERSION = "v3_conflict_prevention";

// ============================================================================

const INITIAL_DATA_CSV = `Name,SpouseName,Father,Mother,Generation,CourtesyName,Notes,gender,birthDate,deathDate,location,Phone,SpousePhone,Email
曹德秀,,,,11,元,,MALE,,,,,,
曹來秀,,,,11,元,,MALE,,,,,,
`;

const ROOT_ID = 'virtual_root';

export const normalizeDate = (str: string | undefined): string | undefined => {
    if (!str || typeof str !== 'string') return str;
    const trimmed = str.trim();
    if (!trimmed) return undefined;

    const parts = trimmed.split(/[-/.]/);
    if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (y > 1000 && y < 3000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            return `${y}/${m}/${d}`;
        }
    }

    const date = new Date(trimmed.replace(/\//g, '-'));
    if (!isNaN(date.getTime()) && trimmed.length >= 8) {
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    }
    return trimmed;
};

// 比對成員資料是否真的有變動
const hasMemberChanged = (m1: FamilyMember, m2: FamilyMember) => {
    const fieldsToCompare: (keyof FamilyMember)[] = [
        'name', 'gender', 'birthDate', 'deathDate', 'biography', 
        'location', 'phone', 'spousePhone', 'email', 'generation', 
        'courtesyName', 'spouseName', 'fatherName', 'motherName'
    ];
    
    return fieldsToCompare.some(field => {
        const val1 = m1[field] === undefined || m1[field] === null ? '' : String(m1[field]).trim();
        const val2 = m2[field] === undefined || m2[field] === null ? '' : String(m2[field]).trim();
        return val1 !== val2;
    });
};

const parseCSVLine = (line: string): string[] => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; 
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
};

const toCSVField = (field: string | number | undefined): string => {
    if (field === undefined || field === null) return '';
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
};

const processRawData = (rawData: any[]): FamilyMember[] => {
    const tempMap = new Map<string, FamilyMember & { fatherName?: string, motherName?: string }>();
    const members: (FamilyMember & { fatherName?: string, motherName?: string })[] = [];
    
    const virtualRoot: FamilyMember = { id: ROOT_ID, name: 'ROOT', gender: Gender.Other, biography: 'Hidden Root', generation: 0 };
    members.push(virtualRoot);

    const safeStr = (val: any): string | undefined => {
        if (val === null || val === undefined) return undefined;
        const s = String(val).trim();
        return s === '' ? undefined : s;
    };

    rawData.forEach((item, index) => {
        const id = index.toString();
        let gender = Gender.Other;
        const rawGender = (item.gender || '').toUpperCase();
        if (rawGender === 'MALE' || rawGender === '男性') gender = Gender.Male;
        else if (rawGender === 'FEMALE' || rawGender === '女性') gender = Gender.Female;

        const member: FamilyMember & { fatherName?: string, motherName?: string } = {
            id,
            name: safeStr(item.name) || 'Unknown',
            gender: gender,
            biography: safeStr(item.biography || item.Notes) || '', 
            spouseName: safeStr(item.spouseName || item.SpouseName),
            fatherName: safeStr(item.fatherName || item.Father),
            motherName: safeStr(item.motherName || item.Mother),
            generation: parseInt(item.generation || item.Generation || '0') || undefined,
            courtesyName: safeStr(item.courtesyName || item.CourtesyName),
            birthDate: normalizeDate(safeStr(item.birthDate)),
            deathDate: normalizeDate(safeStr(item.deathDate)),
            location: safeStr(item.location || item.Location),
            phone: safeStr(item.phone),
            spousePhone: safeStr(item.spousePhone || item.SpousePhone),
            email: safeStr(item.email || item.Email)
        };
        tempMap.set(member.name, member);
        members.push(member);
    });

    members.forEach(member => {
        if (member.id === ROOT_ID) return;
        if (member.fatherName) {
            let father = tempMap.get(member.fatherName);
            if (!father) {
                const fName = member.fatherName;
                const cleanName = fName.replace(/\s+/g, '');
                for (const [key, val] of tempMap.entries()) {
                    if (key.replace(/\s+/g, '') === cleanName) {
                        father = val;
                        break;
                    }
                }
            }
            member.fatherId = father ? father.id : ROOT_ID;
        } else {
            member.fatherId = ROOT_ID;
        }
        
        if (member.motherName && !member.motherId) {
            let mother = tempMap.get(member.motherName);
            if (!mother) {
                const mName = member.motherName;
                const cleanName = mName.replace(/\s+/g, '');
                for (const [key, val] of tempMap.entries()) {
                    if (key.replace(/\s+/g, '') === cleanName) {
                        mother = val;
                        break;
                    }
                }
            }
            if (mother) member.motherId = mother.id;
        }
    });

    return members;
};

const parseGenealogyCSV = (csvData: string): FamilyMember[] => {
    if (!csvData || !csvData.trim()) throw new Error("Empty CSV");
    const lines = csvData.trim().split(/\r?\n/);
    const rawData: any[] = [];
    
    let startIndex = 0;
    if (lines[0].trim().toLowerCase().startsWith('name')) startIndex = 1;

    for (let index = startIndex; index < lines.length; index++) {
        const line = lines[index];
        if (!line.trim()) continue;
        const parts = parseCSVLine(line);
        if (!parts[0]?.trim()) continue;

        rawData.push({
            name: parts[0]?.trim(),
            spouseName: parts[1]?.trim() !== 'need to ask' ? parts[1]?.trim() : undefined,
            fatherName: parts[2]?.trim() !== 'need to ask' ? parts[2]?.trim() : undefined,
            motherName: parts[3]?.trim() !== 'need to ask' ? parts[3]?.trim() : undefined,
            generation: parts[4]?.trim(),
            courtesyName: parts[5]?.trim(),
            biography: parts[6]?.trim() || '',
            gender: parts[7]?.trim(),
            birthDate: parts[8]?.trim(),
            deathDate: parts[9]?.trim(),
            location: parts[10]?.trim(),
            phone: parts[11]?.trim(),
            spousePhone: parts[12]?.trim(),
            email: parts[13]?.trim()
        });
    }
    return processRawData(rawData);
};

const App: React.FC = () => {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [cloudVersion, setCloudVersion] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'chart' | 'grid'>('chart');
  const [minGeneration, setMinGeneration] = useState<number>(0);
  const [availableGenerations, setAvailableGenerations] = useState<number[]>([]);
  const [changeLog, setChangeLog] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'verifying' | 'success' | 'error' | 'conflict'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [scriptUrl, setScriptUrl] = useState(localStorage.getItem('GAS_SCRIPT_URL') || DEFAULT_SCRIPT_URL);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [usingCloudData, setUsingCloudData] = useState(false);
  const [dataSource, setDataSource] = useState<'SCRIPT_API' | 'CSV' | 'LOCAL'>('LOCAL');
  const [dataError, setDataError] = useState<string | null>(null);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(true);
  const [focusMemberId, setFocusMemberId] = useState<string | null>(null);
  const [memberToDeleteId, setMemberToDeleteId] = useState<string | null>(null);

  const updateScriptUrl = (url: string) => {
      setScriptUrl(url);
      localStorage.setItem('GAS_SCRIPT_URL', url);
  };

  const loadFamilyData = useCallback(async (isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) setIsLoadingData(true);
    if (!isBackgroundRefresh) setDataError(null);
    
    let loadedMembers: FamilyMember[] = [];
    let source: 'SCRIPT_API' | 'CSV' | 'LOCAL' = 'LOCAL';
    let isCloud = false;
    let version: string | null = null;

    if (scriptUrl) {
        try {
            const response = await fetch(scriptUrl);
            if (response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const jsonData = await response.json();
                    if (jsonData.data && Array.isArray(jsonData.data)) {
                        loadedMembers = processRawData(jsonData.data);
                        version = jsonData.version || null;
                        isCloud = true;
                        source = 'SCRIPT_API';
                    }
                }
            }
        } catch (error) {
            console.warn("GAS fetch failed", error);
        }
    }

    if (loadedMembers.length === 0 && DEFAULT_CSV_URL) {
            try {
                const fetchUrl = `${DEFAULT_CSV_URL}&t=${new Date().getTime()}`;
                const response = await fetch(fetchUrl);
                if (response.ok) {
                    const csvText = await response.text();
                    if (!csvText.trim().startsWith('<') && csvText.length > 20) {
                        loadedMembers = parseGenealogyCSV(csvText);
                        isCloud = true;
                        source = 'CSV';
                    }
                }
            } catch (error) {}
    }

    if (loadedMembers.length === 0) {
            try {
                loadedMembers = parseGenealogyCSV(INITIAL_DATA_CSV);
                source = 'LOCAL';
            } catch (e) {}
    }

    setFamilyMembers(loadedMembers);
    setCloudVersion(version);
    setUsingCloudData(isCloud);
    setDataSource(source);
    setIsLoadingData(false);
    return loadedMembers;
  }, [scriptUrl]);

  useEffect(() => {
    loadFamilyData();
  }, [loadFamilyData]);

  useEffect(() => {
      const generations = familyMembers
          .map(m => m.generation)
          .filter((g): g is number => g !== undefined && g > 0)
          .filter((value, index, self) => self.indexOf(value) === index)
          .sort((a, b) => a - b);
      setAvailableGenerations(generations);
  }, [familyMembers]);

  const selectedMember = useMemo(() => 
    familyMembers.find(m => m.id === selectedMemberId) || null, 
  [familyMembers, selectedMemberId]);

  const filteredMembers = useMemo(() => 
    familyMembers.filter(m => {
        if (m.id === ROOT_ID) return true; 
        if (m.generation !== undefined && m.generation < minGeneration) return false;
        const term = searchTerm.toLowerCase().trim();
        if (!term) return true;
        const normalizedTerm = term.replace(/\s+/g, '');
        const normalize = (str: string | undefined) => (str || '').toLowerCase().replace(/\s+/g, '');
        return (
            normalize(m.name).includes(normalizedTerm) || 
            normalize(m.courtesyName).includes(normalizedTerm) ||
            normalize(m.spouseName).includes(normalizedTerm) ||
            normalize(m.fatherName).includes(normalizedTerm) ||
            normalize(m.motherName).includes(normalizedTerm) ||
            normalize(m.biography).includes(normalizedTerm)
        );
    }),
  [familyMembers, searchTerm, minGeneration]);

  const handleCloudSync = async (membersToSync?: FamilyMember[]) => {
      const members = membersToSync || familyMembers;
      if (!scriptUrl) {
          if (!membersToSync) setIsConfigOpen(true);
          return;
      }
      
      setSyncStatus('syncing');
      setSyncMessage('正在驗證版本並上傳...');

      try {
          const payload = {
              version: cloudVersion,
              data: members.filter(m => m.id !== ROOT_ID).map(m => {
                  const father = members.find(f => f.id === m.fatherId);
                  const mother = members.find(mo => mo.id === m.motherId);
                  return {
                      name: m.name,
                      spouseName: m.spouseName || '',
                      fatherName: father ? father.name : (m.fatherName || ''),
                      motherName: mother ? mother.name : (m.motherName || ''),
                      generation: m.generation || '',
                      courtesyName: m.courtesyName || '',
                      biography: m.biography || '',
                      gender: m.gender || '',
                      birthDate: m.birthDate || '',
                      deathDate: m.deathDate || '',
                      location: m.location || '',
                      phone: m.phone || '',
                      spousePhone: m.spousePhone || '',
                      email: m.email || ''
                  };
              })
          };

          const response = await fetch(scriptUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify(payload)
          });
          
          if (!response.ok) throw new Error(`連線失敗 (HTTP ${response.status})`);

          const resultText = await response.text();
          let resultJson: any = {};
          try {
              resultJson = JSON.parse(resultText);
          } catch (e) {
              throw new Error("腳本回傳格式錯誤。");
          }

          if (resultJson.status === "conflict") {
            setSyncStatus('conflict');
            setSyncMessage('偵測到版本衝突！他人已更新資料。');
            throw new Error("CONFLICT");
          }

          if (resultJson.status === "error") throw new Error(resultJson.message);
          
          setSyncStatus('verifying');
          setSyncMessage('同步完成，更新本地版本...');
          const refreshedMembers = await loadFamilyData(true); 
          
          if (refreshedMembers && refreshedMembers.length > 0) {
              setChangeLog([]); 
              setSyncStatus('success');
              setSyncMessage('雲端同步成功！');
              setTimeout(() => setSyncStatus('idle'), 3000);
          }
          
      } catch (e: any) {
          if (e.message === "CONFLICT") {
            setIsSubmitModalOpen(true); 
          } else {
            setSyncStatus('error');
            setSyncMessage(e.message || '連線異常');
          }
          throw e; 
      }
  };

  const handleSelectMember = useCallback((id: string) => {
    if (id === ROOT_ID) return;
    setSelectedMemberId(id);
    setIsModalOpen(true);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);
  
  const handleWelcomeConfirm = (memberId: string) => {
      setFocusMemberId(memberId);
      setIsWelcomeModalOpen(false);
  };

  const handleSaveMember = async (updatedMember: FamilyMember) => {
    const originalMember = familyMembers.find(m => m.id === updatedMember.id);
    const isNew = !originalMember;
    
    // Dirty Check: 檢查是否有實質更動
    if (!isNew && originalMember && !hasMemberChanged(originalMember, updatedMember)) {
        console.log("No real changes detected, skipping sync.");
        setIsModalOpen(false);
        return;
    }

    const newMembers = isNew 
        ? [...familyMembers, updatedMember]
        : familyMembers.map(m => m.id === updatedMember.id ? updatedMember : m);

    // 1. 更新本地 UI
    setFamilyMembers(newMembers);
    setChangeLog(prev => [...prev, `${isNew ? '[新增]' : '[修改]'} ${updatedMember.name}`]);
    setIsModalOpen(false);

    // 2. 立即嘗試雲端同步
    if (scriptUrl) {
        try {
            await handleCloudSync(newMembers);
        } catch (e) {
            console.error("Auto-sync failed:", e);
        }
    }
  };
  
  const handleConfirmDelete = (id: string) => {
      setMemberToDeleteId(id);
  };

  const performDelete = async () => {
      if (!memberToDeleteId) return;
      const memberToDelete = familyMembers.find(m => m.id === memberToDeleteId);
      const newMembers = familyMembers.filter(m => m.id !== memberToDeleteId);
      
      const logMsg = memberToDelete ? `[刪除] ${memberToDelete.name}` : '[刪除] 成員';
      setChangeLog(prev => [...prev, logMsg]);
      
      // 刪除一定視為變更
      setFamilyMembers(newMembers);
      setMemberToDeleteId(null);
      setIsModalOpen(false);
      setSelectedMemberId(null);

      if (scriptUrl) {
          try {
              await handleCloudSync(newMembers);
          } catch (e) {
              console.error("Auto-sync on delete failed:", e);
          }
      }
  };

  const handleAddMember = () => {
    const newId = (Math.random() * 10000).toFixed(0);
    const newMember: FamilyMember = {
      id: newId, name: '新成員', gender: Gender.Male,
      generation: selectedMember?.generation ? selectedMember.generation + 1 : undefined,
      fatherId: selectedMemberId || ROOT_ID,
      fatherName: selectedMember?.name || undefined
    };
    setFamilyMembers(prev => [...prev, newMember]);
    setSelectedMemberId(newId);
    if (viewMode === 'chart') setIsModalOpen(true);
  };

  const handleReload = () => {
    if (changeLog.length > 0 && !confirm("重新載入將會清除未同步的修改，確定嗎？")) return;
    loadFamilyData(); 
  };

  const toggleViewMode = () => setViewMode(prev => prev === 'chart' ? 'grid' : 'chart');

  const downloadFile = (format: 'json' | 'csv' = 'json') => {
      let content = '';
      if (format === 'json') content = JSON.stringify(familyMembers, null, 2);
      else {
          const header = ['Name', 'SpouseName', 'Father', 'Mother', 'Generation', 'CourtesyName', 'Notes', 'gender', 'birthDate', 'deathDate', 'location', 'Phone', 'SpousePhone', 'Email'].join(',');
          const rows = familyMembers.filter(m => m.id !== ROOT_ID).map(m => {
                const father = familyMembers.find(f => f.id === m.fatherId);
                const mother = familyMembers.find(mo => mo.id === m.motherId);
                return [
                    m.name, m.spouseName, father ? father.name : (m.fatherName || ''), mother ? mother.name : (m.motherName || ''), 
                    m.generation, m.courtesyName, m.biography, m.gender, m.birthDate, m.deathDate, m.location, m.phone, m.spousePhone, m.email
                ].map(toCSVField).join(',');
            });
          content = "\uFEFF" + [header, ...rows].join('\n');
      }
      const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `family_tree_backup_${new Date().toISOString().slice(0,10)}.${format}`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  if (isLoadingData) {
      return (
          <div className="h-screen w-full flex flex-col items-center justify-center bg-heritage-cream space-y-4">
              <Loader2 className="animate-spin text-heritage-green" size={48} />
              <p className="text-heritage-brown font-serif text-lg animate-pulse">正在讀取家族歷史...</p>
          </div>
      );
  }

  const hasUnsavedChanges = changeLog.length > 0;

  return (
    <div className="h-screen flex flex-col md:flex-row bg-heritage-cream font-sans overflow-hidden">
      {isConfigOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2"><Settings size={20}/> 設定資料庫連結</h3>
                    <button onClick={() => setIsConfigOpen(false)}><X size={24}/></button>
                </div>
                <div className="space-y-4">
                    <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-800 border border-yellow-200">
                        <p className="font-bold mb-1">同步失敗？</p>
                        <p>1. 腳本版本不相符：請複製最新腳本代碼並「重新部署」。</p>
                        <p>2. 欄位不更新：請確認腳本中的 headers 包含 Email, SpousePhone 等欄位。</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Script URL</label>
                        <input type="text" value={scriptUrl} onChange={(e) => updateScriptUrl(e.target.value)} placeholder="https://script.google.com/..." className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-heritage-gold outline-none" />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setIsConfigOpen(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-gray-700">取消</button>
                        <button onClick={() => { setIsConfigOpen(false); loadFamilyData(); }} className="px-4 py-2 bg-heritage-green text-white rounded-lg">儲存並連線</button>
                    </div>
                </div>
            </div>
        </div>
      )}

      <WelcomeModal isOpen={isWelcomeModalOpen} members={familyMembers} onConfirm={handleWelcomeConfirm} onSkip={() => setIsWelcomeModalOpen(false)} />
      
      {memberToDeleteId && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-sm p-8 text-center animate-in zoom-in duration-200">
                  <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} className="text-red-500" /></div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">確認移除成員？</h3>
                  <div className="flex gap-3 mt-6">
                      <button onClick={() => setMemberToDeleteId(null)} className="flex-1 py-3 px-4 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition">取消</button>
                      <button onClick={performDelete} className="flex-1 py-3 px-4 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition shadow-lg shadow-red-200">確認移除</button>
                  </div>
              </div>
          </div>
      )}

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>}
      <aside className={`fixed inset-y-0 left-0 z-40 w-80 bg-white border-r border-stone-200 transform transition-transform duration-300 ease-in-out shadow-lg md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col relative">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 md:hidden text-white/80 z-50 p-2"><X size={24} /></button>
            <div className="p-6 border-b border-stone-100 bg-heritage-green text-white transition-colors duration-300 relative group">
                <button onClick={() => setIsConfigOpen(true)} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white/80 hover:bg-white/20 transition backdrop-blur-sm shadow-sm" title="設定資料庫"><Settings size={16} /></button>
                <h1 className="text-2xl font-serif font-bold flex items-center gap-3"><BookOpen className="text-heritage-gold" />龜山曹家</h1>
                <div className="text-sm text-heritage-cream/70 mt-1 flex justify-between items-center">
                    <span>線上協作版</span>
                    {usingCloudData ? (
                        <span className="flex items-center gap-1 text-[10px] bg-green-500/20 px-2 py-0.5 rounded-full text-green-300"><Cloud size={10}/> {dataSource === 'SCRIPT_API' ? '雲端 (即時)' : '雲端 (快取)'}</span>
                    ) : (
                        <span className="flex items-center gap-1 text-[10px] bg-stone-500/20 px-2 py-0.5 rounded-full text-gray-300"><CloudOff size={10}/> 離線資料</span>
                    )}
                </div>
            </div>
            
            {syncStatus !== 'idle' && (
                <div className={`px-4 py-2 text-xs font-medium border-b flex items-center justify-between ${
                    syncStatus === 'syncing' || syncStatus === 'verifying' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                    syncStatus === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 
                    syncStatus === 'conflict' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-red-50 text-red-700 border-red-100'
                }`}>
                    <div className="flex items-center gap-2">
                        {syncStatus === 'syncing' || syncStatus === 'verifying' ? <Loader2 size={14} className="animate-spin" /> : 
                         syncStatus === 'success' ? <CheckCircle2 size={14} /> : 
                         syncStatus === 'conflict' ? <AlertTriangle size={14} /> : <AlertTriangle size={14} />}
                        <span className="truncate">{syncMessage}</span>
                    </div>
                </div>
            )}

            <div className="p-4">
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input type="text" placeholder="搜尋..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-heritage-gold/50 text-sm" />
                </div>
                <div className="flex gap-2 p-1 bg-stone-100 rounded-lg">
                    <button onClick={() => setViewMode('chart')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition flex items-center justify-center gap-1 ${viewMode === 'chart' ? 'bg-white text-heritage-green shadow-sm' : 'text-gray-500'}`}><Network size={14} /> 圖表</button>
                    <button onClick={() => setViewMode('grid')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition flex items-center justify-center gap-1 ${viewMode === 'grid' ? 'bg-white text-heritage-green shadow-sm' : 'text-gray-500'}`}><TableIcon size={14} /> 列表</button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
                {filteredMembers.filter(m => m.id !== ROOT_ID).map(member => (
                    <button key={member.id} onClick={() => handleSelectMember(member.id)} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition hover:bg-stone-50 ${selectedMemberId === member.id ? 'bg-heritage-cream/50 border border-heritage-gold/30' : ''}`}>
                        <div className="w-10 h-10 rounded-full bg-heritage-cream border border-heritage-gold/30 flex items-center justify-center text-heritage-brown font-serif font-bold">{member.name.charAt(0)}</div>
                        <div className="flex-1 min-w-0"><p className="font-medium text-gray-800 truncate">{member.name}</p></div>
                    </button>
                ))}
            </div>
            <div className="p-4 border-t border-stone-200 bg-stone-50 space-y-2">
                <button onClick={handleAddMember} className="w-full bg-heritage-green text-white py-2 px-4 rounded-lg shadow hover:bg-green-900 transition flex items-center justify-center gap-2 font-medium"><Plus size={18} /> 新增成員</button>
                <div className="mt-4 pt-4 border-t border-gray-100">
                     <div className="grid grid-cols-2 gap-2 mb-2">
                         <button onClick={handleReload} className="flex flex-col items-center py-2 text-xs font-medium text-gray-600 bg-stone-100 rounded-lg hover:bg-stone-200"><RefreshCw size={16} /> 重新讀取</button>
                         <button onClick={() => downloadFile('json')} className="flex flex-col items-center py-2 text-xs font-medium text-gray-600 bg-stone-100 rounded-lg hover:bg-stone-200"><Download size={16} /> 備份</button>
                     </div>
                     <button onClick={() => setIsSubmitModalOpen(true)} className={`w-full py-2.5 text-xs font-bold rounded-lg border-2 flex items-center justify-center gap-2 transition ${hasUnsavedChanges ? 'bg-heritage-gold border-heritage-gold text-white shadow-lg' : 'border-heritage-green/20 text-heritage-green hover:bg-green-50'}`}><Send size={14} /> {hasUnsavedChanges ? `提交同步 (${changeLog.length})` : "提交/同步"}</button>
                </div>
            </div>
        </div>
      </aside>
      
      <main className="flex-1 flex flex-col relative h-full bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')]">
         <header className="w-full backdrop-blur-sm border-b border-stone-200 px-4 py-3 flex justify-between items-center z-30 shrink-0 shadow-sm bg-white/90">
             <div className="text-sm text-gray-500 font-medium flex items-center gap-2">
                <button onClick={() => setSidebarOpen(true)} className="md:hidden mr-2 p-2 rounded-md hover:bg-gray-100 text-gray-600"><Menu size={24} /></button>
                <div className="hidden md:flex items-center gap-2 text-gray-600 text-xs bg-stone-100 px-2 py-1 rounded-md"><Filter size={12} />
                    <select value={minGeneration} onChange={(e) => setMinGeneration(Number(e.target.value))} className="bg-transparent border-none text-heritage-green font-bold focus:ring-0 p-0">
                        <option value={0}>世代: 全部</option>
                        {availableGenerations.map(gen => <option key={gen} value={gen}>第 {gen} 世+</option>)}
                    </select>
                </div>
             </div>
             <button onClick={toggleViewMode} className="bg-heritage-green/10 text-heritage-green px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                {viewMode === 'chart' ? <TableIcon size={16}/> : <Network size={16}/>}<span>{viewMode === 'chart' ? '編輯' : '圖表'}</span>
             </button>
         </header>
         <div className="flex-1 overflow-hidden relative">
             <div className="absolute inset-0 p-4 md:p-8">
                {viewMode === 'chart' ? (
                    <TreeVisualization data={filteredMembers} onSelectMember={handleSelectMember} rootId={ROOT_ID} focusId={focusMemberId} />
                ) : (
                    <div className="h-full w-full overflow-auto bg-white rounded-xl shadow-inner border border-stone-200">
                         <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-heritage-green sticky top-0 z-10"><tr>{['姓名', '配偶', '世代', '字號', '備註', '操作'].map(header => <th key={header} className="px-4 py-3 text-left font-medium text-white">{header}</th>)}</tr></thead>
                            <tbody className="bg-white divide-y divide-gray-200">{filteredMembers.filter(m => m.id !== ROOT_ID).map(member => (
                                <tr key={member.id} onClick={() => handleSelectMember(member.id)} className="hover:bg-stone-50 cursor-pointer transition-colors">
                                    <td className="px-4 py-3 text-gray-900 font-medium">{member.name}</td>
                                    <td className="px-4 py-3 text-gray-600">{member.spouseName || '-'}</td>
                                    <td className="px-4 py-3 text-gray-600">{member.generation || '-'}</td>
                                    <td className="px-4 py-3 text-gray-600">{member.courtesyName || '-'}</td>
                                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{member.biography || '-'}</td>
                                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><button onClick={() => handleConfirmDelete(member.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button></td>
                                </tr>
                            ))}</tbody>
                         </table>
                    </div>
                )}
             </div>
         </div>
         
         {(syncStatus === 'syncing' || syncStatus === 'verifying') && (
             <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                 <div className="bg-heritage-green text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 animate-bounce border-2 border-heritage-gold">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm font-bold">{syncMessage}</span>
                 </div>
             </div>
         )}
      </main>

      {hasUnsavedChanges && (syncStatus === 'idle' || syncStatus === 'conflict') && (
            <div className="fixed bottom-24 right-6 z-50 animate-in slide-in-from-bottom-4">
                <button onClick={() => setIsSubmitModalOpen(true)} className={`text-white p-4 rounded-full shadow-2xl hover:opacity-90 transition transform hover:scale-105 flex items-center gap-3 font-bold ring-4 ${syncStatus === 'conflict' ? 'bg-orange-600 ring-orange-100' : 'bg-heritage-gold ring-yellow-100'}`}>
                    {syncStatus === 'conflict' ? <AlertTriangle size={24}/> : <Send size={24}/>}
                    <span>{syncStatus === 'conflict' ? '版本衝突' : `提交變更 (${changeLog.length})`}</span>
                </button>
            </div>
      )}
      
      <MemberDetailModal member={selectedMember} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveMember} onDelete={handleConfirmDelete} allMembers={familyMembers} />
      <FamilyChat familyMembers={familyMembers} />
      <SubmitModal isOpen={isSubmitModalOpen} onClose={() => setIsSubmitModalOpen(false)} members={familyMembers} changeLog={changeLog} scriptUrl={scriptUrl} onCloudSync={() => handleCloudSync()} />
    </div>
  );
};
export default App;