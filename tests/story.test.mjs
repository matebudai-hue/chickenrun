import test from "node:test";
import assert from "node:assert/strict";
import { personalReport, player, projector, time } from "../docs/views.js";
import { carPositions, changeSelection, nextReveal, pairGroups, pairStory, screeningFrames } from "../docs/story.js";

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

test("screening starts before the outcome and only offers explicitly selected quotes", () => {
  const pair = {timed:true,result:"both",turns:[null,null],history:[{distance:50,at:800,choices:["yield","yield"]}]};
  const chat = [{distance:400,at:200,seat:0,text:"selected"},{distance:100,at:500,seat:1,text:"private"}];
  const frames = screeningFrames(pair,chat,[0]);
  assert.deepEqual(frames.map(frame=>frame.kind),["start","message","reveal"]);
  assert.equal(frames[0].distance,1500);
  assert.deepEqual(frames.filter(frame=>frame.text).map(frame=>frame.text),["selected"]);
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

test("continuous replay shows a message, the turn request and the actual exit in time order", () => {
  const pair = {timed:true,turns:[{at:110,distance:93,target:50},null],history:[
    {distance:50,at:140,choices:["yield","go"]},
  ]};
  const messages = [{at:105,distance:96,seat:1,text:"Ide figyelj"}];
  assert.deepEqual(pairStory(pair,messages).map(event=>event.kind),["message","turn","reveal"]);
  assert.deepEqual(pairStory(pair,messages,[]).map(event=>event.kind),["turn","reveal"]);
});
test("participant-facing views keep the rematch and test opponent neutral", () => {
  const report = [{number:1,outcome:"both",bot:true,history:[]}];
  const pairs = [{number:1,result:"both",bot:true,names:["Dóra","Tesztjátékos"]}];
  const room = "ABCDEFGH";
  const waiting = player({phase:"finished",spectator:true,queued:true,queueUntil:100}, {room});
  assert.match(waiting,/A következő futam előkészítése/);
  assert.match(waiting,/Mégsem/);
  assert.doesNotMatch(waiting,/partner|tesztjátékos|data-queue-until|játékosra vársz/i);
  assert.doesNotMatch(personalReport({report},new Set()),/tesztjátékos/i);
  const summary = projector({phase:"finished",pairs},room,[]);
  assert.match(summary,/1 befejezett játék/);
  assert.doesNotMatch(summary,/tesztjátékos|partnerre/i);
  assert.doesNotMatch(projector({phase:"finished",pairs},room,[],true),/tesztjátékos/i);
});

test("the player sees the four medal totals and the current medal after the reveal", () => {
  const results = ["other","own","other","crash","both","stopped"];
  const report = results.map((outcome,index) => ({number:index+1,outcome,history:[]}));
  const state = {phase:"finished",number:5,result:"both",outcome:"both",distance:50,history:[{distance:50}],messages:[],report};
  const context = {room:"ABCDEFGH",opened:new Set()};
  const html = player(state,context);
  assert.match(html,/<strong>Döntetlen<\/strong>/);
  assert.match(html,/<span>Győztes<\/span><strong>2<\/strong>/);
  for (const label of ["Vesztes","Kórház","Döntetlen"]) {
    assert.ok(html.includes("<span>"+label+"</span><strong>1</strong>"));
  }
  assert.doesNotMatch(player(state,{...context,reveal:{}}),/night-medals/);
});

test("medal filters show only matching races and the checkpoint where each race ended", () => {
  const report = [
    {number:1,outcome:"other",timed:true,history:[{distance:200,own:"go",other:"yield"}]},
    {number:2,outcome:"own",history:[{distance:800,own:"go",other:"go"},{distance:100,own:"yield",other:"go"}]},
    {number:3,outcome:"crash",history:[{distance:10,own:"go",other:"go"}]},
    {number:4,outcome:"both",history:[{distance:50,own:"yield",other:"yield"}]},
  ];
  const expected = {other:"A másik autó tért ki · 200 m",own:"Te tértél ki · 100 m",crash:"Ütköztetek",both:"Mindketten kitértek · 50 m"};
  for (const [index,match] of report.entries()) {
    const filtered = personalReport({report},new Set(),match.outcome);
    assert.ok(filtered.includes(expected[match.outcome]));
    assert.match(filtered,/Összes futam/);
    for (const [otherIndex,other] of report.entries()) {
      assert.equal(filtered.includes('id="report-'+other.number+'"'),index===otherIndex);
    }
  }
  assert.match(personalReport({report:report.slice(0,1)},new Set(),"both"),/Ehhez a medálhoz még nincs futamod/);
  const state = {phase:"finished",number:4,result:"both",outcome:"both",distance:50,history:report[3].history,messages:[],report};
  const html = player(state,{room:"ABCDEFGH",opened:new Set(["night-report"]),medalFilter:"other"});
  assert.match(html,/data-medal="other" aria-controls="night-report" aria-pressed="true"/);
  assert.match(html,/<details id="night-report" open>/);
  assert.match(html,/A másik autó tért ki · 200 m/);
  assert.doesNotMatch(html,/id="report-4"/);
});
