import { useEffect, useRef, useState } from 'react';
const base = (import.meta as ImportMeta & {env:Record<string,string>}).env.VITE_AI_BASE_URL || '';
export function VoiceControls({text, busy, onSend, onActive}: {text:string; busy:boolean; onSend:(text:string)=>void; onActive:(active:boolean)=>void}) {
  const [enabled,setEnabled]=useState(false), [recording,setRecording]=useState(false), [working,setWorking]=useState(false), [notice,setNotice]=useState('');
  const recorder=useRef<MediaRecorder|null>(null), audio=useRef<HTMLAudioElement|null>(null), stream=useRef<MediaStream|null>(null), timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(recorder.current){recorder.current.onstop=null;if(recorder.current.state==='recording')recorder.current.stop();} stream.current?.getTracks().forEach(t=>t.stop()); audio.current?.pause(); if(timer.current)clearTimeout(timer.current);},[]);
  useEffect(()=>{
    if(!enabled || !text) return;
    const controller=new AbortController(); let url='';
    onActive(true); setWorking(true);
    void (async()=>{try{
      const res=await fetch(`${base}/api/voice/speak`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:controller.signal});
      if(!res.ok) throw new Error((await res.json()).error);
      url=URL.createObjectURL(await res.blob()); const player=new Audio(url); audio.current=player;
      player.onended=()=>onActive(false); player.onerror=()=>onActive(false); await player.play();
    }catch(e){if(!controller.signal.aborted){setNotice(e instanceof Error?e.message:'Voice unavailable');onActive(false);}}finally{if(!controller.signal.aborted)setWorking(false);}})();
    return ()=>{controller.abort(); audio.current?.pause(); if(url)URL.revokeObjectURL(url); onActive(false);};
  },[enabled,text]);
  async function toggle(){
    if(enabled){setEnabled(false); recorder.current?.state==='recording' && recorder.current.stop();return;}
    try{const r=await fetch(`${base}/api/voice/status`); const d=await r.json(); if(!d.configured)throw new Error('ElevenLabs setup is pending. You can still type.');setNotice('');setEnabled(true);}catch(e){setNotice(e instanceof Error?e.message:'Voice unavailable');}
  }
  async function record(){
    if(recording){recorder.current?.stop();return;}
    try{
      audio.current?.pause(); onActive(true);setNotice('');
      stream.current=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
      const rec=new MediaRecorder(stream.current);recorder.current=rec;const chunks:Blob[]=[];
      rec.ondataavailable=e=>chunks.push(e.data);
      rec.onstop=async()=>{if(timer.current)clearTimeout(timer.current); stream.current?.getTracks().forEach(t=>t.stop());setRecording(false);setWorking(true);
        try{const blob=new Blob(chunks,{type:rec.mimeType}); const encoded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});
          const r=await fetch(`${base}/api/voice/transcribe`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio:encoded,type:rec.mimeType}),signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok)throw new Error(d.error);if(d.text.trim())onSend(d.text);else setNotice('No speech heard. Try again.');
        }catch(e){setNotice(e instanceof Error?e.message:'Could not transcribe');}finally{setWorking(false);onActive(false);}
      };
      rec.start();setRecording(true);timer.current=setTimeout(()=>rec.stop(),30000);
    }catch{setNotice('Microphone unavailable. Allow microphone access or type instead.');onActive(false);}
  }
  return <div className="voice-controls"><button type="button" aria-pressed={enabled} onClick={toggle} disabled={recording || working}>{enabled?'Turn voice off':'Enable ElevenLabs voice'}</button>{enabled && <button type="button" onClick={record} disabled={busy || working}>{recording?'Send recording':working?'Processing voice…':'Talk to Duvet'}</button>}<p role="status">{recording?'Listening… tap Send recording when finished.':notice || (enabled?'Tap to talk. Alarm quiets while listening and speaking.':'')}</p></div>;
}
