import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

// Safely retrieve API Key
const GEMINI_API_KEY = process.env.API_KEY;

// Initialize Google GenAI conditionally to prevent app crash on load if key is missing
let ai: GoogleGenAI | null = null;
if (GEMINI_API_KEY && GEMINI_API_KEY !== "undefined") {
  try {
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  } catch (error) {
    console.warn("Failed to initialize Google GenAI SDK:", error);
  }
}

export interface NarratorResponse {
  message: string;
  tone: 'neutral' | 'urgent' | 'celebratory' | 'ominous';
}

// DeepSeek Configuration
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_URL = "https://api.deepseek.com";

// Initialize OpenAI client for DeepSeek
// Use a placeholder if key is missing to prevent OpenAI SDK from throwing on init
const deepseekClient = new OpenAI({
  baseURL: DEEPSEEK_URL,
  apiKey: DEEPSEEK_KEY || "missing-key", 
  dangerouslyAllowBrowser: true 
});

async function callDeepSeek(prompt: string): Promise<string> {
    if (!DEEPSEEK_KEY || DEEPSEEK_KEY === "undefined") {
        throw new Error("DeepSeek API Key is missing.");
    }

    const completion = await deepseekClient.chat.completions.create({
        messages: [
            { role: "system", content: "You are a creative game narrator. Answer in Chinese." },
            { role: "user", content: prompt }
        ],
        model: "deepseek-chat",
        temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || "";
}

export const generateNarratorText = async (
  level: number, 
  context: 'START' | 'BOSS' | 'WIN' | 'LOSE'
): Promise<NarratorResponse> => {
  const model = "gemini-2.5-flash";
  let prompt = "";

  switch (context) {
    case 'START':
      prompt = `You are the narrator of a cartoon game called "Cell Defenders". 
      The players are a Red Blood Cell and a White Blood Cell inside a human body.
      Level ${level} just started. Briefly describe the organ (e.g. Lungs, Stomach, Heart) and the bacterial threat in 1 funny sentence.
      Please answer in Chinese.`;
      break;
    case 'BOSS':
      prompt = `A Boss Monster has appeared in the "Cell Defenders" game!
      It is Level ${level}. Generate a short, menacing but cartoonish taunt from the germ boss in 1 sentence.
      Please answer in Chinese.`;
      break;
    case 'WIN':
      prompt = `The players beat Level ${level} and saved the Oxygen. Give a 1 sentence congratulatory remark from a biological perspective.
      Please answer in Chinese.`;
      break;
    case 'LOSE':
      prompt = `The players died on Level ${level}. The body is sick. Give a 1 sentence sad but cute medical report.
      Please answer in Chinese.`;
      break;
  }

  let textResult = "";

  // 1. Try Gemini (Only if initialized)
  if (ai) {
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });
        textResult = response.text?.trim() || "";
    } catch (error) {
        console.warn("Gemini API failed, attempting DeepSeek fallback...", error);
    }
  } else {
      console.warn("Gemini API Key missing, skipping Gemini.");
  }

  // 2. Fallback to DeepSeek if Gemini failed or was skipped
  if (!textResult) {
    try {
        textResult = await callDeepSeek(prompt);
    } catch (dsError) {
        console.error("DeepSeek API failed or missing", dsError);
        // 3. Fallback to Offline/Default
        textResult = "连接大脑指令失败... 请小心行事！";
    }
  }

  return {
    message: textResult,
    tone: context === 'BOSS' || context === 'LOSE' ? 'ominous' : 'celebratory'
  };
};