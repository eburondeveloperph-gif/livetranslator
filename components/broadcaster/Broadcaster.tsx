/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef, useState, memo } from 'react';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import { BROADCASTER_SYSTEM_PROMPT } from '@/lib/state';
import { LiveConnectConfig, Modality } from '@google/genai';
import { AudioRecorder } from '@/lib/audio-recorder';
import { supabase } from '@/lib/supabase';
import './Broadcaster.css';

// Simple debounce helper
function debounce(func: Function, wait: number) {
  let timeout: any;
  return function(...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default function Broadcaster() {
  const { client, connect, disconnect, connected, setConfig } = useLiveAPIContext();
  const [isRecording, setIsRecording] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [transcript, setTranscript] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  
  // Refs for data persistence across renders
  const recorderRef = useRef<AudioRecorder | null>(null);
  const transcriptRef = useRef<string>('');
  const sessionIdRef = useRef<string>('');
  const dbUpdateRef = useRef<Function | null>(null);

  // Initialize Session ID
  useEffect(() => {
    const sid = crypto.randomUUID();
    setSessionId(sid);
    sessionIdRef.current = sid;
  }, []);

  // Setup DB Save Function (Debounced)
  useEffect(() => {
    const saveToDb = async (fullText: string) => {
      const sid = sessionIdRef.current;
      if (!sid || !fullText) return;
      
      try {
        // Upsert logic for transcripts table
        const { error } = await supabase.from('transcripts').upsert({
          session_id: sid,
          user_id: 'broadcaster-user', // Placeholder, ideally from auth
          full_transcript_text: fullText,
          updated_at: new Date().toISOString(),
          // Use a dummy ID or handle conflict if ID is missing. 
          // Assuming session_id is unique enough or we let PG gen ID on first insert.
          // For UPSERT on ID, we need the ID. 
          // Let's try to fetch ID first or rely on session_id if we had a unique constraint.
          // Given the schema provided: "primary key (id)", and "index on session_id". 
          // We'll verify if a row exists for this session first.
        }, { onConflict: 'id' }).select();

        // Optimized approach: We probably want to Insert once, then Update.
      } catch (e) {
        console.error("DB Save Error", e);
      }
    };

    // Actual Implementation with Debounce
    const debouncedSave = debounce(async (text: string) => {
       // Since the schema uses ID as PK, we need to know the ID to update.
       // Strategy: Attempt UPDATE by session_id. If 0 rows, INSERT.
       const sid = sessionIdRef.current;
       
       const { data } = await supabase.from('transcripts').select('id').eq('session_id', sid).single();
       
       if (data?.id) {
         await supabase.from('transcripts').update({
           full_transcript_text: text,
           updated_at: new Date().toISOString()
         }).eq('id', data.id);
       } else {
         await supabase.from('transcripts').insert({
           session_id: sid,
           user_id: 'broadcaster-user',
           full_transcript_text: text,
           source_language: 'auto'
         });
       }
    }, 2000); // Save every 2 seconds

    dbUpdateRef.current = debouncedSave;
  }, []);

  // Setup Gemini Config for Broadcaster Mode
  useEffect(() => {
    const config: LiveConnectConfig = {
      responseModalities: [Modality.TEXT], // We want TEXT back
      systemInstruction: { parts: [{ text: BROADCASTER_SYSTEM_PROMPT }] },
      // Note: We deliberately do NOT include speechConfig here.
      // This is a transcription-only mode.
    };
    setConfig(config);
  }, [setConfig]);

  // Handle Recording Logic
  const toggleBroadcast = async () => {
    if (isRecording) {
      // Stop
      recorderRef.current?.stop();
      disconnect();
      setIsRecording(false);
      setMicVolume(0);
    } else {
      // Start
      await connect();
      setIsRecording(true);
      
      const recorder = new AudioRecorder();
      recorderRef.current = recorder;
      
      recorder.on('data', (base64) => {
        client.sendRealtimeInput([{ mimeType: 'audio/pcm;rate=16000', data: base64 }]);
      });
      
      recorder.on('volume', (vol) => {
        setMicVolume(vol);
      });

      await recorder.start();
    }
  };

  // Handle Incoming Text from Gemini
  useEffect(() => {
    const handleContent = (serverContent: any) => {
      // Logic to extract text from modelTurn
      if (serverContent.modelTurn?.parts) {
        serverContent.modelTurn.parts.forEach((part: any) => {
          if (part.text) {
             const newText = part.text;
             transcriptRef.current += newText;
             setTranscript(transcriptRef.current);
             
             // Trigger DB save
             if (dbUpdateRef.current) {
               dbUpdateRef.current(transcriptRef.current);
             }
          }
        });
      }
    };

    client.on('content', handleContent);
    return () => {
      client.off('content', handleContent);
    };
  }, [client]);

  // Cleanup
  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
    };
  }, []);

  // Visualizer bars
  const bars = 10;
  const activeBars = Math.ceil(micVolume * 10 * bars); 

  return (
    <div className="broadcaster-container">
      <div className="broadcaster-header">
        <div className="status-indicator">
          <div className={`status-dot ${isRecording ? 'recording' : ''}`}></div>
          <span>{isRecording ? 'ON AIR' : 'OFFLINE'}</span>
        </div>
        <div className="session-info">
          Session ID: <span className="mono">{sessionId.slice(0, 8)}...</span>
        </div>
      </div>

      <div className="broadcaster-main">
        <div className="transcript-preview">
           <pre>{transcript || "Waiting for audio..."}</pre>
        </div>
      </div>

      <div className="broadcaster-controls">
        <div className="mic-visualizer">
           {[...Array(bars)].map((_, i) => (
             <div 
               key={i} 
               className="mic-bar"
               style={{
                 height: i < activeBars ? '100%' : '20%',
                 backgroundColor: isRecording ? 'var(--accent-red)' : 'var(--Neutral-30)'
               }}
             />
           ))}
        </div>
        
        <button 
          className={`broadcast-button ${isRecording ? 'active' : ''}`}
          onClick={toggleBroadcast}
        >
          {isRecording ? 'STOP BROADCAST' : 'START BROADCAST'}
        </button>
      </div>
    </div>
  );
}