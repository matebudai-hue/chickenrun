import { carPositions } from "./story.js?v=12";

export function animateRace(screen, race, clock, busy) {
  const board = screen.querySelector("[data-live-race]");
  if (!board || race.startsAt === null) return () => {};
  const cars = [...board.querySelectorAll(".road > g")];
  const distance = board.querySelector("[data-race-distance]");
  const countdown = board.querySelector("[data-race-time]");
  const flash = board.querySelector("[data-race-mark]");
  const button = board.querySelector('[data-do="turn"]');
  const progress = board.querySelector("progress");
  const cutoff = board.querySelector("[data-race-cutoff]");
  const marks = race.marks;
  const stop = race.target ? marks.find(([m]) => m === race.target)[1] : marks.at(-1)[1];
  const lastTurn = marks.at(-2)[1];
  let frame, shown = -Infinity;
  function draw() {
    shown = Math.max(shown, clock() - race.startsAt);
    const elapsed = Math.max(0, Math.min(shown, stop));
    const index = marks.findIndex(([,at]) => elapsed < at);
    const [from,start] = marks[index < 0 ? marks.length - 1 : index - 1];
    const [to,end] = index < 0 ? [from,start + 1] : marks[index];
    const meters = from + (to - from) * (elapsed - start) / (end - start);
    const value = Math.round(meters);
    if (distance.textContent !== String(value)) distance.textContent = value;
    carPositions(meters).forEach(([x,y],i) => cars[i]?.setAttribute("transform","translate("+x+" "+y+")"));
    const label = shown < 0 ? "Rajt "+Math.ceil(-shown / 1000)
      : shown >= stop ? "Eredmény ellenőrzése…" : Math.ceil((marks.at(-1)[1] - shown) / 1000)+" mp";
    if (countdown.textContent !== label) countdown.textContent = label;
    const highlighted = shown >= 0 && shown < stop && from > 0 && elapsed - start < 1000;
    flash.hidden = !highlighted;
    if (highlighted) flash.textContent = from+" m";
    progress.value = elapsed;
    if (button) button.disabled = busy() || shown < 0 || shown >= lastTurn;
    if (cutoff) cutoff.hidden = shown < lastTurn;
    if (shown < stop) frame = requestAnimationFrame(draw);
  }
  draw();
  return () => cancelAnimationFrame(frame);
}