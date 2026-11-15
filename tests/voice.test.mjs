import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { voiceMiddleware } from '../server/voice.mjs';
async function call(path, body, env={}, fetcher, origin='http://localhost:5173') {
 const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);req.url=path;req.method=body===undefined?'GET':'POST';req.headers={origin,host:'localhost:5173'};
 let output;const res={statusCode:200,setHeader(){},end(value){output=value;}};
 await voiceMiddleware(env,fetcher)(req,res,()=>{throw Error('unexpected next');});return {status:res.statusCode,output};
}
test('voice status reports missing credentials without exposing keys',async()=>{const r=await call('/api/voice/status');assert.deepEqual(JSON.parse(r.output),{configured:false});});
test('voice refuses untrusted origins',async()=>{const r=await call('/api/voice/speak',{text:'Hello'},{},undefined,'https://unrelated.example');assert.equal(r.status,403);});
test('ElevenLabs synthesis stays server side and returns audio',async()=>{const r=await call('/api/voice/speak',{text:'Five more minutes.'},{ELEVENLABS_API_KEY:'test-secret'},async(url,options)=>{assert.match(url,/text-to-speech/);assert.equal(options.headers['xi-api-key'],'test-secret');return new Response(new Uint8Array([1,2,3]));});assert.deepEqual([...r.output],[1,2,3]);});
test('ElevenLabs transcription forwards audio and returns text',async()=>{const r=await call('/api/voice/transcribe',{audio:'YWJj',type:'audio/webm'},{ELEVENLABS_API_KEY:'test-secret'},async(url,options)=>{assert.match(url,/speech-to-text/);assert.equal(options.body.get('model_id'),'scribe_v1');return Response.json({text:'I am getting up.'});});assert.equal(JSON.parse(r.output).text,'I am getting up.');});
test('voice provider errors never expose upstream secrets',async()=>{const r=await call('/api/voice/speak',{text:'Hi'},{ELEVENLABS_API_KEY:'test-secret'},async()=>new Response('test-secret',{status:401}));assert.equal(r.status,502);assert.doesNotMatch(r.output,/test-secret/);});
