export const multipliers = [1, 2, 5, 10, 100, 1000];
export function points(choice, countX, multiplier) {
  return (choice === "X" ? [0,30,20,10,-10][countX] : [10,-10,-20,-30,0][countX]) * multiplier;
}
const fail = (status, message) => { throw { status, message }; };
const check = (value, message = "Ez a művelet most nem végezhető el.") => { if (!value) fail(409, message); };
const keyPattern = /^[a-f0-9]{32}$/;
const digest = async key => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))), n => n.toString(16).padStart(2,"0")).join("");
const clean = (s, max) => typeof s === "string" ? s.trim().slice(0,max) : "";
const choice = x => x === "X" || x === "Y";
const current = s => s.rounds[s.index];
const canContinue = s => s.phase === "finished" && (!current(s).scores || s.index + 1 < s.rounds.length);
const totals = s => Array.from({length:4}, (_,i) => s.rounds.reduce((sum,r) => sum + (r.scores?.[i] ?? 0),0));
const names = s => s.teams.map((t,i) => t?.name || `${i+1}. csapat`);
function resultReport(s) {
  return {code:s.code,names:names(s),totals:totals(s),createdAt:new Date().toISOString(),
    rounds:s.rounds.flatMap((r,i)=>r.scores || r.notes.some(Boolean) ? [{
      number:i+1,multiplier:r.multiplier,negotiations:r.played,moves:r.scores?r.moves:null,
      scores:r.scores ?? null,notes:r.notes
    }] : []),reflections:s.teams.map(t=>t?.reflection || "")};
}
const presenceWindow = 25_000;
async function presentView(s, auth, store, id, pulse = false) {
  const result = view(s,auth);
  if (result.seat >= 0 && pulse) await store.pulse(id,auth,4000).catch(() => {});
  if (result.host) {
    const seen = await store.seen(id);
    result.presence = s.teams.map(t => !t ? null : !t.key ? "manual" :
      (seen.get(t.key) ?? 0) > Date.now()-presenceWindow ? "online" : "offline");
  }
  return result;
}
function view(s, auth) {
  const host = s.host === auth;
  const projector = s.projector === auth;
  const seat = s.teams.findIndex(t => t?.key === auth);
  if (!host && !projector && seat < 0) fail(403,"Ehhez a szobához nincs hozzáférésed.");
  const total = totals(s);
  const rounds = s.rounds.map((r,i) => {
    const scored = !!r.scores;
    const published = scored || (i === s.index && s.phase === "open");
    return { multiplier:host || published ? r.multiplier : undefined, negotiations:scored || host || i === s.index ? r.negotiations : undefined,
      played:r.played, scored, countX:projector && s.phase !== "finished" ? undefined : r.countX,
      moves:host || (scored && s.phase === "finished" && projector) ? r.moves : undefined,
      scores:host || (scored && s.phase === "finished" && projector) ? r.scores : undefined,
      manual:host ? r.manual : undefined,
      noteFlags:host || (scored && projector && s.phase === "finished") ? r.notes.map(Boolean) : undefined,
      hostNotes:host ? r.notes : undefined,
      projectorNotes:scored && projector && s.phase === "finished" ? r.notes : undefined,
      own:seat >= 0 ? r.moves[seat] : undefined,
      ownScore:seat >= 0 ? r.scores?.[seat] : undefined,
      note:seat >= 0 ? r.notes[seat] : undefined };
  });
  const reflections = s.teams.map(t => t?.reflection || "");
  return { code:s.code, phase:s.phase, index:s.index, rounds, seat, host, projector,
    mode:s.mode, names:host || projector ? names(s) : undefined,
    occupied:s.teams.map(Boolean), name:s.teams[seat]?.name,
    totals:host || s.phase === "finished" && projector ? total : undefined,
    ownTotal:total[seat], ownReflection:reflections[seat],
    reflections:host ? reflections : undefined,
    projectorReflections:projector && s.phase === "finished" ? reflections : undefined,
    projectedReflection:projector && s.mode === "reflection" ? {text:reflections[s.screenSeat],name:s.anonymous ? "" : names(s)[s.screenSeat]} : undefined,
    projectedNote:projector && s.mode === "note" ? {
      text:s.rounds[s.screenRound]?.notes[s.screenSeat], round:s.screenRound,
      name:s.anonymous ? "" : names(s)[s.screenSeat]
    } : undefined,
    focus:s.focus, canContinue:host ? canContinue(s) : undefined,
    reportShared:(host || seat>=0) ? !!s.sharedReport : undefined };
}
function action(s, auth, act, b, transfer) {
  const r = current(s);
  if (act === "join") {
    if (s.teams.some(t => t?.key === auth)) return false;
    const index = transfer ? s.teams.findIndex(t => t?.transfer === transfer) : s.teams.indexOf(null);
    check(index >= 0 && (transfer || s.phase === "lobby"),"A váró megtelt vagy a belépő lejárt.");
    if (transfer) s.teams[index] = {...s.teams[index],key:auth,transfer:null};
    else {
      const name = clean(b.name,40);
      check(name,"Adj nevet a csapatnak.");
      s.teams[index] = {key:auth,name};
    }
    return;
  }
  if (["move","note","reflection"].includes(act)) {
    const seat = s.teams.findIndex(t => t?.key === auth);
    if (seat < 0) fail(403,"Csapatbelépő szükséges.");
    if (act === "reflection") {
      check(s.phase === "finished");
      s.teams[seat].reflection = clean(b.text,1600);
    } else if (act === "note") {
      const round = s.rounds[b.index];
      check(Number.isInteger(b.index) && (round?.scores ||
        (s.phase === "open" && b.index === s.index && choice(round?.moves[seat]))));
      round.notes[seat] = clean(b.text,800);
    } else {
      check(choice(b.choice) && Number.isInteger(b.index));
      if (s.rounds[b.index]?.moves[seat] === b.choice) return false;
      check(s.phase === "open" && b.index === s.index,"Ez a kör már nem módosítható.");
      r.moves[seat] = b.choice;
      r.manual[seat] = false;
    }
    return;
  }
  if (s.host !== auth) fail(403,"Tréneri hozzáférés szükséges.");
  if (act === "reportshare") {
    check(s.phase === "finished");
    s.sharedReport = b.enabled === true ? resultReport(s) : null;
  } else if (act === "config") {
    const target = s.rounds[b.index];
    check(target && b.index >= s.index && (b.index > s.index || ["lobby","ready","negotiation"].includes(s.phase)));
    check(multipliers.includes(b.multiplier) && Number.isSafeInteger(b.negotiations) && b.negotiations >= target.played);
    Object.assign(target,{multiplier:b.multiplier,negotiations:b.negotiations});
  } else if (act === "start") {
    check(s.phase === "lobby" && s.teams.every(Boolean),"Az indításhoz négy csapat kell.");
    s.phase = "ready";
  } else if (act === "seat") {
    check(s.phase === "lobby" && Number.isInteger(b.seat) && b.seat >= 0 && b.seat < 4 && !s.teams[b.seat]);
    s.teams[b.seat] = {name:clean(b.name,40) || `${b.seat+1}. csapat`,key:null};
  } else if (act === "remove") {
    check(s.phase === "lobby" && !!s.teams[b.seat]);
    s.teams[b.seat] = null;
  } else if (act === "transfer") {
    check(!!s.teams[b.seat] && transfer);
    s.teams[b.seat].transfer = transfer;
  } else if (act === "negotiation") {
    check(s.phase === "ready" && b.index === s.index);
    r.negotiations = Math.max(r.negotiations,r.played+1);
    r.played++;
    s.phase = "negotiation";
  } else if (act === "resume") {
    check(s.phase === "negotiation" && b.index === s.index);
    s.phase = "ready";
  } else if (act === "open") {
    check(s.phase === "ready" && b.index === s.index && r.played === r.negotiations,"Előbb zárd le a tervezett tárgyalásokat.");
    s.phase = "open";
  } else if (act === "manual") {
    check(s.phase === "open" && b.index === s.index && !!s.teams[b.seat] && choice(b.choice) && !r.moves[b.seat]);
    r.moves[b.seat] = b.choice;
    r.manual[b.seat] = true;
  } else if (act === "close") {
    if (s.rounds[b.index]?.scores) return false;
    check(s.phase === "open" && b.index === s.index && r.moves.every(choice),"Mind a négy döntésnek be kell érkeznie.");
    r.countX = r.moves.filter(x => x === "X").length;
    r.scores = r.moves.map(x => points(x,r.countX,r.multiplier));
    s.phase = "result";
  } else if (act === "next") {
    check(s.phase === "result" && b.index === s.index && s.index+1 < s.rounds.length);
    s.index++;
    s.phase = "ready";
  } else if (act === "finish") {
    if (s.phase === "finished" && b.index === s.index) return false;
    check(["ready","negotiation","open","result"].includes(s.phase) && b.index === s.index);
    s.interrupted = {phase:s.phase};
    if (!r.scores) {
      s.interrupted.moves = [...r.moves];
      s.interrupted.manual = [...r.manual];
      r.moves.fill(null);
      r.manual.fill(false);
    }
    s.phase = "finished";
    s.mode = "live";
  } else if (act === "continue") {
    check(canContinue(s) && b.index === s.index,"Innen már nem folytatható a játék.");
    s.phase = s.interrupted?.phase ?? (r.scores ? "result" : "ready");
    if (s.interrupted?.moves) {
      r.moves = s.interrupted.moves;
      r.manual = s.interrupted.manual;
    }
    delete s.interrupted;
    s.focus = null;
    s.mode = "live";
    s.sharedReport = null;
  } else if (act === "screen") {
    check(["live","matrix","blank","join","reflection","note"].includes(b.mode));
    if (b.mode === "reflection") check(s.phase === "finished" && !!s.teams[b.seat]?.reflection);
    if (b.mode === "note") check(s.phase === "finished" && !!s.rounds[b.round]?.scores && !!s.rounds[b.round]?.notes[b.seat]);
    Object.assign(s,{mode:b.mode,screenSeat:b.seat,screenRound:b.round,anonymous:b.anonymous !== false});
  } else if (act === "focus") {
    check(s.phase === "finished" && (b.index === null || !!s.rounds[b.index]?.scores));
    s.focus = b.index;
    s.mode = "live";
  } else fail(404,"Ismeretlen művelet.");
}
export async function xyApi(req, store) {
  const reply = (data,status=200) => Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
  try {
    const url = new URL(req.url);
    const path = url.pathname;
    if (req.method !== "GET" && req.method !== "POST") fail(405,"Érvénytelen kérés.");
    let b = {};
    if (req.method === "POST") {
      const raw = await req.text();
      if (raw.length > 12000) fail(413,"Túl hosszú kérés.");
      try { b = JSON.parse(raw); } catch { fail(400,"Érvénytelen kérés."); }
      if (!b || typeof b !== "object" || Array.isArray(b)) fail(400,"Érvénytelen kérés.");
    }
    if (path === "/api/xy/rooms" && req.method === "POST") {
      if (!keyPattern.test(b.key) || !keyPattern.test(b.projector) || b.key === b.projector ||
          !/^[A-Z2-9]{6}$/.test(b.code) || !Number.isInteger(b.rounds) || b.rounds < 1 || b.rounds > 60) fail(400,"Érvénytelen szobabeállítás.");
      const host = await digest(b.key), projector = await digest(b.projector);
      const s = {code:b.code,host,projector,index:0,phase:"lobby",mode:"live",teams:Array(4).fill(null),
        rounds:Array.from({length:b.rounds},() => ({multiplier:1,negotiations:0,played:0,moves:Array(4).fill(null),manual:Array(4).fill(false),notes:Array(4).fill("")}))};
      const id = "xy:"+s.code;
      if (!await store.create(id,Date.now()+24*3600e3,JSON.stringify(s))) {
        const old = await store.get(id);
        check(old && old.expires_at > Date.now() && JSON.parse(old.state).host === host,"Ez a szobakód már foglalt.");
        return reply(view(JSON.parse(old.state),host));
      }
      return reply(view(s,host),201);
    }
    const match = /^\/api\/xy\/rooms\/([A-Z2-9]{6})(?:\/([a-z]+))?$/.exec(path);
    if (!match || (req.method === "GET") !== (!match[2] || match[2]==="report")) fail(404,"Ismeretlen útvonal.");
    const [,code,act] = match;
    const key = req.headers.get("Authorization")?.replace(/^Bearer /,"");
    if (!keyPattern.test(key || "")) fail(403,"Érvénytelen belépő.");
    const auth = await digest(key);
    const transfer = keyPattern.test(b.transfer || "") ? await digest(b.transfer) : null;
    const id = "xy:"+code;
    for (let i=0;i<12;i++) {
      const row = await store.get(id);
      if (!row || row.expires_at <= Date.now()) fail(404,"A szoba nem található vagy lejárt.");
      const s = JSON.parse(row.state);
      if (act==="report") {
        check(s.phase==="finished","A PDF a játék lezárása után érhető el.");
        if(s.host===auth) return reply(resultReport(s));
        if(s.sharedReport && s.teams.some(t=>t?.key===auth)) return reply(s.sharedReport);
        fail(403,"A tréner még nem osztotta meg a PDF-et.");
      }
      if (!act || action(s,auth,act,b,transfer) === false)
        return reply(await presentView(s,auth,store,id,act === "join" || (!act && !url.searchParams.has("idle"))));
      if (await store.put(id,row.revision,JSON.stringify(s)))
        return reply(await presentView(s,auth,store,id,true));
    }
    return reply({error:"Több döntés érkezett egyszerre. Próbáld újra."},503);
  } catch (err) {
    return reply({error:err.status ? err.message : "A játékszerver nem érhető el."},err.status || 500);
  }
}
