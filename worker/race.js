export const RACE_MARKS = [
  [1500, 0], [1000, 11_500], [800, 16_000], [600, 20_500], [400, 25_000],
  [200, 30_000], [100, 35_000], [50, 39_000], [10, 43_000], [0, 45_000],
];
const FINAL_MARK = RACE_MARKS.at(-1);
const START_COUNTDOWN = 3000;
const SETTLE_GRACE = 900;

export function raceDistance(elapsed) {
  const end = RACE_MARKS.findIndex(([, at]) => elapsed < at);
  if (end < 0) return 0;
  if (end === 0) return RACE_MARKS[0][0];
  const [from, start] = RACE_MARKS[end - 1], [to, finish] = RACE_MARKS[end];
  return Math.round(from + (to - from) * (elapsed - start) / (finish - start));
}

export function raceElapsed(race, now) {
  return race.startsAt === null ? 0 : now - race.startsAt;
}

function startRace(race, now, botDistance) {
  race.startsAt = now + START_COUNTDOWN;
  const botMark = RACE_MARKS.find(([distance]) => distance === botDistance);
  if (botMark) {
    race.turns[1] = {
      target: botDistance, offset: botMark[1], at: race.startsAt + botMark[1] - 1500,
      distance: raceDistance(botMark[1] - 1500),
    };
  }
}

export function newRace(now, botDistance, gate = false, hasBot = false) {
  const race = { startsAt:null, turns:[null,null] };
  if (gate) {
    race.ready = [false,hasBot];
    race.readyUntil = now + 15_000;
    race.botDistance = botDistance;
  } else {
    startRace(race,now,botDistance);
  }
  return race;
}

export function markReady(race, seat, now) {
  if (race.startsAt !== null || race.ready[seat] || now >= race.readyUntil) return false;
  race.ready[seat] = true;
  if (race.ready.every(Boolean)) {
    startRace(race,now,race.botDistance);
    delete race.botDistance;
  }
  return true;
}

export function raceEnd(race) {
  if (race.startsAt === null) return [RACE_MARKS[0][0],Infinity];
  const first = race.turns.filter(Boolean).sort((a,b) => a.offset-b.offset)[0];
  return first ? [first.target, race.startsAt + first.offset] : [FINAL_MARK[0], race.startsAt + FINAL_MARK[1]];
}

export function nextExit(race, at) {
  if (race.startsAt === null || at < race.startsAt || at >= raceEnd(race)[1]) return null;
  const elapsed = raceElapsed(race,at);
  const mark = RACE_MARKS.find(([distance, time]) => distance > 0 && time > elapsed);
  return mark ? { target:mark[0], offset:mark[1], at, distance:raceDistance(elapsed) } : null;
}

export function raceReady(race, now) {
  return now >= raceEnd(race)[1] + SETTLE_GRACE;
}

export function finishRace(race) {
  const [distance, at] = raceEnd(race);
  const choices = race.turns.map(turn => turn?.target === distance ? "yield" : "go");
  const [a,b] = choices;
  const result = a === "yield" ? b === "yield" ? "both" : "a" : b === "yield" ? "b" : "crash";
  return { result, history:{ distance, at, choices } };
}

export function stopRace(race, now) {
  race.stoppedAt = now;
}