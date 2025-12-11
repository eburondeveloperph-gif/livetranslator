/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef, useState, memo, useCallback } from 'react';
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

type AudioSource = 'microphone' | 'screen_tab';

export default function Broadcaster() {
  const { client, connect, disconnect, connected, setConfig } = useLiveAPIContext();
  const [isRecording, setIsRecording] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [transcript, setTranscript] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [audioSource, setAudioSource] = useState<AudioSource>('microphone');
  
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
        const { error } = await supabase.from('transcripts').upsert({
          session_id: sid,
          user_id: 'broadcaster-user', 
          full_transcript_text: fullText,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' }).select();
      } catch (e) {
        console.error("DB Save Error", e);
      }
    };

    const debouncedSave = debounce(async (text: string) => {
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
    }, 2000); 

    dbUpdateRef.current = debouncedSave;
  }, []);

  // Setup Gemini Config for Broadcaster Mode
  useEffect(() => {
    const config: LiveConnectConfig = {
      responseModalities: [Modality.TEXT],
      systemInstruction: { parts: [{ text: BROADCASTER_SYSTEM_PROMPT }] },
    };
    setConfig(config);
  }, [setConfig]);

  const stopBroadcast = useCallback(() => {
    recorderRef.current?.stop();
    disconnect();
    setIsRecording(false);
    setMicVolume(0);
  }, [disconnect]);

  // Handle Recording Logic
  const toggleBroadcast = async () => {
    if (isRecording) {
      stopBroadcast();
    } else {
      let stream: MediaStream | undefined;

      try {
        if (audioSource === 'screen_tab') {
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true, // Required to prompt, but we ignore video
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
              } 
            });
            
            // Check if user shared audio
            if (stream.getAudioTracks().length === 0) {
              alert("No audio track detected. Please make sure to check 'Share tab audio' in the browser dialog.");
              stream.getTracks().forEach(t => t.stop());
              return;
            }

            // Handle user stopping share via browser UI
            stream.getVideoTracks()[0].onended = () => {
              stopBroadcast();
            };
          } catch (err: any) {
            console.error("Error getting display media:", err);
            if (err.name === 'NotAllowedError') {
              // User cancelled
              return;
            }
            if (err.toString().includes('permissions policy')) {
               alert("Error: Screen sharing is disabled in this environment. Please ensure 'display-capture' permission is allowed.");
            } else {
               alert("Failed to start screen sharing: " + err.message);
            }
            return; // Cancelled or failed
          }
        }

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

        await recorder.start(stream);
      } catch (e) {
        console.error("Failed to start broadcast", e);
        stopBroadcast();
      }
    }
  };

  // Handle Incoming Text from Gemini
  useEffect(() => {
    const handleContent = (serverContent: any) => {
      if (serverContent.modelTurn?.parts) {
        serverContent.modelTurn.parts.forEach((part: any) => {
          if (part.text) {
             const newText = part.text;
             transcriptRef.current += newText;
             setTranscript(transcriptRef.current);
             
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
        <div className="source-selector">
          <label>Audio Source</label>
          <div className="source-options">
            <button 
              className={`source-btn ${audioSource === 'microphone' ? 'selected' : ''}`}
              onClick={() => !isRecording && setAudioSource('microphone')}
              disabled={isRecording}
            >
              <span className="material-symbols-outlined">mic</span>
              Microphone
            </button>
            <button 
              className={`source-btn ${audioSource === 'screen_tab' ? 'selected' : ''}`}
              onClick={() => !isRecording && setAudioSource('screen_tab')}
              disabled={isRecording}
              title="Share a Chrome Tab (YouTube, Spotify, etc.) or Window"
            >
              <span className="material-symbols-outlined">tab</span>
              System / Tab Audio
            </button>
          </div>
        </div>

        {audioSource === 'screen_tab' && !isRecording && (
          <div className="hint-text">
            ℹ️ Select <strong>"Chrome Tab"</strong> and check <strong>"Share Audio"</strong> in the next popup to capture YouTube/Web audio.
          </div>
        )}

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