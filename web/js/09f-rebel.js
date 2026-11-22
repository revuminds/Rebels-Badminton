/* ===== v24 Rebel actions (Update, Undo, ⋯ More, overtime game) ===== */
Object.assign(act,{
 rbupd:()=>{const g=CG();if(!g||!running(g))return;if(inOT(g))return toast('Overtime – Rebel doesn’t schedule now. Add games by hand.');const r=rebelUpdate(g);RCk='';save();render();
   if(r.n)toastU('✓ Updated '+hm(Date.now())+' · '+pl(r.ch.length||1,'change'));else toast('✓ All good — no changes needed.')},
 rbundo:()=>{rebelUndo();const t=$('#toast');t.style.display='none'},
 more:()=>{ui.more=!ui.more;render()},
 otgame:x=>{const g=CG(),i=+x;ui.otg={q:NUL4(),m:1,ot:1};ui.cf={i,t:'u',k:-1,ot:1};render()}});
document.addEventListener('click',e=>{if(ui.more&&!e.target.closest('.mwrap')){ui.more=0;render()}},true);
