import { useEffect, useRef, useState } from 'react';
const base = (import.meta as ImportMeta & {env:Record<string,string>}).env.VITE_AI_BASE_URL || '';
type Phase = 'off' | 'ready' | 'listening' | 'thinking' | 'speaking';
export function VoiceControls({text, busy, onSend, onActive}: {text:string; busy:boolean; onSend:(text:string)=>void; onActive:(active:boolean)=>void}) {
  const [enabled,setEnabled]=useState(false), [phase,setPhase]=useState<Phase>('off'), [notice,setNotice]=useState('');
  const active=useRef(false), generation=useRef(0), audio=useRef<HTMLAudioElement|null>(null), request=useRef<AbortController|null>(null), recorder=useRef<MediaRecorder|null>(null), stream=useRef<MediaStream|null>(null), monitor=useRef<AudioContext|null>(null), frame=useRef(0), timer=useRef<ReturnType<typeof setTimeout>|null>(null), objectUrl=useRef(''), channel=useRef<BroadcastChannel|null>(null), callbacks=useRef({onSend,onActive,busy});
  callbacks.current={onSend,onActive,busy};
  function stopMedia(){
    generation.current++; request.current?.abort(); request.current=null;
    if(audio.current){audio.current.onended=null;audio.current.onerror=null;audio.current.pause();audio.current.src='';audio.current=null;}
    if(objectUrl.current){URL.revokeObjectURL(objectUrl.current);objectUrl.current='';}
    if(recorder.current){recorder.current.onstop=null;if(recorder.current.state==='recording')recorder.current.stop();recorder.current=null;}
    stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;
    cancelAnimationFrame(frame.current);if(timer.current)clearTimeout(timer.current);
    void monitor.current?.close();monitor.current=null;
  }
  function end(){active.current=false;stopMedia();setEnabled(false);setPhase('off');callbacks.current.onActive(false);}
  useEffect(()=>{
    const c = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('duvet-voice-owner') : null;channel.current=c;
    if(c)c.onmessage=()=>{if(active.current)end();};
    return ()=>{active.current=false;stopMedia();callbacks.current.onActive(false);c?.close();};
  },[]);
  async function listen(){
    if(!active.current || callbacks.current.busy)return;
    stopMedia(); const id=generation.current;setPhase('ready');setNotice('');
    try{
      const mic=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      if(!active.current || generation.current!==id){mic.getTracks().forEach(t=>t.stop());return;}
      stream.current=mic;
      const rec=new MediaRecorder(mic), chunks:Blob[]=[];recorder.current=rec;
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      let heard=false;
      rec.onstop=async()=>{
        cancelAnimationFrame(frame.current);if(timer.current)clearTimeout(timer.current);mic.getTracks().forEach(t=>t.stop());stream.current=null;void monitor.current?.close();monitor.current=null;
        if(!active.current || generation.current!==id)return;
        if(!heard){setNotice('No speech detected. Tap the orb to try again.');setPhase('ready');return;}
        setPhase('thinking');const controller=new AbortController();request.current=controller;
        try{
          const blob=new Blob(chunks,{type:rec.mimeType});const encoded=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=reject;r.readAsDataURL(blob);});
          if(!active.current || generation.current!==id)return;
          const res=await fetch(`${base}/api/voice/transcribe`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({audio:encoded,type:rec.mimeType}),signal:controller.signal});const data=await res.json();if(!res.ok)throw Error(data.error);
          if(!active.current || generation.current!==id)return;
          if(data.text?.trim())callbacks.current.onSend(data.text);else{setPhase('ready');setNotice('No speech heard. Tap the orb to try again.');}
        }catch(e){if(!controller.signal.aborted && active.current){setPhase('ready');setNotice(e instanceof Error?e.message:'Could not transcribe.');}}
      };
      rec.start();setPhase('listening');
      const ctx=new AudioContext();monitor.current=ctx;await ctx.resume();const analyser=ctx.createAnalyser();analyser.fftSize=1024;ctx.createMediaStreamSource(mic).connect(analyser);const values=new Float32Array(analyser.fftSize);const start=performance.now();let lastSpeech=start,voiced=0;
      const sample=()=>{
        if(!active.current || generation.current!==id || rec.state!=='recording')return;
        analyser.getFloatTimeDomainData(values);const rms=Math.sqrt(values.reduce((sum,v)=>sum+v*v,0)/values.length);const now=performance.now();
        if(rms>0.018){voiced++;lastSpeech=now;if(voiced>=5)heard=true;}
        if(heard && now-lastSpeech>1300){rec.stop();return;}
        frame.current=requestAnimationFrame(sample);
      };sample();timer.current=setTimeout(()=>{if(rec.state==='recording')rec.stop();},30000);
    }catch{if(active.current && generation.current===id){stopMedia();setPhase('ready');setNotice('Microphone unavailable. Allow microphone access, then tap the orb.');}}
  }
  useEffect(()=>{
    if(!enabled || !text || busy)return;
    stopMedia();const id=generation.current;const controller=new AbortController();request.current=controller;setPhase('thinking');setNotice('');
    void(async()=>{try{
      const res=await fetch(`${base}/api/voice/speak`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:controller.signal});if(!res.ok)throw Error((await res.json()).error);
      const blob=await res.blob();if(!active.current || id!==generation.current)return;
      objectUrl.current=URL.createObjectURL(blob);const player=new Audio(objectUrl.current);audio.current=player;
      player.onended=()=>{if(active.current && id===generation.current)void listen();};
      player.onerror=()=>{if(active.current && id===generation.current){setPhase('ready');setNotice('Playback failed. Tap the orb to speak.');}};
      setPhase('speaking');await player.play();
    }catch(e){if(!controller.signal.aborted && active.current && id===generation.current){setPhase('ready');setNotice(e instanceof Error?e.message:'Voice unavailable.');}}})();
    return ()=>stopMedia();
  },[enabled,text,busy]);
  async function start(){
    setNotice('');try{const r=await fetch(`${base}/api/voice/status`);const d=await r.json();if(!d.configured)throw Error('ElevenLabs is not connected. You can still type.');channel.current?.postMessage('claim');active.current=true;callbacks.current.onActive(true);setEnabled(true);}catch(e){setNotice(e instanceof Error?e.message:'Voice unavailable.');}
  }
  function interrupt(){
    if(phase==='listening'){recorder.current?.stop();return;}
    if(!busy)void listen();
  }
  const label=phase==='speaking'?'Duvet is speaking':phase==='thinking'?'Duvet is thinking':phase==='listening'?'Listening to you':'Ready when you are';
  return <section className="voice-controls" aria-label="Duvet voice conversation">
    {enabled ? <><div className="voice-stage" data-phase={phase}><button className="voice-orb" type="button" onClick={interrupt} disabled={busy} aria-label={phase==='listening'?'Send voice message':phase==='speaking'?'Interrupt Duvet and speak':'Start speaking'}><span/><span/><span/></button><strong role="status">{label}</strong><p>{phase==='speaking'?'Tap the orb to interrupt':phase==='listening'?'Speak naturally. Pause to send.':'One thought at a time.'}</p></div><button type="button" className="voice-end" onClick={end}>End voice conversation</button></> : <button type="button" onClick={start}>Start voice conversation</button>}
    {notice && <p className="voice-notice" role="status">{notice}</p>}
  </section>;
}
