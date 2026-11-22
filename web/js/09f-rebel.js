/* ===== v24 Rebel actions (Update, Undo, ⋯ More, overtime game) · v25: every Update tap logged in Rebel's history, Rebel reacts ===== */
Object.assign(act,{
 rbupd:()=>{const g=CG();if(!g||!running(g))return;const t=Date.now();if(inOT(g)){rbH(g,'Update tapped · overtime – Rebel doesn’t schedule now','upd');save();render();return toast('Overtime – Rebel doesn’t schedule now. Add games by hand.')}
   const b0=rbSnap(g),r=rebelUpdate(g);RCk='';
   /* v25 (4): one history line per change, or "no changes" */
   if(r.n&&r.ch.length){RBPREV=[b0].concat(RBPREV).slice(0,3);r.ch.forEach(c=>rbH(g,'Update · '+c.m,'upd',t))}else rbH(g,'Update tapped · no changes','upd',t);
   if(g.rbAdd)delete g.rbAdd;save();render();rbReact(r.ch.length?'thanks':'same');
   if(r.ch.length)toastU('✓ Updated '+hm(t)+' · '+pl(r.ch.length||1,'change'));else toast('✓ All good — no changes needed.')},
 rbundo:()=>{rebelUndo();const t=$('#toast');t.style.display='none'},
 more:()=>{ui.more=!ui.more;render()},
 otgame:x=>{const g=CG(),i=+x;ui.otg={q:NUL4(),m:1,ot:1};ui.cf={i,t:'u',k:-1,ot:1};render()}});
/* v25 (7): any pick in ⋯ More closes the menu first (it stayed open over the Courts pop-up) */
document.addEventListener('click',e=>{if(!ui.more)return;if(e.target.closest('.mmenu button')){ui.more=0;return}if(!e.target.closest('.mwrap')){ui.more=0;render()}},true);
