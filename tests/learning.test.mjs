import test from 'node:test';
import assert from 'node:assert/strict';
import { analyse, learningProjection, learningPeople } from '../docs/learning.js';
import { trainer } from '../docs/views.js';
const roster=[{number:1,name:'Azonos <név>'},{number:2,name:'Azonos <név>'}];
const race=(number,result,extra={})=>({number,result,playerNumbers:[1,2],names:roster.map(p=>p.name),history:[{distance:100,choices:result==='a'?['yield','go']:result==='b'?['go','yield']:result==='both'?['yield','yield']:['go','go']}],bot:false,...extra});
test('each race counts once collectively, each seat receives its own medal, identical names stay distinct',()=>{
 const data=analyse(['a','b','both','crash'].map((r,i)=>race(i+1,r)),roster);
 assert.deepEqual(data.total,{single:2,both:1,crash:1});
 assert.equal(data.players.length,2);
 for(const p of data.players) assert.deepEqual(p.medals,{win:1,lose:1,both:1,crash:1});
 assert.equal(data.players[0].events[0].medal,'lose');
 assert.equal(data.players[1].events[0].medal,'win');
 assert.equal(data.players[0].events.at(-1).distance,0);
 assert.doesNotMatch(learningPeople(data),/Azonos <név>/);
 assert.match(learningPeople(data),/Azonos &lt;név&gt;/);
});
test('transitions are chronological and never bridge stopped, test, gap or changed-mode races',()=>{
 const pairs=[race(6,'both'),race(1,'a'),race(2,'crash'),race(3,'stopped'),race(4,'a'),race(5,'b',{bot:true,playerNumbers:[1,null]}),race(7,'a',{timed:true}),race(8,'b',{timed:true,connectionGap:[false,true]}),race(9,'both',{timed:true})];
 const data=analyse(pairs,roster);
 assert.equal(data.transitions.lose.crash,1);
 assert.equal(data.transitions.win.crash,1);
 // Player 2 did not play test race 5: 4 -> 6 is a real adjacent personal pair.
 assert.equal(data.transitions.win.both,1);
 assert.equal(Object.values(data.transitions).flatMap(Object.values).reduce((a,b)=>a+b),3);
 assert.equal(data.stopped,1);assert.equal(data.test,1);assert.equal(data.gaps,1);
});
test('bot seat never becomes a participant, unknown identities do not get merged by name',()=>{
 const data=analyse([race(1,'a',{bot:true,playerNumbers:[1,null]}),race(2,'b',{playerNumbers:undefined})],roster,'all');
 assert.equal(data.players.length,2);assert.equal(data.unlinked,1);
 assert.equal(data.players[0].medals.lose,1);assert.equal(data.players[1].events.length,0);
});
test('projection never leaks names or test opponent labels and honours the human-only denominator',()=>{
 const pairs=[race(1,'b'),race(2,'a',{bot:true,playerNumbers:[1,null],names:['Azonos <név>','Tesztjátékos']})];
 for(const target of ['group','1']) {
  const html=learningProjection({pairs,roster},target);
  assert.doesNotMatch(html,/Azonos|Tesztjátékos|data-player|data-do/);
 }
 assert.match(learningProjection({pairs,roster},'1'),/1 döntési helyzet/);
 assert.equal(analyse([],roster).races.length,0);
});
test('dashboard renders populated and empty states with existing case projection controls',()=>{
 const context={room:'ABCDEFGH',tab:'report',opened:new Set(),roomLink:()=>'/test',selection:[],filter:'human'};
 const s={phase:'finished',pairs:[race(1,'a')],roster,count:2,queue:[]};
 const html=trainer(s,context);
 assert.match(html,/debrief-dashboard/);assert.match(html,/data-do="project-learning"/);
 assert.match(html,/data-do="project-pair"/);assert.match(html,/Játékelméleti háttér/);
 assert.match(html,/id="outcome-player"/);
 assert.match(trainer(s,{...context,outcomePlayer:1}),/0 Győztes, 1 Vesztes, 0 Kórház, 0 Döntetlen/);
 for (const tab of ['overview','players']) {
  const view = trainer(s,{...context,tab});
  assert.doesNotMatch(view,/compact-outcomes/);
  assert.match(view,/<header class="trainer-sticky">.*id="filter-human".*<\/header>/);
 }
 assert.doesNotThrow(()=>trainer({...s,pairs:[]},context));
});

test('presentation preserves name preference, scopes, and chronological transitions',async()=>{
 const {normalizePresentation,changePresentation}=await import('../docs/presentation.js');
 const {presentationView,transitionSummary}=await import('../docs/learning.js');
 let p=normalizePresentation({target:'person',person:1,names:true,scope:'all'});
 p=changePresentation(p,{target:'people'});
 assert.equal(p.names,true);assert.equal(p.scope,'all');
 const state={pairs:[race(1,'a'),race(2,'crash'),race(3,'both')],roster};
 assert.match(presentationView(state,p),/Azonos &lt;név&gt;/);
 assert.doesNotMatch(presentationView(state,{...p,names:false}),/Azonos/);
 assert.match(presentationView(state,{...p,names:false}),/Játékos 01/);
 assert.match(transitionSummary(analyse(state.pairs,roster)),/4 megfigyelt eredményátmenet/);
 assert.match(transitionSummary(analyse([],roster)),/Még nincs összevethető/);
});
test('20 players paginate into four readable groups, without losing the final players',async()=>{
 const {presentationView,presentationPages}=await import('../docs/learning.js');
 const people=Array.from({length:20},(_,i)=>({number:i+1,name:'Person '+(i+1)}));
 const pairs=Array.from({length:10},(_,i)=>race(i+1,'a',{playerNumbers:[i*2+1,i*2+2],names:people.slice(i*2,i*2+2).map(p=>p.name)}));
 const state={pairs,roster:people};const p={target:'people',names:true,scope:'human',page:0};
 assert.equal(presentationPages(state,p),4);
 assert.equal((presentationView(state,p).match(/<article>/g)||[]).length,6);
 const last=presentationView(state,{...p,page:3});assert.match(last,/Person 20/);assert.doesNotMatch(last,/Person 18/);
 assert.equal(presentationPages(state,{...p,target:'guide'}),6);
});

test('projected timelines hold 18 runs and put the 19th on the following slide',async()=>{
 const {presentationView,presentationPages}=await import('../docs/learning.js');
 const state={pairs:Array.from({length:19},(_,i)=>race(i+1,'a')),roster};
 const p={target:'people',names:false,scope:'human',page:0};
 assert.equal(presentationPages(state,p),2);
 assert.match(presentationView(state,p),/1–18\. saját futam/);
 assert.doesNotMatch(presentationView(state,p),/#19 ·/);
 assert.match(presentationView(state,{...p,page:1}),/19\. saját futam · #19/);
});

test('individual transition projection counts only the chosen player and respects name visibility',async()=>{
 const {presentationView}=await import('../docs/learning.js');
 const state={pairs:[race(1,'a'),race(2,'crash'),race(3,'both')],roster};
 const p={target:'transitions',person:1,names:false,scope:'human',page:0};
 const individual=presentationView(state,p);
 assert.match(individual,/2 megfigyelt eredményátmenet/);
 assert.match(individual,/Játékos 01/);
 assert.doesNotMatch(individual,/Azonos/);
 assert.match(presentationView(state,{...p,names:true}),/Azonos &lt;név&gt;/);
 assert.match(presentationView(state,{...p,person:0}),/4 megfigyelt eredményátmenet/);
});

test('the selected report and its projection show the same cumulative injuries as the player',async()=>{
 const {presentationView}=await import('../docs/learning.js');
 const {player}=await import('../docs/views.js');
 const pairs=[
   ...Array.from({length:15},(_,i)=>race(i+1,'crash',{bot:i===3,playerNumbers:i===3?[1,null]:[1,2]})),
   race(16,'stopped'),
 ];
 const report=pairs.map((pair)=>({number:pair.number,outcome:pair.result,history:[]}));
 const context={room:'ABCDEFGH',tab:'report',opened:new Set(),roomLink:()=>'/test',selection:[],filter:'human',outcomePlayer:1};
 const state={phase:'finished',pairs,roster,count:2,queue:[]};
 const cockpit=player({phase:'running',number:15,result:'crash',outcome:'crash',history:[{distance:0}],messages:[],report},context);
 assert.match(cockpit,/Sérülések<\/span><strong>15<\/strong>/);
 assert.match(cockpit,/\+1 sérülés ebben a futamban/);
 assert.match(cockpit,/data-do="requeue"/);
 const running=player({phase:'running',number:16,step:0,distance:1000,messages:[],report},context);
 assert.match(running,/Sérülések<\/span><strong>15<\/strong>.*data-do="yield"/);
 assert.doesNotMatch(running,/\+1 sérülés ebben a futamban/);
 const summary=trainer(state,context);
 assert.match(summary,/Sérülések<\/span><strong>15<\/strong>.*A szoba összes futama/);
 assert.match(summary,/0 Győztes, 0 Vesztes, 14 Kórház, 0 Döntetlen/);
 const projected=presentationView(state,{target:'person',person:1,scope:'human',names:false,page:0});
 assert.match(projected,/Játékos 01/);
 assert.doesNotMatch(projected,/Azonos/);
 assert.match(projected,/Sérülések<\/span><strong>15<\/strong>.*A szoba összes futama/);
 assert.doesNotMatch(presentationView(state,{target:'group',scope:'human',names:false,page:0}),/injury-card/);
});
