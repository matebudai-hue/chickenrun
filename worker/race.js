export const RACE_MARKS = [
  [1500, 0], [1000, 11_500], [800, 16_000], [600, 20_500], [400, 25_000],
  [200, 30_000], [100, 35_000], [50, 39_000], [10, 43_000], [0, 45_000],
];
const FINAL_MARK = RACE_MARKS.at(-1);
const START_COUNTDOWN = 3000;
const SETTLE_GRACE = 450;

export function raceDistance(elapsed) {
  const end = RACE_MARKS.findIndex(([, at]) => elapsed < at);
  if (end < 0) return 0;
  if (end === 0) return RACE_MARKS[0][0];
  const [from, start] = RACE_MARKS[end - 1], [to, finish] = RACE_MARKS[end];
  return Math.round(from + (to - from) * (elapsed - start) / (finish - start));
}

export function newRace(now, botDistance) {
  const startsAt = now + START_COUNTDOWN;
  const botMark = RACE_MARKS.find(([distance]) => distance === botDistance);
  const bot = botMark ? {
    target: botDistance, offset: botMark[1], at: startsAt + botMark[1] - 1500,
    distance: raceDistance(botMark[1] - 1500),
  } : null;
  return { startsAt, turns:[null, bot] };
}

export function raceEnd(race) {
  const first = race.turns.filter(Boolean).sort((a,b) => a.offset-b.offset)[0];
  return first ? [first.target, race.startsAt + first.offset] : [FINAL_MARK[0], race.startsAt + FINAL_MARK[1]];
}

export function nextExit(race, at) {
  const elapsed = at - race.startsAt;
  if (elapsed < 0 || at >= raceEnd(race)[1]) return null;
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