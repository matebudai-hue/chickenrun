import test from "node:test";
import assert from "node:assert/strict";
import { projector, time } from "../docs/views.js";
import { carPositions, changeSelection, nextReveal, pairGroups, pairStory } from "../docs/story.js";

test("both cars move inward at each distance, meet at impact and leave the lane when yielding", () => {
  const distances = [1000,800,600,400,200,100,50,10,0];
  const gaps = distances.map(distance => {
    const [a,b] = carPositions(distance);
    return b[0]-a[0];
  });
  assert.ok(gaps.every((gap,i) => !i || gap < gaps[i-1]));
  assert.ok(gaps.at(-1) <= 75);
  const [a,b] = carPositions(800,true,true);
  assert.ok(a[1] < 43 && b[1] > 167);
  assert.equal(nextReveal({number:1,distance:1000,history:[]},{number:1,history:[{}]}).distance,1000);
  assert.equal(nextReveal({number:1,history:[]},{number:2,history:[{}]}),null);
  assert.equal(nextReveal({number:1,history:[{}]},{number:1,history:[{}]}),null);
});

test("story places chat between the actual submissions and shows only chosen quotes on the projector", () => {
  const pair = {history:[
    {distance:1000,at:300,submitted:[100,300],choices:["go","go"]},
    {distance:800,at:500,submitted:[400,500],choices:["yield","go"]},
  ]};
  const messages = [{distance:1000,at:200,seat:1,text:"selected"},{distance:800,at:320,seat:0,text:"private"}];
  const story = pairStory(pair,messages);
  assert.deepEqual(story.map(event=>event.kind),["choice","message","choice","reveal","message","choice","choice","reveal"]);
  assert.deepEqual(story.map(event=>event.at),[100,200,300,300,320,400,500,500]);
  const publicStory = pairStory(pair,messages,[0]);
  assert.deepEqual(publicStory.map(event=>event.kind),["message","reveal","reveal"]);
  assert.deepEqual(publicStory.filter(event=>event.text).map(event=>event.text),["selected"]);
  assert.ok(pairStory(pair,messages,[]).every(event=>event.kind==="reveal"));
});

test("trainer selects at most two cases and dropping a case drops its quotes", () => {
  const first = changeSelection([],1);
  const quoted = changeSelection(first,1,0);
  const two = changeSelection(quoted,2);
  assert.deepEqual(two,[{number:1,quotes:[0]},{number:2,quotes:[]}]);
  assert.strictEqual(changeSelection(two,3),two);
  const dropped = changeSelection(two,1);
  assert.deepEqual(changeSelection(dropped,1),[{number:2,quotes:[]},{number:1,quotes:[]}]);
});

test("only finished human pairs contribute to human result counts", () => {
  const human = {result:"crash",bot:false};
  const bot = {result:"a",bot:true};
  const stopped = {result:"stopped",bot:false};
  assert.deepEqual(pairGroups([human,bot,stopped,{result:null}]),{human:[human],test:[bot],stopped:[stopped]});
});

test("the names and pairing times appear only in the explicitly selected projection view", () => {
  const state = {phase:"finished",queue:[],pairs:[
    {number:1,result:"both",names:["Dóra <vezető>","Márk"],startedAt:Date.UTC(2026,10,9,9,15)},
    {number:2,result:"both",names:["Márk","Júlia"]},
  ]};
  const selected = [{number:1,quotes:[]}];
  const hidden = projector(state,"ABCDEFGH",selected);
  assert.match(hidden,/Eset 1/);
  assert.doesNotMatch(hidden,/Dóra|Márk|Júlia/);
  const named = projector(state,"ABCDEFGH",selected,true);
  assert.match(named,/1\. játék/);
  assert.match(named,/2\. játék/);
  assert.ok(named.includes(time(state.pairs[0].startedAt)));
  assert.match(named,/Dóra &lt;vezető&gt;/);
  assert.match(named,/Márk/);
  assert.match(named,/Júlia/);
  assert.match(named,/<td>–<\/td>/);
  assert.doesNotMatch(named,/Eset 1/);
});