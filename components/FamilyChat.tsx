import React, { useState, useRef, useEffect } from 'react';
import { createFamilyChatSession } from '../services/geminiService';
import { MessageSquare, X, Send, Sparkles, User, Bot } from 'lucide-react';
import { GenerateContentResponse } from '@google/genai';
import { FamilyMember } from '../types';

interface Props {
  familyMembers: FamilyMember[];
}

const FamilyChat: React.FC<Props> = ({ familyMembers }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to generate CSV only when needed
  const generateContext = (members: FamilyMember[]) => {
      // Updated headers to include new fields for AI Context
      const header = ['Name', 'SpouseName', 'Father', 'Mother', 'Generation', 'CourtesyName', 'Notes', 'Gender', 'BirthDate', 'DeathDate', 'Location', 'Phone', 'Email'].join(',');
      const rows = members.map(m => {
          const escape = (val: string | number | undefined) => {
              if (val === undefined || val === null) return '';
              const s = String(val);
              return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s;
          };
          
          // Find parent names if only IDs are present to help AI context
          const fatherName = m.fatherName || members.find(f => f.id === m.fatherId)?.name || '';
          const motherName = m.motherName || members.find(mo => mo.id === m.motherId)?.name || '';

          return [
              m.name, m.spouseName, fatherName, motherName, 
              m.generation, m.courtesyName, m.biography,
              m.gender, m.birthDate, m.deathDate, m.location, m.phone, m.email
          ].map(escape).join(',');
      });
      return [header, ...rows].join('\n');
  };

  useEffect(() => {
    // Only create session when opened and session doesn't exist
    if (isOpen && !chatSession) {
      const csvData = generateContext(familyMembers);
      const session = createFamilyChatSession(csvData);
      setChatSession(session);
      setMessages([{ role: 'model', text: '您好！我是曹家的家族史官。關於這個家族的歷史、成員關係或軼事，您想知道什麼？' }]);
    }
  }, [isOpen, familyMembers, chatSession]); // Depend on isOpen

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !chatSession) return;
    
    const userMsg = inputValue;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const result = await chatSession.sendMessage({ message: userMsg });
      const text = (result as GenerateContentResponse).text;
      setMessages(prev => [...prev, { role: 'model', text: text || '抱歉，我無法回答這個問題。' }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'model', text: '連線發生錯誤，請稍後再試。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-heritage-green text-white p-4 rounded-full shadow-2xl hover:bg-green-800 transition transform hover:scale-105 z-40 flex items-center gap-2"
        >
          <Sparkles size={20} className="text-heritage-gold" />
          <span className="font-medium pr-1">家族史官</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-full max-w-md h-[500px] bg-white rounded-2xl shadow-2xl z-40 flex flex-col border border-stone-200 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="bg-heritage-green text-white p-4 rounded-t-2xl flex justify-between items-center">
            <div className="flex items-center gap-2">
               <div className="bg-white/20 p-1.5 rounded-full">
                  <Sparkles size={18} className="text-heritage-gold"/>
               </div>
               <div>
                   <h3 className="font-bold text-sm">家族 AI 史官</h3>
                   <p className="text-[10px] text-gray-300">Powered by Gemini 3</p>
               </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-1 rounded transition">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-gray-200 text-gray-600' : 'bg-heritage-gold text-white'}`}>
                    {msg.role === 'user' ? <User size={16}/> : <Bot size={16}/>}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                    ? 'bg-white text-gray-800 border border-gray-100 rounded-tr-none' 
                    : 'bg-white text-gray-800 border border-heritage-gold/20 rounded-tl-none'
                }`}>
                    {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
               <div className="flex gap-3">
                 <div className="w-8 h-8 rounded-full bg-heritage-gold text-white flex items-center justify-center shrink-0">
                    <Bot size={16}/>
                 </div>
                 <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-heritage-gold/20 flex gap-1 items-center">
                    <span className="w-2 h-2 bg-heritage-gold rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-heritage-gold rounded-full animate-bounce delay-75"></span>
                    <span className="w-2 h-2 bg-heritage-gold rounded-full animate-bounce delay-150"></span>
                 </div>
               </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-gray-100 rounded-b-2xl">
             <div className="relative flex items-center">
                 <input 
                    type="text" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="詢問家族歷史..."
                    className="w-full bg-gray-100 text-gray-800 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-heritage-gold/50 transition"
                    disabled={isLoading}
                 />
                 <button 
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                    className="absolute right-2 p-2 bg-heritage-green text-white rounded-full hover:bg-green-800 disabled:opacity-50 transition"
                 >
                    <Send size={16} />
                 </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FamilyChat;