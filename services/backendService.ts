
import { FamilyMember } from '../types';

const API_ENDPOINT = '/api/family-tree'; 

export type CloudResponse = 
  | { status: 'success'; data: FamilyMember[] }
  | { status: 'empty' } 
  | { status: 'server-error'; message: string } 
  | { status: 'network-error'; message: string };

// --- HELPER ---
const handleFetch = async (url: string, method: 'GET' | 'POST', body?: any): Promise<CloudResponse | void> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 30000); // Increased timeout for large uploads

    try {
        const options: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal
        };
        if (body) options.body = JSON.stringify(body);

        console.log(`[Network] ${method} ${url}`);
        const response = await fetch(url, options);
        clearTimeout(id);

        if (method === 'POST') {
            if (!response.ok) {
                const text = await response.text();
                // If response is HTML (like 404 default), show a generic error
                if (text.trim().startsWith('<')) {
                    throw new Error(`伺服器設定錯誤 (Status ${response.status})。請聯繫管理員。`);
                }
                try {
                    const json = JSON.parse(text);
                    throw new Error(json.error || `Error ${response.status}`);
                } catch (e: any) {
                     // If it was valid text but not JSON, use the text
                     if (e.message.includes('JSON')) throw new Error(text || `Error ${response.status}`);
                     throw e;
                }
            }
            return;
        }

        if (response.status === 404) return { status: 'empty' };
        if (!response.ok) {
            const text = await response.text();
            return { status: 'server-error', message: text };
        }

        const data = await response.json();
        if (Array.isArray(data)) return { status: 'success', data };
        return { status: 'server-error', message: 'Invalid JSON format' };

    } catch (error: any) {
        clearTimeout(id);
        console.warn(`Fetch error for ${url}:`, error);
        
        let msg = error.message;
        if (error.name === 'AbortError') msg = '連線逾時 (Timeout)';
        else if (msg.includes('Failed to fetch')) msg = '無法連線到伺服器 (Network Error)';
        
        // If it's the HTML error passed through
        if (msg.includes('<!DOCTYPE')) msg = '伺服器路由錯誤 (404/500)';

        if (method === 'POST') throw new Error(msg);
        return { status: 'network-error', message: msg };
    }
};

// --- DATA OPERATIONS ---
export const loadFromCloud = () => handleFetch(API_ENDPOINT, 'GET') as Promise<CloudResponse>;
export const saveToCloud = (members: FamilyMember[]) => handleFetch(API_ENDPOINT, 'POST', members) as Promise<void>;
