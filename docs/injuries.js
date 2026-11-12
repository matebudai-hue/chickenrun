const impactPoints = [
  [21,23],[34,38],[27,9],[12,32],[18,49],[31,51],
  [37,25],[27,30],[24,42],[17,28],[28,16],[21,37],
];

function driverFigure(count, fresh) {
  const last = (count - 1) % impactPoints.length;
  const marks = impactPoints.slice(0,count).map(([x,y], index) => {
    const repeats = Math.ceil((count - index) / impactPoints.length);
    const highlighted = index === last && (fresh || count > impactPoints.length);
    return '<g transform="translate('+x+' '+y+')" class="injury-mark'+(highlighted ? ' fresh' : '')+'">'+
      (highlighted ? '<circle r="4.7"/>' : '')+
      '<path d="M-2.5 1.8 2.5-1.8m-1.3 4 1.4-1.1'+
      (repeats > 1 ? 'm-5.3 .2 1.6-4.2' : '')+(repeats > 2 ? 'm.8 4.1 3.3 .8' : '')+'"/></g>';
  }).join('');
  return '<svg class="injury-figure" viewBox="0 0 50 61" aria-hidden="true">'+
    '<path class="injury-suit" d="M20 4h10l4 5v7l-4 5 9 3 4 15-5 2-4-10-2 11 2 14h-7l-2-12-2 12h-7l2-14-2-11-4 10-5-2 4-15 9-3-4-5V9z"/>'+
    '<path class="injury-seams" d="M17 11h16l-3 5h-9zm2 10 6 3 6-3m-6 3v13m-7 1h14m-18-9 5-3m12 0 5 3"/>'+
    marks+'</svg>';
}

export function injuryCard(count, {fresh=false, fullSession=false} = {}) {
  const tone = count >= 5 ? ' worn' : count > 0 ? ' marked' : '';
  return '<div class="injury-card'+tone+'">'+driverFigure(count,fresh)+
    '<div class="injury-copy"><div class="injury-heading"><span>Sérülések</span><strong>'+count+'</strong></div>'+
    (fresh ? '<small class="injury-update">+1 sérülés ebben a futamban</small>' : '')+
    (fullSession ? '<small class="injury-scope">A szoba összes futama</small>' : '')+
    '</div></div>';
}
