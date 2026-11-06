import test from 'node:test';
import assert from 'node:assert/strict';
import { runSponsor } from '../app/lib/hacksprint-sponsors.ts';
const json = data => new Response(JSON.stringify(data));
test('missing keys never make an external request or claim success', async () => {
  for (const provider of ['nosana']) {
    const r = await runSponsor(provider, {}, () => {throw new Error('must not call');});
    assert.equal(r.status,'awaiting-key');
  }
});
test('Nosana chooses a live chat model and sends only bounded synthetic input', async () => {
  let calls=0;
  const r=await runSponsor('nosana',{nosanaKey:'secret'},async(url,options)=>{
    assert.equal(options.redirect,'error');
    calls++;
    if(url.endsWith('/models')) return json({data:[{id:'embedding',available:true,pricing:{completion:'0'}},{id:'chat',available:true,pricing:{completion:'0.000002'}}]});
    const body=JSON.parse(options.body);
    assert.equal(body.model,'chat'); assert.equal(body.max_tokens,2048);
    assert.match(body.messages[1].content,/합성 학습 예시/);
    assert.match(body.messages[1].content,/손해사정사 1차 객관식/);
    assert.match(body.messages[1].content,/비례·비비례 재보험/);
    assert.match(body.messages[1].content,/합성 예시의 선택 이유를 다시 확인하기/);
    assert.doesNotMatch(body.messages[1].content,/분수|분모/);
    assert.match(body.messages[1].content,/법령 해석/);
    return json({id:'request-one',choices:[{finish_reason:'stop',message:{content:'분모를 먼저 같게 만들어 보세요.'}}]});
  });
  assert.equal(calls,2); assert.equal(r.status,'verified'); assert.equal(r.requestId,'request-one');
  assert.doesNotMatch(JSON.stringify(r),/secret/);
});
test('Nosana does not mark empty or unavailable generation as verified', async () => {
  const r=await runSponsor('nosana',{nosanaKey:'secret'},async()=>json({data:[]}));
  assert.equal(r.status,'awaiting-setup');
  let call=0;
  const empty=await runSponsor('nosana',{nosanaKey:'secret'},async()=>++call===1?json({data:[{id:'chat',pricing:{completion:'1'}}]}):json({choices:[{message:{content:''}}]}));
  assert.equal(empty.status,'failed');
});
test('external provider errors do not expose tokens, URLs or account details',async()=>{
  const r=await runSponsor('nosana',{nosanaKey:'secret'},async()=>{throw new Error('Bearer secret private@example.test');});
  assert.equal(r.status,'failed'); assert.doesNotMatch(JSON.stringify(r),/Bearer|secret|private/);
});

test('truncated model output cannot become a verified completion',async()=>{
  let call=0;
  const r=await runSponsor('nosana',{nosanaKey:'secret'},async()=>++call===1?json({data:[{id:'chat',pricing:{completion:'1'}}]}):json({choices:[{finish_reason:'length',message:{content:'unfinished'}}]}));
  assert.equal(r.status,'failed'); assert.equal(r.output,undefined);
});
