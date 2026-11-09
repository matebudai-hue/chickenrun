import { test } from "node:test";
import assert from "node:assert/strict";
import { api, DISTANCES } from "../worker/game.js";
import { memoryStore } from "../local.mjs";

const base = "https://example.test";
const secret = () => crypto.randomUUID().replaceAll("-", "");
async function create(n = 2) {
  const store = memoryStore();
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
  for (const who of players) assert.equal((await room("join",who,{})).status, 200);
  assert.equal((await room("start",players[0],{})).status, 403);
  assert.equal((await room("start",host.token,{})).status, 200);
  return { room, host, players };
}

test("decision stays private and both advance through all seven distances", async () => {
  const { room, host, players: [a,b] } = await create();
  assert.deepEqual(DISTANCES, [1000,800,600,400,200,50,10]);
  for (const [step, distance] of DISTANCES.entries()) {
    const before = (await room("state",b)).body;
    assert.equal(before.distance, distance);
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
  for(let step=0;step<5;step++) await Promise.all([a,b].map(p=>room("decision",p,{step,choice:"go"})));
  assert.equal((await room("state",a)).body.distance,50);
  await Promise.all([room("decision",a,{step:5,choice:"yield"}),room("decision",b,{step:5,choice:"go"})]);
  assert.equal((await room("state",a)).body.yielded,true);
  assert.equal((await room("state",b)).body.yielded,false);
  assert.equal((await room("state",a)).body.history.length,6);
});

test("messages are pair-only, duplicate messages do not repeat, odd player observes",async()=>{
  const {room,host,players}=await create(5);
  const statuses=await Promise.all(players.map(p=>room("state",p)));
  assert.equal(statuses.filter(x=>x.body.spectator).length,1);
  const sender=players[statuses.findIndex(x=>!x.body.spectator)];
  const message={step:0,id:secret(),text:"<b>Haladok!</b>"};
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

