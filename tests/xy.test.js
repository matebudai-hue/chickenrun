import test from "node:test";
import assert from "node:assert/strict";
import { memoryStore } from "../local.mjs";
import { points, multipliers, xyApi } from "../worker/xy.js";

test("paper payouts at every supported stake", () => {
  for (const m of multipliers) {
    assert.deepEqual([1,2,3,4].map(x=>points("X",x,m)),[30,20,10,-10].map(x=>x*m));
    assert.deepEqual([0,1,2,3].map(x=>points("Y",x,m)),[10,-10,-20,-30].map(x=>x*m));
  }
});

test("four teams, negotiations, concurrent moves, recovery, projection and reflections", async () => {
  const store=memoryStore();
  const originalSeen=store.seen;
  let agePresence=false;
  store.seen=code=>new Map([...originalSeen(code)].map(([key,time])=>[key,time-(agePresence?15000:0)]));
  const [host,projector,a,b,c,d,replacement,invite,outsider]=Array.from({length:9},(_,i)=>String(i+1).repeat(32));
  const code="ABC234";
  const teams=[a,b,c,d];
  const call=async(act,key,body,status=200)=>{
    const path=act==="create"?"/api/xy/rooms":"/api/xy/rooms/"+code+(act==="pulse"?"?pulse=1":act?"/"+act:"");
    const response=await xyApi(new Request("https://example.test"+path,{
      method:act&&act!=="pulse"?"POST":"GET",headers:key?{authorization:"Bearer "+key}:{},body:act&&act!=="pulse"?JSON.stringify(body||{}):undefined
    }),store);
    const data=await response.json();
    assert.equal(response.status,status,JSON.stringify(data));
    return data;
  };
  await call("create",null,{code,key:host,projector,rounds:2},201);
  await call("create",null,{code,key:host,projector,rounds:2});
  await call("start",host,{},409);
  await Promise.all(teams.map((key,i)=>call("join",key,{name:"Team "+(i+1)})));
  assert.deepEqual((await call("",host)).presence,Array(4).fill("online"));
  agePresence=true;
  assert.deepEqual((await call("",host)).presence,Array(4).fill("offline"));
  agePresence=false;
  await call("pulse",a);
  assert.equal((await call("",host)).presence[0],"online");
  assert.equal((await call("",a)).presence,undefined);
  await call("join",outsider,{name:"Fifth"},409);
  await call("config",host,{index:0,multiplier:1000,negotiations:2});
  await call("start",host,{});
  await call("open",host,{index:0},409);
  for(let i=0;i<2;i++){
    await call("negotiation",host,{index:0});
    assert.equal((await call("",a)).phase,"negotiation");
    await call("resume",host,{index:0});
  }
  await call("open",host,{index:0});
  await call("config",host,{index:0,multiplier:5,negotiations:2},409);
  await call("close",host,{index:0},409);
  await call("screen",host,{mode:"matrix"});
  assert.equal((await call("",projector)).mode,"matrix");
  await call("close",projector,{index:0},403);
  await Promise.all(teams.map((key,i)=>call("move",key,{index:0,choice:i===0?"X":"Y"})));
  assert.deepEqual((await call("",host)).rounds[0].moves,["X","Y","Y","Y"]);
  assert.equal((await call("",projector)).rounds[0].moves,undefined);
  assert.equal((await call("",b)).rounds[0].moves,undefined);
  const close=await call("close",host,{index:0});
  assert.deepEqual(close.totals,[30000,-10000,-10000,-10000]);
  await call("close",host,{index:0});
  await call("note",a,{index:0,text:"Első kör"});
  await call("transfer",host,{seat:0,transfer:invite});
  assert.equal((await call("join",replacement,{transfer:invite})).ownTotal,30000);
  await call("",a,undefined,403);
  await call("join",outsider,{transfer:invite},409);
  await call("next",host,{index:0});
  await call("open",host,{index:1});
  await call("move",replacement,{index:0,choice:"Y"},409);
  await call("manual",host,{index:1,seat:0,choice:"Y"});
  await Promise.all([b,c,d].map(key=>call("move",key,{index:1,choice:"Y"})));
  await call("close",host,{index:1});
  await call("finish",host,{index:1});
  assert.deepEqual((await call("",projector)).rounds[0].noteFlags,[true,false,false,false]);
  assert.equal((await call("",b)).rounds[0].noteFlags,undefined);
  assert.equal((await call("",projector)).projectedNote,undefined);
  await call("screen",host,{mode:"note",round:0,seat:0,anonymous:true});
  assert.deepEqual((await call("",projector)).projectedNote,{text:"Első kör",round:0,name:""});
  assert.equal((await call("",b)).projectedNote,undefined);
  await call("focus",host,{index:null});
  assert.equal((await call("",projector)).mode,"live");
  await call("reflection",replacement,{text:"Az első tárgyalás után változott."});
  assert.equal((await call("",host)).reflections[0],"Az első tárgyalás után változott.");
  assert.equal((await call("",b)).reflections,undefined);
  await call("screen",host,{mode:"reflection",seat:0,anonymous:true});
  const projected=await call("",projector);
  assert.deepEqual(projected.projectedReflection,{name:"",text:"Az első tárgyalás után változott."});
  assert.equal((await call("",b)).rounds[0].moves,undefined);
  await call("reveal",host,{enabled:true});
  assert.deepEqual((await call("",b)).rounds[0].moves,["X","Y","Y","Y"]);
});
