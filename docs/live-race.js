import { revealDuration } from "./story.js?v=15";

const track = `<svg class="night-asphalt" viewBox="0 0 360 315" preserveAspectRatio="none" aria-hidden="true">
  <defs>
    <linearGradient id="night-surface" x2="100%" y2="0%">
      <stop stop-color="#171b1b"/><stop offset=".22" stop-color="#272b2a"/><stop offset=".5" stop-color="#303332"/><stop offset=".79" stop-color="#272b2a"/><stop offset="1" stop-color="#171b1b"/>
    </linearGradient>
    <linearGradient id="night-edge" x1="0" y1="100%" x2="0" y2="0%">
      <stop stop-color="#111413" stop-opacity=".96"/><stop offset=".19" stop-color="#111413" stop-opacity="0"/><stop offset=".8" stop-color="#111413" stop-opacity="0"/><stop offset="1" stop-color="#111413" stop-opacity=".93"/>
    </linearGradient>
    <filter id="night-gravel" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".76" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
    <linearGradient id="night-gloss">
      <stop stop-color="#020607" stop-opacity=".66"/><stop offset=".2" stop-color="#fff4da" stop-opacity=".23"/>
      <stop offset=".68" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#040708" stop-opacity=".62"/>
    </linearGradient>
    <pattern id="night-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(32)">
      <path d="M0 0v7" stroke="#d7a95b" stroke-width="2.4" opacity=".32"/>
    </pattern>
    <pattern id="night-dashes" width="360" height="38" patternUnits="userSpaceOnUse" data-road-pattern>
      <path d="M180 0v20" stroke="#e5d7af" stroke-opacity=".54" stroke-width="1.7"/>
      <path d="M81 12h4m190 0h4" stroke="#e4bb76" stroke-opacity=".7" stroke-width="2.2"/>
    </pattern>
    <linearGradient id="night-amber" x1="0" y1="100%" x2="0" y2="0%">
      <stop stop-color="#ffe0a3" stop-opacity=".87"/><stop offset=".42" stop-color="#ffd58a" stop-opacity=".32"/><stop offset="1" stop-color="#f6b451" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="night-ice" x1="0" y1="100%" x2="0" y2="0%">
      <stop stop-color="#e1fbff" stop-opacity=".88"/><stop offset=".42" stop-color="#b4e6fa" stop-opacity=".33"/><stop offset="1" stop-color="#8bd9ff" stop-opacity="0"/>
    </linearGradient>
    <g id="night-car">
      <rect x="-15" y="-24" width="30" height="58" rx="10" fill="#080b0a" opacity=".72" transform="translate(2 3)"/>
      <path d="M-10 24Q-14 21-14 13V-15Q-13-26-7-27H7Q13-26 14-15V13Q14 21 10 24Z" fill="currentColor" stroke="#131616" stroke-width="1.7"/>
      <path d="M-10 24Q-14 21-14 13V-15Q-13-26-7-27H7Q13-26 14-15V13Q14 21 10 24Z" fill="url(#night-gloss)"/>
      <path d="M-8-11L-11-4-9 10H9L11-4 8-11Z" fill="#142025"/>
      <path d="M-8-12 0-15l8 3M-9 9l9 3 9-3" fill="none" stroke="#d5e7e8" stroke-opacity=".42"/>
      <path d="M-10-4h20M-8 12h16" stroke="#a7bac1" stroke-opacity=".6"/>
      <path d="M-10-15L-7-22H7L10-15M-8 17h16" stroke="#f9f4da" stroke-opacity=".47" fill="none"/>
      <path d="M-11 17v3M11 17v3" stroke="#ff684d" stroke-width="3"/>
      <path d="M-12-19l4-1m20 1-4-1" stroke="#fffbe8" stroke-width="3.5" stroke-linecap="round"/>
    </g>
  </defs>
  <path fill="#191c19" d="M0 0h360v315H0z"/>
  <path fill="url(#night-hatch)" d="M66 0h18v315H66zM276 0h18v315h-18z"/>
  <path fill="url(#night-surface)" d="M84 0h192v315H84z"/>
  <rect width="360" height="315" filter="url(#night-gravel)" opacity=".13" style="mix-blend-mode:soft-light"/>
  <path d="M87 0v315M273 0v315" stroke="#d9d0b4" stroke-opacity=".62" stroke-width="1.6"/>
  <path d="M137 0v315M224 0v315" stroke="#0a0d0b" stroke-opacity=".22" stroke-width="7"/>
  <path d="M0 173h65m230 0h65" stroke="#b6a078" stroke-opacity=".53" stroke-dasharray="3 4"/>
  <path d="M63 164v18m234-18v18" stroke="#edc17a" stroke-width="1.8"/>
  <rect width="360" height="315" fill="url(#night-dashes)"/>
  <path fill="url(#night-edge)" d="M0 0h360v315H0z"/>
</svg>`;

function vehicle(other) {
  const beam = other ? "ice" : "amber";
  const direction = other ? "other" : "own";
  return `<div class="night-vehicle night-${direction}" data-vehicle="${direction}" aria-hidden="true">
    <svg viewBox="-42 -115 84 230">
      <path d="M-12-20-35-107Q0-119 35-107L12-20Z" fill="url(#night-${beam})"/>
      <path d="M-10-21-18-81Q0-87 18-81L10-21Z" fill="url(#night-${beam})" opacity=".54"/>
      <use href="#night-car" color="${other ? "#a2cdd7" : "#e4a44e"}"/>
    </svg>${other ? "" : "<span>TE</span>"}
  </div>`;
}

export function nightRoad(distance, time, marker, waiting) {
  return '<div class="night-road" data-night-road data-position="'+distance+'"'+
    (waiting ? ' data-lights="waiting"' : '')+'><div class="night-world">'+track+'</div>'+
    vehicle(true)+vehicle(false)+
    '<div class="night-hud"><div><span>Távolság</span><strong><b data-race-distance>'+distance+'</b><small> m</small></strong></div>'+
    '<div class="night-time"><span>'+ (time.endsWith("pont") ? "Döntési pont" : "Futam") +'</span><strong data-race-time>'+time+'</strong></div></div>'+
    '<span class="night-marker" data-race-mark'+(marker ? "" : " hidden")+'>'+marker+'</span>'+
    '<div class="night-cue" data-race-cue aria-hidden="true" hidden></div></div>';
}

export function roadSpread(distance) {
  return 32 * Math.pow(Math.min(1500, Math.max(0, distance)) / 1500, .68);
}

export function animateRace(screen, state, clock, busy, reveal) {
  const board = screen.querySelector("[data-night-road]");
  if (!board) return () => {};
  const own = board.querySelector('[data-vehicle="own"]');
  const other = board.querySelector('[data-vehicle="other"]');
  const distance = board.querySelector("[data-race-distance]");
  const countdown = board.querySelector("[data-race-time]");
  const marker = board.querySelector("[data-race-mark]");
  const cue = board.querySelector("[data-race-cue]");
  const pattern = board.querySelector("[data-road-pattern]");
  const button = screen.querySelector('[data-do="turn"]');
  const hint = screen.querySelector("[data-race-hint]");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const race = state.race;
  const stationary = race?.startsAt === null;
  let frame;
  let shift = -1;
  if (stationary) board.dataset.lights = "waiting";
  function showCue(text, kind = "") {
    if (cue.textContent !== text) cue.textContent = text;
    if (cue.dataset.kind !== kind) cue.dataset.kind = kind;
    cue.hidden = !text;
  }

  function pose(meters, ownExit = 0, otherExit = 0, visualMeters = meters) {
    board.dataset.position = meters;
    const value = Math.round(meters);
    if (distance.textContent !== String(value)) distance.textContent = value;
    board.toggleAttribute("data-critical", value <= 50);
    const zoom = reduced ? 1 : 1 + .52 * Math.pow(Math.max(0, (200-visualMeters)/200), .8);
    board.style.setProperty("--spread", roadSpread(visualMeters)+"%");
    board.style.setProperty("--zoom", zoom);
    if (own.style.getPropertyValue("--exit") !== String(ownExit)) own.style.setProperty("--exit", ownExit);
    if (other.style.getPropertyValue("--exit") !== String(otherExit)) other.style.setProperty("--exit", otherExit);
    const nextShift = Math.floor((1500-visualMeters)*.14) % 38;
    if (!reduced && nextShift !== shift) {
      shift = nextShift;
      pattern.setAttribute("patternTransform","translate(0 "+shift+")");
    }
  }
  function mark(label, flash = false) {
    if (marker.textContent !== label) marker.textContent = label;
    marker.hidden = !label;
    marker.toggleAttribute("data-flash", flash);
  }

  if (race && !state.result && race.startsAt !== null) {
    const marks = race.marks;
    const stop = race.target ? marks.find(([m]) => m === race.target)[1] : marks.at(-1)[1];
    const lastTurn = marks.at(-2)[1];
    let shown = -Infinity;
    function draw() {
      shown = Math.max(shown, clock() - race.startsAt);
      const elapsed = Math.max(0, Math.min(shown, stop));
      const index = marks.findIndex(([,at]) => elapsed < at);
      const [from,start] = marks[index < 0 ? marks.length - 1 : index - 1];
      const [to,end] = index < 0 ? [from,start + 1] : marks[index];
      pose(from + (to - from) * (elapsed - start) / (end - start), 0, 0, reduced ? from : undefined);
      const count = Math.min(3, Math.ceil(-shown / 1000));
      const lights = shown >= 0 || count <= 2 ? "both" : "own";
      if (board.dataset.lights !== lights) board.dataset.lights = lights;
      const label = shown < 0 ? "Rajt "+count
        : shown >= stop ? "Ellenőrzés…" : Math.ceil((marks.at(-1)[1] - shown) / 1000)+" mp";
      if (countdown.textContent !== label) countdown.textContent = label;
      const highlighted = shown >= 0 && shown < stop && from > 0 && from < 1500 && elapsed - start < 850;
      const closeCue = highlighted && from <= 50;
      showCue(shown < 0 ? String(count) : closeCue ? from+" m" : "", shown < 0 ? "start" : "gate");
      mark(!closeCue && highlighted ? from+" M" : !closeCue && shown >= 0 && shown < stop && to > 0 ? to+" M" : "", highlighted && !closeCue);
      if (button) {
        const closed = shown >= lastTurn;
        const text = closed ? "Kitérés lezárult" : "Kitérek";
        if (button.firstChild.textContent.trim() !== text) button.firstChild.textContent = text+" ";
        button.disabled = busy() || shown < 0 || closed;
      }
      if (hint) {
        const text = shown < 0 ? "A visszaszámlálás után indul az autó."
          : shown >= lastTurn ? "Az utolsó kitérési pont elmúlt."
          : "Kitérés a következő pontnál · "+to+" m";
        if (hint.textContent !== text) hint.textContent = text;
      }
      if (shown < stop) frame = requestAnimationFrame(draw);
    }
    draw();
  } else {
    const last = state.history.at(-1);
    const finished = state.result && state.result !== "stopped";
    const ownExit = finished && last?.own === "yield" ? 1 : 0;
    const otherExit = finished && last?.other === "yield" ? 1 : 0;
    const to = finished && state.result !== "crash" ? last.distance : state.distance;
    if (reveal && !reduced) {
      function draw(now) {
        const t = Math.min(1, Math.max(0, (now-reveal.started) / revealDuration));
        const eased = 1-Math.pow(1-t,3);
        const meters = reveal.distance + (to-reveal.distance)*eased;
        pose(meters, ownExit*eased, otherExit*eased);
        if (!state.result && to <= 50 && t > .5) {
          showCue(to+" m", "gate");
          mark("");
        }
        if (t < 1) frame = requestAnimationFrame(draw);
      }
      draw(performance.now());
    } else {
      pose(to, ownExit, otherExit);
      if (reveal && !state.result && to <= 50) {
        showCue(to+" m", "gate");
        mark("");
      }
    }
  }
  return () => cancelAnimationFrame(frame);
}
