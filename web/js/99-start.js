/* ===== start-up (last file: every module is defined) ===== */
Object.assign(act,SYACT);
migrate();save();render();const H0=document.querySelector('.home');if(H0)H0.classList.add('pre');
if(SY.token)setTimeout(()=>syncNow(false),800);
/* test hooks (headless checks) */
window.RB={get S(){return S},set S(v){S=v},G,planFull,rateInfo,checkGame,fmtOK,gType,isF,isDum,isStrong,powerSet,schedOnce,planCtx,fullSlots,save,render,act,ui,migrate,fullIds,get LAST(){return LASTPLAN},ratings,counts,sendCourt,erSave,snapList,snapTake,dataOnly,scoreErr,gp,get SY(){return SY},syncNow,vStat,allCalc,impText,VIEW,replaceAll,undoRestore,canUndo,fpSync};
