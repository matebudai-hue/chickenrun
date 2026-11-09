import { test } from "node:test";
import assert from "node:assert/strict";
import { api, DISTANCES } from "../worker/game.js";
import { memoryStore } from "../local.mjs";

const base = "https://example.test";
const secret = () => crypto.randomUUID().replaceAll("-", "");
async function create(n = 2, store = memoryStore()) {
  const call = async (path, token, body) => {
    const res = await api(new Request(base+path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type":"application/json", ...(token ? {authorization:"Bearer "+token} : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), store);
    return { status: res.status, body: await res.json() };
  };
  const { body: host } = await call("/api/rooms", null, {});
  const room = (action, who, body) => call("/api/rooms/"+host.room+"/"+action, who, body);
  const players = Array.from({length:n},secret);
  const labels = players.map((_, index) => "Tesztelő " + (index + 1));
  for (const [index, who] of players.entries()) {
    assert.equal((await room("join",who,{label:labels[index]})).status, 200);
  }
  assert.equal((await room("start",players[0],{})).status, 403);
  assert.equal((await room("start",host.token,{})).status, 200);
  return { room, host, players, labels };
}

test("decision stays private and both advance through all eight distances", async () => {
  const { room, host, players: [a,b] } = await create();
  assert.deepEqual(DISTANCES, [1000,800,600,400,200,100,50,10]);
  for (const [step, distance] of DISTANCES.entries()) {
    const before = (await room("state",b)).body;
    assert.equal(before.distance, distance);
    assert.equal(before.totalSteps,8);
    const first = await room("decision",a,{step,choice:"go"});
    assert.equal(first.body.waiting,true);
    assert.deepEqual((await room("state",b)).body,before);
    const trainer = (await room("state",host.token)).body.pairs[0];
    assert.equal(trainer.ready,1);
    assert.equal(trainer.history.length,step);
    const second = await room("decision",b,{step,choice:"go"});
    assert.equal(second.body.history.at(-1).other,"go");
    assert.equal(second.body.distance,DISTANCES[step+1]??0);
    assert.equal((await room("decision",a,{step,choice:"yield"})).status,200);
  }
  assert.equal((await room("state",host.token)).body.results.crash,1);
});

test("concurrent decisions commit once and reveal both choices at 50 m", async () => {
  const {room, players:[a,b]}=await create();
  for(let step=0;step<6;step++) await Promise.all([a,b].map(p=>room("decision",p,{step,choice:"go"})));
  assert.equal((await room("state",a)).body.distance,50);
  await Promise.all([room("decision",a,{step:6,choice:"yield"}),room("decision",b,{step:6,choice:"go"})]);
  assert.equal((await room("state",a)).body.outcome,"own");
  assert.equal((await room("state",b)).body.outcome,"other");
  assert.equal((await room("state",a)).body.history.length,7);
});

test("messages are pair-only, duplicate messages do not repeat, odd player gets a bot",async t=>{
  t.mock.timers.enable({apis:["Date"],now:1_800_000_000_000});
  const {room,host,players}=await create(5);
  const statuses=await Promise.all(players.map(p=>room("state",p)));
  assert.equal(statuses.filter(x=>x.body.number > 0).length,5);
  const pairs = (await room("state",host.token)).body.pairs;
  const botPair = pairs.find(p => p.names.includes("Tesztjátékos"));
  assert.equal(pairs.filter(p => p.names.includes("Tesztjátékos")).length, 1);
  const botOpponent = players[statuses.findIndex(x => x.body.number === botPair.number)];
  const senderIndex = statuses.findIndex(x => x.body.number !== botPair.number);
  const sender = players[senderIndex];
  const submitted = await room("decision",botOpponent,{number:botPair.number,step:0,choice:"yield"});
  assert.equal(submitted.body.waiting,true);
  t.mock.timers.tick(15_000);
  const finished = await room("state",botOpponent);
  assert.equal(finished.body.report[0].bot,true);
  assert.deepEqual(finished.body.history.map(h => [h.own,h.other]),[["yield","go"]]);
  const message={number:statuses[senderIndex].body.number,step:0,id:secret(),text:"<b>Haladok!</b>"};
  await room("message",sender,message);
  await room("message",sender,message);
  const views=await Promise.all(players.map(p=>room("state",p)));
  assert.equal(views.filter(x=>x.body.messages?.length===1).length,2);
  assert.equal(views.filter(x=>x.body.messages?.[0]?.own).length,1);
  assert.equal(JSON.stringify((await room("state",host.token)).body).includes("Haladok"),false);
  assert.equal((await room("state",secret())).status,403);
  assert.equal((await room("join",secret(),{})).status,409);
  assert.equal((await room("stop",host.token,{})).body.results.stopped,2);
});


test("finished players requeue once and are paired with different willing humans", async () => {
  const {room,host,players,labels} = await create(4);
  const first = await Promise.all(players.map(player => room("state",player).then(r => r.body)));
  await Promise.all(players.map((p,i) => room("decision",p,{number:first[i].number,step:0,choice:"yield"})));
  const oldPartner = first.findIndex((s,i) => i !== 0 && s.number === first[0].number);
  const join = i => room("requeue",players[i],{number:first[i].number});
  assert.equal((await join(0)).body.queued,true);
  assert.equal((await join(oldPartner)).body.queued,true);
  assert.equal((await room("state",host.token)).body.pairs.length,2);

  await Promise.all(players.map((_,i) => join(i)));
  const second = await Promise.all(players.map(player => room("state",player).then(r => r.body)));
  assert.equal(new Set(second.map(s => s.number)).size,2);
  assert.notEqual(second[0].number,second[oldPartner].number);
  assert.ok(second.every(s => !s.queued && s.number > 2 && s.report.length === 1));
  assert.ok(second.every(s => labels.every(label => !JSON.stringify(s).includes(label))));
  assert.equal((await room("decision",players[0],{number:first[0].number,step:0,choice:"go"})).body.waiting,false);
  await Promise.all(players.map((p,i) => room("decision",p,{number:second[i].number,step:0,choice:"yield"})));

  const report = (await room("state",players[0])).body.report;
  assert.equal(report.length,2);
  assert.ok(report.every(r => r.outcome === "both" && r.history[0].own === "yield" && r.history[0].at > 0));
  const admin = (await room("state",host.token)).body;
  assert.equal(admin.pairs.length,4);
  assert.ok(admin.pairs.every(pair => Number.isFinite(pair.startedAt) && pair.startedAt > 0));
  assert.ok(admin.pairs.slice(2).every(pair => pair.startedAt >= admin.pairs[1].startedAt));
  assert.ok(second.every(player => !("startedAt" in player)));
  assert.ok(admin.pairs.every(p => p.names.length === 2 && p.history[0].choices.every(c => c === "yield")));
  await room("stop",host.token,{});
  assert.equal((await room("requeue",players[0],{number:second[0].number})).status,409);
  assert.equal((await room("state",players[0])).body.report.length,2);
});

test("a lone player can play the bot, cancel waiting, and keep the report", async t => {
  t.mock.timers.enable({apis:["Date"],now:1_800_000_000_000});
  const {room,players:[player]} = await create(1);
  await room("decision",player,{number:1,step:0,choice:"yield"});
  t.mock.timers.tick(15_000);
  const played = await room("state",player);
  assert.equal(played.body.outcome,"own");
  assert.equal((await room("requeue",player,{number:1})).body.queued,true);
  const cancelled = await room("cancel",player,{number:1});
  assert.equal(cancelled.body.queued,false);
  assert.equal(cancelled.body.report.length,1);
});
test("retrying a room creation after a lost reply opens the same room", async () => {
  const store = memoryStore();
  const key = secret();
  const createRoom = () => api(new Request(base+"/api/rooms",{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key}),
  }),store);
  const replies = await Promise.all([createRoom(),createRoom(),createRoom()]);
  assert.deepEqual(replies.map(r=>r.status).sort(),[200,200,201]);
  const rooms = await Promise.all(replies.map(r=>r.json()));
  assert.ok(rooms.every(room=>room.room === rooms[0].room && room.token === key));
});

test("trainer sees readiness and can recover an unfinished pair without revealing pending choices", async () => {
  const {room,host,players,labels} = await create(2);
  await room("decision",players[0],{number:1,step:0,choice:"go"});
  const before = (await room("state",host.token)).body;
  assert.ok(before.roster.every(p=>p.online));
  assert.equal(before.roster.find(p=>p.name===labels[0]).status,"ready");
  assert.equal(before.roster.find(p=>p.name===labels[1]).status,"pending");
  assert.equal(before.pairs[0].history.length,0);
  assert.equal((await room("stop-pair",players[0],{number:1})).status,403);
  assert.equal((await room("stop-pair",host.token,{number:1})).body.pairs[0].result,"stopped");
  assert.equal((await room("state",players[0])).body.report[0].history.length,0);
  await room("requeue",players[0],{number:1});
  const bot = await room("test-pair",host.token,{player:1,number:1});
  assert.equal(bot.body.pairs.length,2);
  assert.equal(bot.body.pairs[1].bot,true);
  assert.equal((await room("test-pair",host.token,{player:1,number:1})).body.pairs.length,2);
});

test("forty participants can join and submit concurrently without lost decisions", async () => {
  const {room,host,players} = await create(40);
  const states = await Promise.all(players.map(p=>room("state",p).then(r=>r.body)));
  const decisions = await Promise.all(players.map((p,i)=>room("decision",p,{number:states[i].number,step:0,choice:"yield"})));
  assert.ok(decisions.every(d=>d.status===200));
  const admin = (await room("state",host.token)).body;
  assert.equal(admin.results.both,20);
  assert.ok(admin.pairs.every(p=>p.history.length===1));
});
test("all chat survives the player chat window and rematches, with access restricted to the trainer", async () => {
  const {room,host,players} = await create(4);
  const states = await Promise.all(players.map(p => room("state",p).then(r => r.body)));
  const number = states[0].number;
  const partner = states.findIndex((s,index) => index !== 0 && s.number === number);
  const outsider = states.findIndex(s => s.number !== number);
  const [a,b] = [players[0],players[partner]];
  for (const [step,distance] of DISTANCES.slice(0,3).entries()) {
    for (let index=0;index<10;index++) {
      const data = p => ({number,step,id:secret(),text:distance+" / "+p+" / "+index});
      const writes = [data("A"),data("B")];
      const responses = await Promise.all([room("message",a,writes[0]),room("message",b,writes[1])]);
      assert.ok(responses.every(response => response.status === 200));
      assert.equal((await room("message",a,writes[0])).status,200);
    }
    for (const player of [a,b]) {
      await room("decision",player,{number,step,choice:step===2 ? "yield" : "go"});
    }
  }
  assert.equal((await room("state",a)).body.messages.length,48);
  const query = "transcript?pair="+number;
  assert.equal((await room(query,a)).status,403);
  assert.equal((await room(query,players[outsider])).status,403);
  const first = (await room(query,host.token)).body.pairs[0].messages;
  assert.equal(first.length,60);
  assert.deepEqual(new Set(first.map(m => m.distance)),new Set([1000,800,600]));
  assert.equal(new Set(first.map(m => m.text)).size,60);
  assert.ok(first.every(m => m.at > 0 && (m.seat === 0 || m.seat === 1)));
  assert.equal((await room("state",host.token)).body.pairs[number-1].messageCount,60);
  await Promise.all(players.filter(p=>p!==a && p!==b).map(p=>room("decision",p,{number:states[outsider].number,step:0,choice:"yield"})));
  for (const index of [0,partner,outsider,states.findIndex((s,i)=>i!==outsider&&s.number!==number)]) {
    await room("requeue",players[index],{number:states[index].number});
  }
  const newState = (await room("state",a)).body;
  assert.notEqual(newState.number,number);
  assert.deepEqual(newState.messages,[]);
  await room("stop",host.token,{});
  assert.deepEqual((await room(query,host.token)).body.pairs[0].messages,first);
  assert.equal((await room("transcript",host.token)).body.pairs.find(p=>p.number===number).messages.length,60);
});

test("the bot draws one of five equally likely plans", async t => {
  t.mock.timers.enable({apis:["Date"],now:1_800_000_000_000});
  let random = 0;
  t.mock.method(Math,"random",() => random);
  for (let draw=0;draw<5;draw++) {
    random = (draw+.5)/5;
    const {room,players:[player]} = await create(1);
    const lastStep = draw < 4 ? 4 + draw : 7;
    for (let step=0;step<=lastStep;step++) {
      await room("decision",player,{number:1,step,choice:"go"});
      t.mock.timers.tick(15_000);
      const {body} = await room("state",player);
      assert.equal(body.history.at(-1).other,step===lastStep && draw<4 ? "yield" : "go");
      assert.equal(body.result,step===lastStep ? draw<4 ? "b" : "crash" : null);
    }
  }
});

test("the bot deadline is durable, stays hidden, and is settled just once", async t => {
  const now = 1_800_000_000_000;
  t.mock.timers.enable({apis:["Date"],now});
  let random = .99999;
  t.mock.method(Math,"random",() => random);
  const {room,host,players:[player]} = await create(1);
  const body = {number:1,step:0,choice:"go"};
  assert.equal((await room("decision",player,body)).body.waiting,true);
  t.mock.timers.tick(5_000);
  assert.equal((await room("decision",player,body)).body.waiting,true);
  t.mock.timers.tick(9_999);
  assert.equal((await room("state",player)).body.history.length,0);
  assert.equal((await room("state",host.token)).body.pairs[0].ready,1);
  t.mock.timers.tick(1);
  const [{body:coach},{body:human}] = await Promise.all([room("state",host.token),room("state",player)]);
  assert.equal(human.distance,800);
  assert.equal(human.history.length,1);
  assert.deepEqual(coach.pairs[0].history[0].submitted,[now,now+15_000]);
  assert.equal(coach.pairs[0].history.length,1);

  random = 0;
  await room("decision",player,{...body,step:1});
  t.mock.timers.tick(9_999);
  assert.equal((await room("state",player)).body.history.length,1);
  t.mock.timers.tick(1);
  assert.equal((await room("state",player)).body.history.length,2);
});

test("a pair created before the 100 m decision keeps its original distances", async () => {
  const store = memoryStore();
  const {room,host,players} = await create(2,store);
  const row = store.get(host.room);
  const saved = JSON.parse(row.state);
  delete saved.pairs[0].distanceVersion;
  assert.ok(store.put(host.room,row.revision,JSON.stringify(saved)));
  const state = (await room("state",players[0])).body;
  assert.equal(state.totalSteps,7);
  for (let step=0;step<5;step++) {
    await Promise.all(players.map(player=>room("decision",player,{number:1,step,choice:"go"})));
  }
  assert.equal((await room("state",players[0])).body.distance,50);
  assert.deepEqual((await room("state",host.token)).body.pairs[0].distances,[1000,800,600,400,200,50,10]);
});