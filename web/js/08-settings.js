/* ===== PIN, Settings, PDF report ===== */
function vPin(){const setting=!S.pin||ui.pmode==='new',old=ui.pmode==='old';
  const title=old?'CURRENT PIN':!setting?'ADMIN ONLY':ui.pin1?'CONFIRM PIN':(S.pin?'NEW PIN':'SET ADMIN PIN');
  const sub=old?'Enter the PIN you use now':!setting?'Enter your 4-digit PIN to open Finance':ui.pin1?'Enter the same 4 digits again':'Choose a 4-digit PIN for Finance';
  const keys=['1','2','3','4','5','6','7','8','9','','0','⌫'].map(k=>k?'<button class="key" data-a="key" data-x="'+k+'" aria-label="'+(k==='⌫'?'Delete':k)+'">'+k+'</button>':'<span></span>').join('');
  return '<div style="display:flex;flex-direction:column;align-items:center;gap:18px"><span style="color:var(--y)">'+LOCK_SVG.replace(/22/g,'44')+'</span><div class="d" style="font-size:44px;line-height:1">'+title+'</div><div style="font-size:15px;color:var(--mu)">'+sub+'</div>'+
   '<div class="row" style="gap:14px;margin:6px 0">'+[0,1,2,3].map(i=>'<span class="pdot'+(i<ui.pin.length?' on':'')+'"></span>').join('')+'</div><div style="height:20px;font-size:14px;color:var(--bad);font-weight:600">'+esc(ui.err)+'</div>'+
   '<div style="display:grid;grid-template-columns:repeat(3,84px);gap:12px">'+keys+'</div>'+(ui.pmode?'<button class="gh" data-a="pincancel">Cancel</button>':'')+'</div>'}
function pinOK(){if(ui.pctx==='hist')ui.hun=true;else ui.unlocked=true}
function pinKey(k){if(k==='⌫'){ui.pin=ui.pin.slice(0,-1);ui.err='';return render()}if(ui.pin.length>=4)return;ui.pin+=k;ui.err='';
  if(ui.pin.length<4)return render();const p=ui.pin;ui.pin='';
  if(ui.pmode==='old'){if(p===S.pin){ui.pmode='new'}else ui.err='Wrong PIN. Try again.';return render()}
  if(S.pin&&ui.pmode!=='new'){if(p===S.pin)pinOK();else ui.err='Wrong PIN. Try again.';return render()}
  if(!ui.pin1){ui.pin1=p;return render()}
  if(p===ui.pin1){S.pin=p;ui.pin1='';const ch=ui.pmode==='new'&&ui.tab==='settings';ui.pmode=null;if(!ch)pinOK();save();toast('PIN saved')}else{ui.pin1='';ui.err='PINs did not match. Start again.'}render()}

function vSettings(){const df=S.def,ss=sessions().length,E=ui.lvE||{},nE=Object.keys(E).length,act2=active();const g=Object.values(S.games).reduce((a,x)=>a+x.hist.length,0);
  const nr=(S.rules||[]).filter(r=>r.nw).length;
  const tabs='<div class="seg">'+[['main','General'],['rules','Learned rules'+(nr?' <i class="nb">New</i>':'')]].map(([k,l])=>'<button class="'+(ui.setTab===k?'on':'')+'" data-a="stab" data-x="'+k+'">'+l+'</button>').join('')+'</div>';
  if(ui.setTab==='rules'){const R=S.rules||[];
    return '<div class="sb"><h1>SET<span>TINGS</span></h1>'+tabs+'</div><section class="pn"><div class="laby">LEARNED RULES</div><div style="font-size:14px;color:var(--mu)">When you change Up Next the same way about 3 times over 2+ sessions, the app learns the reason and applies it automatically. Your manual placement always wins.</div>'+
     (R.length?R.map((r,i)=>'<div class="row" style="background:var(--bg);border-radius:12px;padding:10px 12px;gap:12px"><div style="flex:1"><div style="font-weight:600;font-size:16px">'+(r.nw?'<i class="nb">New</i> ':'')+esc(r.why)+'</div><div style="font-size:13px;color:var(--mu)">Seen '+pl(r.n||0,'time')+' · learned '+dlab(r.at)+'</div></div><button class="fc'+(r.on?' on':'')+'" data-a="ruletog" data-x="'+i+'">'+(r.on?'On':'Off')+'</button><button class="ol sm" style="color:var(--bad)" data-a="ruledel" data-x="'+i+'">Delete</button></div>').join(''):'<div class="empty">No learned rules yet.</div>')+
     '<div style="font-size:13px;color:var(--mu)">'+pl((S.ovr||[]).length,'manual change')+' recorded (levels of all 4 players each time).</div></section>'}
  return '<div class="sb"><h1>SET<span>TINGS</span></h1>'+tabs+'</div>'+
   '<section class="pn"><div class="laby">SESSION DEFAULTS · USED FOR EVERY SESSION</div><div class="row" style="flex-wrap:wrap;gap:10px"><span class="lab" style="margin-right:6px">POINTS TO WIN</span>'+[11,15,21].map(p=>'<button class="fc'+(df.pts==p?' on':'')+'" data-a="dpts" data-x="'+p+'">'+p+'</button>').join('')+
   '<button class="fc'+(df.deuce?' on':'')+'" style="margin-left:10px" data-a="ddeuce">Deuce '+(df.deuce?'ON · 2-point lead, cap '+capOf(df):'OFF')+'</button></div>'+
   '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">'+[['slot','Game minutes','1'],['chg','Changeover minutes','1'],['spt','Shuttles per tube','1']].map(([k,l,st])=>'<label class="fl">'+l+'<input class="fin" type="number" inputmode="decimal" min="1" step="'+st+'" value="'+esc(df[k])+'" data-i="d_'+k+'"></label>').join('')+'</div>'+
   '<div style="font-size:13px;color:var(--mu)">Court hours are set per session in Schedule session.</div></section>'+
   '<section class="pn"><div class="sb"><div class="laby">PLAYER LEVELS</div><button class="btn" data-a="lvupd"'+(nE?'':' disabled')+'>Update'+(nE?' ('+nE+')':'')+'</button></div><div style="font-size:14px;color:var(--mu)">Changes apply to Up Next and planned games after Update. Games on court now stay as they are.</div>'+
   (act2.length?act2.map(p=>{const v=E[p.id]!=null?E[p.id]:p.lv;return '<div class="row" style="justify-content:space-between;background:var(--bg);border-radius:12px;padding:6px 8px 6px 14px"><span style="font-weight:600;font-size:16px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(E[p.id]!=null?'<span style="color:var(--y)">● </span>':'')+esc(p.name)+'</span><div class="lvb" style="background:var(--pn)">'+lvSeg(v,'slv',p.id)+'</div></div>'}).join(''):'<div class="empty" style="padding:12px">No players yet.</div>')+'</section>'+
   '<section class="pn"><div class="sb"><div class="laby">ORGANIZERS</div><span class="lab">'+(S.orgs||[]).length+' / 5</span></div><div style="font-size:14px;color:var(--mu)">Organizers sit out first and only fill slots when needed. They receive payments and get a partner card in Finance → Rebels.</div>'+
   '<div class="row" style="flex-wrap:wrap;gap:8px">'+act2.map(p=>'<button class="orgc'+(isOrg(p.id)?' on':'')+'" data-a="org" data-x="'+p.id+'">'+(isOrg(p.id)?'★ ':'')+esc(p.name)+'</button>').join('')+'</div></section>'+
   '<section class="pn"><div class="laby">ADMIN PIN</div>'+(ui.pmode?'<div style="display:flex;justify-content:center;padding:10px 0">'+vPin()+'</div>':
    '<div class="row"><span style="color:var(--mu);font-size:15px;flex:1">'+(S.pin?'Finance is locked with a 4-digit PIN. Changing it needs the current PIN.':'No PIN set yet.')+'</span><button class="btn" data-a="chpin">'+(S.pin?'Change PIN':'Set PIN')+'</button></div>')+'</section>'+
   '<section class="pn"><div class="laby">BACKUP</div><div style="font-size:14px;color:var(--mu)">Everything is saved on this tablet on every tap. Keep a copy elsewhere too (WhatsApp to yourself, email, notes).</div>'+
   '<div class="row"><div class="tile"><b>'+active().length+'</b><i>Players</i></div><div class="tile"><b>'+ss+'</b><i>Sessions</i></div><div class="tile"><b>'+g+'</b><i>Games saved</i></div><div class="tile"><b style="font-size:20px;line-height:1.7">'+(S.savedAt?new Date(S.savedAt).toLocaleString():'—')+'</b><i>Last saved</i></div></div>'+
   '<div class="lab">EXPORT</div><textarea id="bexp" readonly>'+esc(JSON.stringify(S))+'</textarea><div class="row"><button class="btn" data-a="bcopy">Copy backup</button>'+(NB&&NB.share?'<button class="ol" data-a="bshare">Share…</button>':'')+'</div>'+
   '<div class="lab">IMPORT</div><div style="font-size:14px;color:var(--mu)">Paste a backup below. This replaces all data on this tablet.</div><textarea id="bimp" placeholder="Paste backup text here"></textarea><div class="row"><button class="ol" style="border-color:var(--bad);color:var(--bad)" data-a="bimport">Import backup</button></div></section>'}

/* ---------- PDF report: exactly the Kitty selection ---------- */
function vReport(ds,title){const all=allCalc(),sel=all.filter(s=>ds.includes(s.d));
  const T=(h,r)=>'<table><thead><tr>'+h.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+r.join('')+'</tbody></table>',tr=c=>'<tr>'+c.map(x=>'<td>'+x+'</td>').join('')+'</tr>';
  const tl=a=>'<div class="tl">'+a.map(([l,v])=>'<div><i>'+l+'</i><b>'+v+'</b></div>').join('')+'</div>';
  const secs=sel.map((s,k)=>{const g=S.games[s.d];
    const pay=s.ids.slice().sort((a,b)=>nameOf(a).localeCompare(nameOf(b))).map(id=>{const p=payOf(s.f,id);return tr([esc(nameOf(id)),p?'Paid · '+(p.m==='bank'?'Bank':'Cash')+(p.by?' · '+esc(nameOf(p.by)):''):'<b style="color:#C0392B">Not paid</b>',p?A(s.FEE):'—'])});
    const ex=[tr(['Court booking',esc(s.loc)+' · '+courtSum(s.d)+(s.pk?' · package share':''),A(s.COURT)]),tr(['Shuttles',num(s.f.used)+' × '+A(s.PER),A(s.shut)])].concat(s.f.oth.map(o=>tr([esc(o.lab||'Misc'),o.by?esc(nameOf(o.by)):'',A(num(o.amt))])));
    let gm='<div class="bar">GAMES</div><div>No games recorded.</div>';
    if(g&&(g.hist.length||g.st)){const cnt=counts(g,false),tot=g.hist.reduce((a,h)=>a+h.s,0);
      const rows=g.hist.slice().reverse().sort((a,b)=>a.c-b.c).map((h,j)=>{const tie=h.sa===h.sb,aw=h.sa>h.sb;return tr([j+1,esc(cname(s.d,h.c-1))+' · '+hlab(h),esc(tn(h,0)),'<b>'+h.sa+' – '+h.sb+'</b>',esc(tn(h,1)),tie?'Draw':esc(tn(h,aw?0:1)),fmt(h.s)])});
      const ppl=[...new Set([...s.ids,...Object.keys(cnt)])].filter(id=>P(id)).sort((a,b)=>(cnt[a]||0)-(cnt[b]||0)||nameOf(a).localeCompare(nameOf(b)));
      gm='<div class="bar">GAMES · '+g.hist.length+' games · average '+(g.hist.length?fmt(tot/g.hist.length):'—')+'</div>'+(rows.length?T(['#','COURT · GAME','TEAM A','SCORE','TEAM B','WINNER','TIME'],rows):'<div>No games recorded.</div>')+
       '<div class="bar keep">GAMES PLAYED, ATTENDANCE &amp; BENCH TIME</div>'+T(['NAME','GAMES','ARRIVED','LEFT','BENCH TIME'],ppl.map(id=>{const a=att(s.d,id);return tr([esc(nameOf(id)),cnt[id]||0,a&&a.a?hm(a.a):'—',a&&a.l?hm(a.l):'—',fmtH(benchSec(g,id))])}))}
    return '<div'+(k?' class="pb"':'')+'><h2>Session '+s.no+' · '+dlab(s.d)+' · '+esc(s.loc)+'</h2><div class="meta">Start '+(s.st?hm(s.st):'—')+' · End '+(s.en?hm(s.en):s.st?'still running':'—')+' · Played '+(s.ps?fmtH(s.ps):'—')+' / Booked '+hrsL(s.bh)+' ('+courtSum(s.d)+') · '+s.pl+' players · Court fee '+A(s.COURT)+' · Shuttle '+A(s.PER)+' each</div>'+
     tl([['Collected',A(s.ret)],['Spent',A(s.inv)],['Balance','AED '+sg(s.sav)],['Pending',(s.pl-s.pdn)+(s.due?' · '+A(s.due):'')],['Cost per head',s.pl?A(s.inv/s.pl):'—']])+
     '<div class="cols"><div><div class="bar">PAYMENTS · '+s.pdn+' / '+s.pl+' PAID · FEE '+A(s.FEE)+'</div>'+T(['NAME','STATUS','AMOUNT'],pay.length?pay:[tr(['No players','',''])])+'</div><div><div class="bar">EXPENSES · '+A(s.inv)+'</div>'+T(['ITEM','DETAIL','AMOUNT'],ex)+'</div></div>'+gm+'</div>'}).join('');
  const sum=k=>sel.reduce((a,s)=>a+s[k],0),pi=sum('inv'),pr=sum('ret'),U=unpaidList(sel);
  const per=sel.length>1?'<div class="pb"><h2>Summary · '+esc(title)+'</h2>'+tl([['Sessions',sel.length],['Invested',A(pi)],['Returns',A(pr)],['Saved','AED '+sg(pr-pi)],['Games',sum('ng')]])+
   '<div class="bar">SESSIONS</div>'+T(['SESSION','LOCATION','COURTS · HOURS','COURT FEE','SHUTTLE','PAID','PLAYED / BOOKED','INVESTED','RETURNS','SAVED'],sel.map(s=>tr(['S'+s.no+' · '+dlab(s.d),esc(s.loc),courtSum(s.d),A(s.COURT),A(s.PER),s.pdn+' / '+s.pl,(s.ps?fmtH(s.ps):'—')+' / '+hrsL(s.bh),A(s.inv),A(s.ret),'AED '+sg(s.sav)])))+
   (U.length?'<div class="bar">UNPAID</div>'+T(['NAME','SESSIONS'],U.map(u=>tr([esc(nameOf(u.id)),u.ds.map(dlab).join(', ')]))):'')+
   '<div class="ult keep"><div class="bar">SUMMARY · '+esc(title.toUpperCase())+'</div><div><b>Tips</b>'+selTips(sel).map(x=>'<div>→ '+esc(x)+'</div>').join('')+'</div></div></div>':'';
  return '<div class="rhead"><b>REBELS BADMINTON</b><span>Report · '+esc(title)+' · made '+dlab(TODAY())+' '+hm(Date.now())+'</span></div>'+secs+per}
