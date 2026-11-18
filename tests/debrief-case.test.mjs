import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePresentation } from '../docs/presentation.js';
import { trainer, projector } from '../docs/views.js';

const state = {phase:'closed', mode:'timed', pairs:[], roster:[], queue:[], count:0};
const context = {room:'ABCDEFGH', tab:'debrief-case', opened:new Set(), selection:[], filter:'human'};

test('the case opens beside the projector button only after closure', () => {
  const html = trainer(state,context);
  assert.match(html,/Kivetítő megnyitása<\/button><button [^>]*id="trainer-tab-debrief-case"/);
  assert.match(html,/Szöveg kivetítése/);
  assert.match(html,/Kérdések kivetítése/);
  for (const phase of ['lobby','playing']) {
    assert.doesNotMatch(trainer({...state,phase},{...context,tab:'overview'}),/trainer-tab-debrief-case/);
  }
});

test('the story and questions are distinct projector targets', () => {
  const project = target => projector(state,context.room,[],false,undefined,undefined,normalizePresentation({target}));
  const story = project('debrief-story');
  assert.match(story,/data-slide="debrief-story"/);
  assert.match(story,/Mit írsz most a másiknak\?/);
  assert.doesNotMatch(story,/Hol ismertétek fel a fogolydilemmát/);
  const questions = project('debrief-questions');
  assert.match(questions,/data-slide="debrief-questions"/);
  assert.match(questions,/Hol ismertétek fel a fogolydilemmát/);
  assert.match(questions,/Hol jött a Padlógáz/);
  assert.doesNotMatch(questions,/Péntek van, 15:46/);
});
