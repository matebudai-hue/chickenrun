const title = '„Én ma már nem tudok bent maradni”';

const paragraphs = [
  'Nóri és Gábor egy kis cégnél dolgoznak az ügyfélszolgálaton. Felváltva veszik fel a közös telefont. Ha egy ügy nyitva marad, szoktak írni róla két sort a rendszerbe: mit ígértek, kit kell még visszahívni. Amikor ezt mindketten megcsinálják, másnap elég ránézni a jegyzetre, és lehet folytatni, ahol a másik abbahagyta.',
  'Gábor múlt pénteken három ügyet hagyott ott egy sor nélkül. Nóri hétfőn visszahallgatta a hívásokat, hogy kiderítse, mi történt. Kedden aztán Gábor vette fel az egyik ügyfelét. Nóri mindent leírt, Gábor két perc alatt elintézte az ügyet. Nóri azóta csak a sürgős dolgokról ír jegyzetet. Tegnap egy ügyfélnek harmadszor kellett elmondania ugyanazt.',
  'Péntek van, 15:46. Egy étterem telefonál: a szombati rendezvényükre rossz címre indult a rendelés. A futárcég négyig tudja átirányítani a csomagot. Bármelyikük el tudja intézni, de aki felveszi az ügyet, annak meg kell várnia a visszaigazolást, és utána vissza kell hívnia az éttermet.',
];

const dialogue = [
  ['Nóri', 'Te vetted fel tegnap a címmódosítást. El tudod intézni?'],
  ['Gábor', 'El tudom, de kedden is én maradtam bent. Ma négykor indulnom kell.'],
  ['Nóri', 'Nekem is.'],
];

const questions = [
  ['Hol ismertétek fel a fogolydilemmát?', 'Miért érte meg Gábornak kihagyni a jegyzetet, amíg Nóri megírta a sajátjait? Mit tett Nóri, amikor ebből elege lett, és ki fizette meg az árát?'],
  ['Hol jött a Padlógáz?', 'Mit nyer az, aki kivárja, hogy a másik intézkedjen? Mikor válik a kivárás drágábbá annál, mint amibe az ügy elvállalása kerül?'],
  ['Hétfő reggel ketten vagytok bent.', 'Mi az a konkrét megállapodás, amitől a következő péntek másképp néz ki?'],
];

function caseStory() {
  return '<div class="debrief-case-story"><div>'+paragraphs.map(text=>'<p>'+text+'</p>').join('')+'</div>'+
    '<div class="debrief-case-moment"><blockquote>'+dialogue.map(([speaker,line])=>'<p><strong>'+speaker+'</strong> '+line+'</p>').join('')+'</blockquote>'+
    '<p>Közben az étterem megint hívja a közös számot.</p>'+
    '<p class="debrief-case-prompt"><strong>Te vagy Nóri vagy Gábor. Mit írsz most a másiknak?</strong> Egy mondatot írj, olyat, amit tényleg elküldenél.</p></div></div>';
}

function caseQuestions() {
  return '<ol class="debrief-case-questions">'+questions.map(([heading,question])=>
    '<li><p><strong>'+heading+'</strong> '+question+'</p></li>').join('')+'</ol>';
}

export function debriefCasePanel(target) {
  return '<section class="debrief-section report-panel debrief-case-panel" aria-labelledby="debrief-case-title">'+
    '<div class="report-section-head"><h2 id="debrief-case-title">Esettanulmány</h2>'+
    '<div class="row" role="group" aria-label="Esettanulmány kivetítése">'+
    [['debrief-story','Szöveg kivetítése'],['debrief-questions','Kérdések kivetítése']].map(([id,label])=>
      '<button class="button secondary" type="button" id="project-'+id+'" data-do="project-section" data-target="'+id+
      '" aria-pressed="'+(target===id)+'">'+label+'</button>').join('')+'</div></div>'+
    '<h3>'+title+'</h3>'+caseStory()+'<h3>Kivezető kérdések</h3>'+caseQuestions()+'</section>';
}

export function debriefCaseSlide(showQuestions) {
  return '<section class="presentation-screen debrief-case-slide" data-slide="'+(showQuestions?'debrief-questions':'debrief-story')+'">'+
    '<p class="eyebrow">Padlógáz / Esettanulmány</p><h1>'+(showQuestions?'Kivezető kérdések':title)+'</h1>'+
    (showQuestions?caseQuestions():caseStory())+'</section>';
}
