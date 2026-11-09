export const legacyPoints = [1000, 800, 600, 400, 200, 50, 10];
export const revealDuration = 560;

export function carPositions(distance, firstYields = false, secondYields = false) {
  const spread = 37 + 243 * Math.pow(Math.min(distance,1000) / 1000, .62) + 46 * Math.max(0,distance - 1000) / 500;
  return [
    [380 - spread, firstYields ? 31 : 105],
    [380 + spread, secondYields ? 180 : 105],
  ];
}

export function nextReveal(previous, current) {
  if (!previous || current.number !== previous.number || !current.history) return null;
  if (current.history.length !== (previous.history?.length ?? 0) + 1) return null;
  return { distance: previous.distance, started: performance.now() };
}

export function pairGroups(pairs) {
  const human = [], test = [], stopped = [];
  for (const pair of pairs) {
    if (pair.result === "stopped") stopped.push(pair);
    else if (pair.result) (pair.bot ? test : human).push(pair);
  }
  return { human, test, stopped };
}

export function pairStory(pair, messages, visibleQuotes = null) {
  const events = [];
  const projected = visibleQuotes !== null;
  for (const row of pair.history) {
    if (!projected) {
      for (const [seat, at] of (row.submitted ?? []).entries()) {
        if (Number.isFinite(at)) events.push({ kind:"choice", distance:row.distance, at, seat, choice:row.choices[seat] });
      }
    }
    events.push({ kind:"reveal", distance:row.distance, at:row.at, choices:row.choices });
  }
  messages.forEach((message,index) => {
    if (!projected || visibleQuotes.includes(index)) events.push({ ...message, kind:"message", index });
  });
  if (pair.timed) {
    (pair.turns ?? []).forEach((turn,seat) => {
      if (turn) events.push({ ...turn, seat, kind:"turn" });
    });
    return events.sort((a,b) => (a.at ?? 0) - (b.at ?? 0));
  }
  return events.sort((a,b) =>
    (b.distance ?? Infinity) - (a.distance ?? Infinity) ||
    (a.at ?? 0) - (b.at ?? 0) ||
    Number(a.kind === "reveal") - Number(b.kind === "reveal"));
}

export function screeningFrames(pair, messages, quotes) {
  const opening = pair.timed ? 1500 : (pair.distances ?? legacyPoints)[0];
  const events = pairStory(pair,messages,quotes);
  const frames = [{ kind:"start", distance:opening }];
  frames.push(...events);
  if (pair.result === "stopped") frames.push({kind:"stopped", distance:pair.distance});
  return frames;
}

export function changeSelection(selection, number, quote) {
  const current = selection.find(entry => entry.number === number);
  if (quote === undefined) {
    if (current) return selection.filter(entry => entry.number !== number);
    if (selection.length >= 2) return selection;
    return [...selection,{ number, quotes:[] }];
  }
  if (!current) return selection;
  return selection.map(entry => entry === current ? {
    number, quotes: entry.quotes.includes(quote) ? entry.quotes.filter(i => i !== quote) : [...entry.quotes,quote],
  } : entry);
}