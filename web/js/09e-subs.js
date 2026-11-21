/* ===== v18: scores sent by players from the live page – reviewed on the tablet (admin + game manager) =====
   Players send a score for a FINISHED game without a score; nothing changes until it is accepted here.
   Accept → saved as a normal result + audit log. Reject → the live page can send again. The tablet's own score always wins. */
const hKey=h=>(h.at||0)+'-'+(h.c||1);                      /* same key as the Worker (hKey) */
const subsOK=()=>(ADMIN()||GM())&&!!SY.token;
let subsBusy=false;
async function subsPoll(force){if(!subsOK()||subsBusy||navigator.onLine===false)return;if(!force&&!(ui.scr==='app'&&ui.tab==='games'))return;
  subsBusy=true;try{lclPoll();const r=await req('GET','/api/subs?d='+TODAY(),null,15000);if(r.s!==200)return;const L=r.j.list||[],old=(ui.subs||[]).map(x=>x.id).join();
    ui.subs=L;if(L.map(x=>x.id).join()!==old){if(ui.subm&&!L.length)ui.subm=0;const a=document.activeElement;if(!(ui.subm&&a&&a.dataset&&/^sub_/.test(a.dataset.i||'')))render()}}finally{subsBusy=false}}
setInterval(()=>subsPoll(false),20000);
function subsBtn(d){const n=(ui.subs||[]).length,g=S.games[d],np=g&&g.st&&!g.en?(g.hist||[]).filter(h=>!h.sa&&!h.sb).length:0;
  return (np?'<span class="spend big" title="Games saved with no score – players send it from the live page, or tap the game in Game Summary">⏳ Score pending ('+np+')</span>':'')+(n&&d===TODAY()&&subsOK()?'<button class="ol rvb" data-a="subsopen">Scores to review ('+n+')</button>':'')+lclBtn(d)}
function subGame(x){const g=S.games[TODAY()];return g&&(g.hist||[]).find(h=>hKey(h)===x.k)||null}
function subVal(x){const e=(ui.subE||{})[x.id]||{};return{sa:e.sa!=null?e.sa:x.sa,sb:e.sb!=null?e.sb:x.sb}}
/* v21: x.st==='cp' = a correction of a score already saved on the tablet (old → new) */
const subCor=x=>x&&x.st==='cp';
function subErr(x){const h=subGame(x),g=S.games[TODAY()];if(!h)return 'Game not found on this tablet (edited or deleted)';if(!subCor(x)&&(h.sa||h.sb))return 'Already scored on the tablet: '+h.sa+' – '+h.sb;
  const v=subVal(x);if(subCor(x)&&Math.round(num(v.sa))===h.sa&&Math.round(num(v.sb))===h.sb)return 'Same as the saved score';const sa=Math.round(num(v.sa)),sb=Math.round(num(v.sb));if(String(v.sa)===''||String(v.sb)==='')return 'Enter both scores';const e=scoreErr(sa,sb,gp(g,h));if(e)return e;if(!gameWon(sa,sb,gp(g,h)))return 'Not a finished game – one side must reach '+gp(g,h).pts;return ''}
function vSubs(){const L=ui.subs||[],g=S.games[TODAY()];
  const row=x=>{const h=subGame(x),v=subVal(x),er=subErr(x),co=subCor(x),own=!co&&h&&(h.sa||h.sb);
    return '<div class="subr"><div style="flex:1;min-width:0"><div style="font-weight:700">'+(h?esc(cname(TODAY(),h.c-1))+' · '+tyB(h.ids)+' · '+esc(tn(h,0))+' <span style="color:var(--mu)">vs</span> '+esc(tn(h,1)):'<span style="color:var(--mu)">Game '+esc(x.k)+'</span>')+'</div>'+
     (co?'<div style="margin-top:4px"><span class="corb">CORRECTION</span> <span style="font-size:14px">Saved <b>'+(h?h.sa+' – '+h.sb:'?')+'</b> → sent <b style="color:var(--y)">'+x.sa+' – '+x.sb+'</b></span></div>':'')+'<div style="font-size:13px;color:var(--mu);margin-top:2px">Sent by <b style="color:var(--tx)">'+esc(x.byn||'?')+'</b> · '+hm(x.at)+(h?' · game to '+gp(g,h).pts:'')+'</div>'+(er?'<div class="note amb" style="margin-top:6px;padding:4px 10px">'+esc(er)+'</div>':'')+'</div>'+
     (own||!h?'':'<input class="ptsin" type="number" inputmode="numeric" min="0" value="'+esc(v.sa)+'" data-i="sub_sa" data-x="'+x.id+'" aria-label="Score team A"><span class="d">–</span><input class="ptsin" type="number" inputmode="numeric" min="0" value="'+esc(v.sb)+'" data-i="sub_sb" data-x="'+x.id+'" aria-label="Score team B">')+
     (own||!h?'':'<button class="btn sm" data-a="subacc" data-x="'+x.id+'"'+(er?' disabled':'')+'>✓ Accept</button>')+'<button class="ol sm" style="color:var(--bad);border-color:var(--bad)" data-a="subrej" data-x="'+x.id+'">'+(own?'Dismiss':'✗ Reject')+'</button></div>'};
  return '<div class="modal tall" data-a="closesubs"><div class="pn" data-a="noop" style="gap:12px;width:min(980px,96vw)"><div class="sb"><div><div class="laby">SCORES TO REVIEW · FROM THE LIVE PAGE</div><div style="font-size:14px;color:var(--mu);margin-top:4px">Check each score, edit if needed, then accept. Rejected games can be sent again from the live page. Your own score on the tablet always wins – except a <b>Correction</b> you accept (old → new). Accept all skips corrections.</div></div><button class="ib" data-a="closesubs" aria-label="Close">×</button></div>'+
   (L.length?'<div class="subl">'+L.map(row).join('')+'</div>':'<div class="empty" style="padding:12px">Nothing to review.</div>')+
   '<div class="sb"><button class="ol" data-a="closesubs">Close</button>'+(L.length?'<button class="btn" data-a="subsall">✓ Accept all</button>':'')+'</div></div></div>'}
async function subDo(id,st){const x=(ui.subs||[]).find(o=>o.id===id);if(!x)return false;const h=subGame(x),co=subCor(x),own=!co&&h&&(h.sa||h.sb);
  if(st==='a'&&(own||!h||subErr(x)))return false;const v=subVal(x),sa=Math.round(num(v.sa)),sb=Math.round(num(v.sb));
  const r=await req('POST','/api/subs/'+id,st==='a'?{st,sa,sb}:{st},15000);
  if(r.s!==200&&r.s!==409){toast(r.s===0?'No internet – try again':(r.j.error||'Not saved'));return false}
  ui.subs=(ui.subs||[]).filter(o=>o.id!==id);if(ui.subE)delete ui.subE[id];if(r.s===409)return true;
  const g=S.games[TODAY()],w=x.byn||'?';
  if(st==='a'&&h&&co){const o=h.sa+'–'+h.sb;h.sa=sa;h.sb=sb;delete h.sp;logIt(g,'Score corrected from live page: '+cname(g.d,h.c-1)+' '+tn(h,0)+' '+o+' → '+sa+'–'+sb+' '+tn(h,1)+' (sent by '+w+')');
    audit('Live score correction accepted: '+cname(g.d,h.c-1)+' '+tn(h,0)+' '+o+' → '+sa+'–'+sb+' '+tn(h,1)+' · sent by '+w+(sa!==x.sa||sb!==x.sb?' as '+x.sa+'–'+x.sb:''))}
  else if(co)audit('Live score correction rejected: '+x.sa+'–'+x.sb+' · sent by '+w+' (kept '+(h?h.sa+'–'+h.sb:'?')+')');
  else if(st==='a'&&h){const was=sa!==x.sa||sb!==x.sb;h.sa=sa;h.sb=sb;delete h.sp;logIt(g,'Score from live page accepted: '+cname(g.d,h.c-1)+' '+tn(h,0)+' '+sa+' – '+sb+' '+tn(h,1)+' (sent by '+w+')');
    audit('Live score accepted: '+cname(g.d,h.c-1)+' '+tn(h,0)+' '+sa+'–'+sb+' '+tn(h,1)+' · sent by '+w+(was?' as '+x.sa+'–'+x.sb:''))}
  else audit('Live score '+(own?'dismissed (tablet score kept)':'rejected')+': '+x.sa+'–'+x.sb+' · sent by '+w);
  save();return true}
Object.assign(act,{
 subsopen:()=>{ui.subm=1;render();subsPoll(true)},closesubs:()=>{ui.subm=0;render()},
 subacc:async x=>{if(await subDo(+x,'a'))toast('Score saved');if(!(ui.subs||[]).length)ui.subm=0;render()},
 subrej:async x=>{const co=subCor((ui.subs||[]).find(o=>o.id===+x));if(await subDo(+x,'r'))toast(co?'Correction rejected · saved score kept':'Rejected · the live page can send again');if(!(ui.subs||[]).length)ui.subm=0;render()},
 subsall:async()=>{let n=0,k=0;for(const x of (ui.subs||[]).slice()){if(subCor(x))continue;const h=subGame(x),own=h&&(h.sa||h.sb);if(own){if(await subDo(x.id,'r'))k++}else if(!subErr(x)&&await subDo(x.id,'a'))n++}
   toast(pl(n,'score')+' saved'+(k?' · '+k+' dismissed (tablet score kept)':'')+((ui.subs||[]).length?' · '+(ui.subs||[]).length+' left to check'+((ui.subs||[]).some(subCor)?' (corrections are checked one by one)':''):''));if(!(ui.subs||[]).length)ui.subm=0;render()}});
document.addEventListener('input',e=>{const el=e.target,k=el.dataset&&el.dataset.i;if(!k||!/^sub_s[ab]$/.test(k)||VIEW())return;ui.subE=ui.subE||{};const o=ui.subE[el.dataset.x]=ui.subE[el.dataset.x]||{};o[k.slice(4)]=el.value;
  clearTimeout(window.__sb);window.__sb=setTimeout(()=>{const a=document.activeElement,id=a&&a.dataset.i,xx=a&&a.dataset.x;render();if(id){const n=document.querySelector('[data-i="'+id+'"][data-x="'+xx+'"]');if(n){n.focus();try{n.setSelectionRange(n.value.length,n.value.length)}catch(err){}}}},600)});

/* ===== v19: names picked on the live page (Guest / Player). Admin + game manager can free a wrongly picked name (✕) – logged to the audit log.
   All names reset by themselves when the session ends (End session / live window over). ===== */
async function lclPoll(){if(!subsOK()||navigator.onLine===false)return;const r=await req('GET','/api/claims',null,15000);if(r.s!==200)return;
  const L=r.j.list||[],old=JSON.stringify(ui.lcl||[]);ui.lcl=L;if(JSON.stringify(L)!==old){if(ui.lclm&&!L.length)ui.lclm=0;render()}}
function lclBtn(d){const n=(ui.lcl||[]).length;return n&&d===TODAY()&&subsOK()?'<button class="ol lclb" data-a="lclopen">👤 Live page names ('+n+')</button>':''}
function vLcl(){const L=ui.lcl||[];
  return '<div class="modal" data-a="closelcl"><div class="pn" data-a="noop" style="gap:12px;width:min(640px,96vw)"><div class="sb"><div><div class="laby">LIVE PAGE NAMES · PICKED ON PHONES</div><div style="font-size:14px;color:var(--mu);margin-top:4px">Each name can be picked on one phone only. ✕ frees a wrongly picked name so the right player can pick it. All names reset at End session.</div></div><button class="ib" data-a="closelcl" aria-label="Close">×</button></div>'+
   (L.length?'<div class="subl">'+L.map(x=>'<div class="subr lclr"><div style="flex:1;min-width:0;font-weight:700">'+esc(x.name)+' <span style="font-weight:400;font-size:13px;color:var(--mu)">· picked '+hm(x.at)+'</span></div><button class="ol sm" style="color:var(--bad);border-color:var(--bad)" data-a="lclfree" data-x="'+esc(x.id)+'" aria-label="Free '+esc(x.name)+'">✕ Free</button></div>').join('')+'</div>':'<div class="empty" style="padding:12px">No names picked.</div>')+
   '<div class="sb"><span></span><button class="ol" data-a="closelcl">Close</button></div></div></div>'}
Object.assign(act,{
 lclopen:()=>{ui.lclm=1;render();lclPoll()},closelcl:()=>{ui.lclm=0;render()},
 lclfree:async id=>{const x=(ui.lcl||[]).find(o=>o.id===id);if(!x)return;const r=await req('DELETE','/api/claims/'+encodeURIComponent(id),null,15000);
   if(r.s!==200&&r.s!==404)return toast(r.s===0?'No internet – try again':(r.j.error||'Not freed'));
   ui.lcl=(ui.lcl||[]).filter(o=>o.id!==id);if(r.s===200){audit('Live page name freed: '+x.name);save()}toast(x.name+' freed · can be picked again');if(!ui.lcl.length)ui.lclm=0;render()}});
