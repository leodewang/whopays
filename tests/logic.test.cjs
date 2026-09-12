// Independent state/timer regression checks. Browser/layout checks run separately.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function app(saved={}) {
 let now=0, sequence=0; const timers=new Map(), nodes=new Map();
 function node(id) { if(!nodes.has(id)) { const classes=new Set(); nodes.set(id,{style:{},value:id==='teethSlider'?'15':'',textContent:'',innerHTML:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},setAttribute(){},querySelector:()=>node(id+'-child')}); } return nodes.get(id); }
 const screens=['setup','lobby','croc','reaction','cards','elim','result'].map(x=>node('screen-'+x));
 const localStorage={getItem:k=>saved[k]??null,setItem:(k,v)=>saved[k]=v};
 const window={scrollTo(){},setTimeout(fn,delay){let id=++sequence;timers.set(id,{fn,time:now+delay});return id;},clearTimeout:id=>timers.delete(id)};
 const context=vm.createContext({window,document:{getElementById:node,querySelectorAll:()=>screens,addEventListener(){}},localStorage,performance:{now:()=>now},console});
 vm.runInContext(source,context);
 const run=s=>vm.runInContext(s,context);
 function advance(ms) { const target=now+ms; for(let count=0;count<1000;count++){ const next=[...timers].filter(([,v])=>v.time<=target).sort((a,b)=>a[1].time-b[1].time)[0];if(!next){now=target;return;}now=next[1].time;timers.delete(next[0]);next[1].fn();}throw Error('Timer loop'); }
 return {run,node,advance,active:id=>node('screen-'+id).classList.contains('active')};
}
test('player count stays within 2–8 and HTML names are escaped',()=>{const a=app();a.run('for(let i=0;i<20;i++)addPlayer();');assert.equal(a.run('players.length'),8);a.run('for(let i=0;i<20;i++)removePlayer(0);');assert.equal(a.run('players.length'),2);a.run('players[0].name=\'<img src=x onerror="alert(1)">\';renderSetup();goToLobby();');assert.match(a.node('playersStrip').innerHTML,/&lt;img/);assert.doesNotMatch(a.node('playersStrip').innerHTML,/<img/);});
test('croc snap reset and back cancel old elimination',()=>{for(const action of ['resetCroc()','goBack()']){const a=app();a.run('startCroc();croc.started=true;croc.badIdx=0;clickTooth(0);'+action);a.advance(5000);assert.equal(a.run('loserName'),'');assert.ok(a.active(action==='goBack()'?'lobby':'croc'));}});
test('rapid croc taps cannot consume next player turn',()=>{const a=app();a.run('startCroc();croc.started=true;croc.badIdx=14;clickTooth(0);clickTooth(1);');assert.equal(a.run('croc.pulled.size'),1);a.advance(220);a.run('clickTooth(1)');assert.equal(a.run('croc.pulled.size'),2);});
test('reaction back and restart cancels old countdown and restores prompt',()=>{const a=app();a.run('startReaction();onReactionTap()');a.advance(600);a.run('goBack();startReaction()');a.advance(5000);assert.equal(a.run('rxn.phase'),'idle');assert.equal(a.node('reactionBig').textContent,'Tap to Start');});
test('reaction false start beats any valid slow time and double taps record once',()=>{const a=app();a.run('players=[{name:"Early"},{name:"Slow"}];startReaction();onReactionTap();onReactionTap();onReactionTap();');assert.equal(a.run('rxn.scores.length'),1);a.advance(1800);a.run('rxn.phase="green";rxn.goTime=performance.now()-5000;onReactionTap()');a.advance(5000);assert.equal(a.run('loserName'),'Early');});
test('tied slowest players replay; duplicate names retain player identity',()=>{const a=app();a.run('players=[{name:"Same"},{name:"Same"},{name:"Fast"}];startReaction();rxn.scores=[{player:0,name:"Same",ms:500,label:"500ms"},{player:1,name:"Same",ms:500,label:"500ms"},{player:2,name:"Fast",ms:100,label:"100ms"}];endReaction()');a.advance(2200);assert.equal(a.run('JSON.stringify(rxn.contestants)'),'[0,1]');assert.equal(a.run('loserName'),'');assert.equal(a.run('rxn.phase'),'idle');});
test('cards rank and suit resolve correctly; repeated flip is idempotent',()=>{const a=app();a.run('players=[{name:"Ace"},{name:"Club"},{name:"Heart"}];startCards();cards.hands[0].card={r:"A",s:"♣"};cards.hands[1].card={r:"2",s:"♣"};cards.hands[2].card={r:"2",s:"♥"};flipCard(0);flipCard(0);');assert.equal(a.run('cards.flippedCount'),1);a.run('flipCard(1);flipCard(2)');a.advance(3000);assert.equal(a.run('loserName'),'Club');a.run('showFinalResult()');assert.equal(a.node('finalName').textContent,'Club');});
test('cards back cancels both resolution and delayed elimination',()=>{for(const delay of [0,1000]){const a=app();a.run('startCards();flipCard(0);flipCard(1);flipCard(2)');a.advance(delay);a.run('goBack()');a.advance(5000);assert.ok(a.active('lobby'));assert.equal(a.run('loserName'),'');}});
test('malformed remembered players safely defaults; valid names restore',()=>{assert.equal(app({'whopays-players':'[null]'}).run('players.length'),3);assert.equal(app({'whopays-players':'["Leo","Sam"]'}).run('pname(1)'),'Sam');});
test('croc starting seat is randomized across full player range',()=>{for(const [random,expected] of [[0,0],[0.999999,7]]){const a=app();a.run('players=Array.from({length:8},(_,i)=>({name:"Guest "+i}));Math.random=()=>'+random+';startCroc()');assert.equal(a.run('croc.currentPlayer'),expected);assert.equal(a.node('crocTurnName').textContent,'Guest '+expected);}});
