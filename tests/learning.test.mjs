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
