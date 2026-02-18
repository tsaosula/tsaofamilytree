import { GoogleGenAI } from "@google/genai";
import { FamilyMember } from "../types";

// Initialize client safely using process.env.API_KEY directly as per guidelines
const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateBiography = async (member: FamilyMember, extraNotes: string): Promise<string> => {
  const client = getClient();
  
  const prompt = `
    你是一位專業的家族歷史學家。請根據以下資料，為這位家族成員撰寫一段感人、流暢且專業的傳記（約 200 字）。
    使用繁體中文。

    姓名: ${member.name}
    性別: ${member.gender}
    出生: ${member.birthDate || '未知'}
    逝世/享壽: ${member.deathDate || '未知'}
    居住地: ${member.location || '未知'}
    
    額外筆記/趣事:
    ${extraNotes}

    請將重點放在其生平貢獻與個人特質，語氣溫暖莊重。如果對方已逝世，請用緬懷的語氣；若尚未記載逝世日期，則視為在世或資料不全。
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "無法生成傳記。";
  } catch (error) {
    console.error("Biography generation failed:", error);
    return "生成傳記時發生錯誤，請稍後再試。";
  }
};

export const createFamilyChatSession = (csvContext: string) => {
  const client = getClient();

  return client.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `
        你是一位精通這份家族族譜的「家族史官」。
        你的任務是回答關於這個家族的任何問題。
        
        以下是完整的家族資料 (CSV 格式):
        ${csvContext}
        
        回答規則:
        1. 使用繁體中文。
        2. 根據 CSV 資料進行推理（例如計算子女人數、尋找共同祖先、解釋世代關係、計算享壽年歲）。
        3. 如果資料中沒有答案，請誠實回答「族譜中未記載」。
        4. 語氣親切、尊師重道。
      `,
    }
  });
};