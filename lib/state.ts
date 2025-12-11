/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
import {
  FunctionResponse,
  FunctionResponseScheduling,
  LiveServerToolCall,
} from '@google/genai';

export type Template = 'eburon-tts';
export type Theme = 'light' | 'dark';
export type VoiceStyle = 'natural' | 'conversational' | 'formal' | 'enthusiastic' | 'breathy' | 'dramatic';

const generateSystemPrompt = (language: string, speed: number = 1.0, style: VoiceStyle = 'natural') => {
  let speedInstruction = "PACE: Natural, conversational speed.";
  if (speed < 1.0) {
    speedInstruction = `PACE: Slower than normal (${speed}x). Enunciate clearly and take your time.`;
  } else if (speed > 1.0) {
    speedInstruction = `PACE: Faster than normal (${speed}x). Speak quickly and efficiently.`;
  }

  let personaInstruction = "";
  switch (style) {
    case 'formal':
      personaInstruction = `
VOICE PERSONA (The Professional Anchor):
- **Tone**: Objective, precise, clear, and composed.
- **Diction**: Crisp articulation, avoiding slang or fillers.
- **Rhythm**: Steady, even-paced, and authoritative.
- **Attitude**: Professional, trustworthy, informative.
`;
      break;
    case 'enthusiastic':
      personaInstruction = `
VOICE PERSONA (The Energetic Host):
- **Tone**: Bright, high-energy, eager, and smiling.
- **Dynamics**: Varied pitch to express excitement and positivity.
- **Rhythm**: Upbeat and slightly faster, with punchy emphasis.
- **Attitude**: Cheerful, motivating, engaging.
`;
      break;
    case 'breathy':
      personaInstruction = `
VOICE PERSONA (The Intimate Storyteller):
- **Tone**: Soft, airy, close-to-mic, and confidential.
- **Dynamics**: Gentle whispers to soft speaking.
- **Attitude**: Calm, soothing, mysterious.
`;
      break;
    case 'dramatic':
      personaInstruction = `
VOICE PERSONA (The Movie Trailer Voice):
- **Tone**: Deep, gravelly, epic, and suspenseful.
- **Rhythm**: Slow, deliberate, with heavy pauses for effect.
- **Attitude**: Serious, intense, cinematic.
`;
      break;
    case 'conversational':
      personaInstruction = `
VOICE PERSONA (The Friendly Peer):
- **Tone**: Warm, approachable, casual, and relaxed.
- **Rhythm**: Natural, with colloquial phrasing and comfortable pauses.
- **Attitude**: Friendly, chatty, relatable.
`;
      break;
    case 'natural':
    default:
      personaInstruction = `
VOICE PERSONA (The Balanced Speaker):
- **Tone**: Clear, neutral but engaging, and human-like.
- **Rhythm**: Standard conversational pace with natural breathing.
- **Attitude**: Helpful, polite, present.
`;
      break;
  }

  return `
SYSTEM MODE: STRICT TEXT-TO-SPEECH (TTS) ENGINE.
Role: You are an Elite Simultaneous Interpreter & Voice Actor.
Target Language: [${language || 'Taglish (Philippines)'}]
${speedInstruction}

⛔️ AUDIO STYLE TAGS PROTOCOL (CRITICAL):
1. The input text contains audio style tags enclosed in parentheses (...).
   Examples: (excitedly), (soft inhale), (pause), (clears throat), (slowly).
2. **THESE ARE SILENT INSTRUCTIONS FOR THE ACTOR.**
3. **NEVER READ THE TAGS ALOUD.** 
   - Incorrect: "Excitedly, hello there."
   - Correct: "Hello there!" (spoken in an excited tone)
4. **ACT OUT NON-VERBAL TAGS.**
   - If input is "(clears throat)", make the sound *hrrrm*, do NOT say "clears throat".
   - If input is "(soft inhale)", take a breath.

⛔️ NON-CONVERSATIONAL PROTOCOL (STRICT):
1. You are NOT a chatbot. You are NOT a conversational partner.
2. You must NOT reply to the text. You must NOT ask questions.
3. You must NOT say "Okay", "Sure", "Here is the translation", or "I understand".
4. You must IMMEDIATELY perform the translation of the input text into audio.

OBJECTIVE:
Translate the incoming text segments into [${language}] immediately and speak them.

PRONUNCIATION & VOCABULARY PROTOCOL:
1. **Native Authenticity**: You MUST adopt the exact accent, intonation, and phonology of a native speaker of the target locale. 
2. **Vocabulary Precision**: Use accurate local terminology, slang, and idioms appropriate for the region.
3. **Specific Handling**:
   - If [Taglish (Philippines)] is selected, you must naturally mix English and Tagalog (code-switching) as a native Manileño would.
4. **Natural Delivery**: Speak as a human, not a machine. Include natural breath pauses.

${personaInstruction}

PERFORM THE TRANSLATION NOW.
`;
};

/**
 * Settings
 */
export const useSettings = create<{
  systemPrompt: string;
  model: string;
  voice: string;
  voiceStyle: VoiceStyle;
  language: string;
  speechRate: number;
  backgroundPadEnabled: boolean;
  backgroundPadVolume: number;
  setSystemPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setVoice: (voice: string) => void;
  setVoiceStyle: (style: VoiceStyle) => void;
  setLanguage: (language: string) => void;
  setSpeechRate: (rate: number) => void;
  setBackgroundPadEnabled: (enabled: boolean) => void;
  setBackgroundPadVolume: (volume: number) => void;
}>(set => ({
  language: 'Taglish (Philippines)',
  speechRate: 1.0,
  voiceStyle: 'conversational',
  systemPrompt: generateSystemPrompt('Taglish (Philippines)', 1.0, 'conversational'),
  model: DEFAULT_LIVE_API_MODEL,
  voice: DEFAULT_VOICE,
  backgroundPadEnabled: false,
  backgroundPadVolume: 0.2,
  setSystemPrompt: prompt => set({ systemPrompt: prompt }),
  setModel: model => set({ model }),
  setVoice: voice => set({ voice }),
  setVoiceStyle: voiceStyle => set(state => ({ 
    voiceStyle,
    systemPrompt: generateSystemPrompt(state.language, state.speechRate, voiceStyle)
  })),
  setLanguage: language => set(state => ({ 
    language, 
    systemPrompt: generateSystemPrompt(language, state.speechRate, state.voiceStyle) 
  })),
  setSpeechRate: rate => set(state => ({ 
    speechRate: rate, 
    systemPrompt: generateSystemPrompt(state.language, rate, state.voiceStyle) 
  })),
  setBackgroundPadEnabled: enabled => set({ backgroundPadEnabled: enabled }),
  setBackgroundPadVolume: volume => set({ backgroundPadVolume: volume }),
}));

/**
 * UI
 */
export const useUI = create<{
  isSidebarOpen: boolean;
  theme: Theme;
  toggleSidebar: () => void;
  toggleTheme: () => void;
}>(set => ({
  isSidebarOpen: false, // Default closed on mobile-first approach
  theme: 'dark',
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleTheme: () => set(state => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
}));

/**
 * Tools
 */
export interface FunctionCall {
  name: string;
  description?: string;
  parameters?: any;
  isEnabled: boolean;
  scheduling?: FunctionResponseScheduling;
}

export const useTools = create<{
  tools: FunctionCall[];
  template: Template;
  setTemplate: (template: Template) => void;
  toggleTool: (toolName: string) => void;
  addTool: () => void;
  removeTool: (toolName: string) => void;
  updateTool: (oldName: string, updatedTool: FunctionCall) => void;
}>(set => ({
  tools: [], // Default to no tools for read-aloud mode
  template: 'eburon-tts',
  setTemplate: (template: Template) => {
    // No-op for now as we only have one mode
  },
  toggleTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === toolName ? { ...tool, isEnabled: !tool.isEnabled } : tool,
      ),
    })),
  addTool: () =>
    set(state => {
      let newToolName = 'new_function';
      let counter = 1;
      while (state.tools.some(tool => tool.name === newToolName)) {
        newToolName = `new_function_${counter++}`;
      }
      return {
        tools: [
          ...state.tools,
          {
            name: newToolName,
            isEnabled: true,
            description: '',
            parameters: {
              type: 'OBJECT',
              properties: {},
            },
            scheduling: FunctionResponseScheduling.INTERRUPT,
          },
        ],
      };
    }),
  removeTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.filter(tool => tool.name !== toolName),
    })),
  updateTool: (oldName: string, updatedTool: FunctionCall) =>
    set(state => {
      if (
        oldName !== updatedTool.name &&
        state.tools.some(tool => tool.name === updatedTool.name)
      ) {
        console.warn(`Tool with name "${updatedTool.name}" already exists.`);
        return state;
      }
      return {
        tools: state.tools.map(tool =>
          tool.name === oldName ? updatedTool : tool,
        ),
      };
    }),
}));

/**
 * Logs
 */
export interface LiveClientToolResponse {
  functionResponses?: FunctionResponse[];
}
export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface ConversationTurn {
  id?: string;
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  text: string;
  translation?: string;
  sourceText?: string;
  isFinal: boolean;
  speaker?: string; // New field for speaker identification
  toolUseRequest?: LiveServerToolCall;
  toolUseResponse?: LiveClientToolResponse;
  groundingChunks?: GroundingChunk[];
}

export const useLogStore = create<{
  turns: ConversationTurn[];
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (update: Partial<ConversationTurn>) => void;
  updateTurn: (id: string, update: Partial<ConversationTurn>) => void;
  clearTurns: () => void;
}>((set, get) => ({
  turns: [],
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) =>
    set(state => ({
      turns: [...state.turns, { ...turn, timestamp: new Date() }],
    })),
  updateLastTurn: (update: Partial<Omit<ConversationTurn, 'timestamp'>>) => {
    set(state => {
      if (state.turns.length === 0) {
        return state;
      }
      const newTurns = [...state.turns];
      const lastTurn = { ...newTurns[newTurns.length - 1], ...update };
      newTurns[newTurns.length - 1] = lastTurn;
      return { turns: newTurns };
    });
  },
  updateTurn: (id: string, update: Partial<ConversationTurn>) => {
    set(state => ({
      turns: state.turns.map(turn => 
        turn.id === id ? { ...turn, ...update } : turn
      ),
    }));
  },
  clearTurns: () => set({ turns: [] }),
}));