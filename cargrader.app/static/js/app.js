
async function getJSON(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

function showError(msg){
  const el = document.getElementById('err');
  el.textContent = msg || 'Something went wrong.';
  el.style.display = 'block';
}
function clearError(){ const el = document.getElementById('err'); el.style.display='none'; el.textContent=''; }

const yearSel = document.getElementById('year');
const makeSel = document.getElementById('make');
const modelSel = document.getElementById('model');
const btn = document.getElementById('checkBtn');
const result = document.getElementById('result');
const scoreVal = document.getElementById('scoreVal');
const certVal = document.getElementById('certVal');
const complaintsVal = document.getElementById('complaintsVal');

async function loadYears(){
  try{
    const years = await getJSON('/api/years');
    yearSel.insertAdjacentHTML('beforeend', years.map(y=>`<option value="${y}">${y}</option>`).join(''));
  }catch(e){ showError('Failed to load years.'); }
}
document.addEventListener('DOMContentLoaded', loadYears);

yearSel.addEventListener('change', async () => {
  try{
    clearError();
    makeSel.disabled = true; modelSel.disabled = true; btn.disabled = true;
    makeSel.innerHTML = '<option value="">Select...</option>';
    modelSel.innerHTML = '<option value="">Select...</option>';
    if(!yearSel.value) return;
    const makes = await getJSON(`/api/makes?year=${yearSel.value}`);
    makeSel.insertAdjacentHTML('beforeend', makes.map(m=>`<option value="${m}">${m}</option>`).join(''));
    makeSel.disabled = false;
  }catch(e){ showError('Failed to load makes.'); }
});

makeSel.addEventListener('change', async () => {
  try{
    clearError();
    modelSel.disabled = true; btn.disabled = true;
    modelSel.innerHTML = '<option value="">Select...</option>';
    if(!makeSel.value) return;
    const models = await getJSON(`/api/models?year=${yearSel.value}&make=${encodeURIComponent(makeSel.value)}`);
    modelSel.insertAdjacentHTML('beforeend', models.map(m=>`<option value="${m}">${m}</option>`).join(''));
    modelSel.disabled = false;
  }catch(e){ showError('Failed to load models.'); }
});

modelSel.addEventListener('change', () => { btn.disabled = !(yearSel.value && makeSel.value && modelSel.value); });

// Collapsible logic (+ / -)
document.querySelectorAll('.box__header').forEach(h => {
  h.addEventListener('click', () => {
    const sel = h.getAttribute('data-toggle');
    const box = document.querySelector(sel);
    if(!box) return;
    const open = box.classList.toggle('open');
    const t = h.querySelector('.box__toggle');
    if(t) t.textContent = open ? '-' : '+';
  });
});

// Minimal history chart using Canvas 2D with rise-from-zero animation
function drawHistoryChart(ctx, data){
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);
  if(!data || data.length===0){ return; }
  const pad = 24;
  const xs = data.map(d=>d.year);
  const ysA = data.map(d=>d.actual||0);
  const ysE = data.map(d=>d.expected||0);
  const maxY = Math.max(10, ...ysA, ...ysE);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const x = v => pad + (W-2*pad) * (v-minX)/(maxX-minX || 1);
  const y = v => H - pad - (H-2*pad)*(v/maxY);

  let t = 0, steps = 45;
  function frame(){
    ctx.clearRect(0,0,W,H);
    // axes
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(pad, H-pad); ctx.lineTo(W-pad, H-pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, H-pad); ctx.lineTo(pad, pad); ctx.stroke();
    ctx.globalAlpha = 1;

    // helper to draw line
    function path(vals, stroke){
      ctx.beginPath();
      vals.forEach((v,i)=>{
        const xv = x(xs[i]);
        const yv = y(v * (t/steps));
        if(i===0) ctx.moveTo(xv, yv); else ctx.lineTo(xv, yv);
      });
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    path(ysE, '#efc362'); // expected (accent)
    path(ysA, '#8f78d1'); // actual (purple tint)

    if(t<steps){ t++; requestAnimationFrame(frame); }
  }
  frame();
}

btn.addEventListener('click', async () => {
  clearError();
  const y = yearSel.value, make = makeSel.value, model = modelSel.value;
  if(!(y && make && model)) return;
  try{
    const d = await getJSON(`/api/details?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    // The endpoint returns ComplaintCount and maybe score/certainty fields depending on schema
    const score = (d.score != null) ? d.score : (d.rel_ratio != null ? (100*Math.max(0,1-d.rel_ratio)).toFixed(1) : null);
    const cert  = (d.certainty != null) ? d.certainty : null;
    scoreVal.textContent = (score!=null) ? Number(score).toFixed(1) : '—';
    certVal.textContent  = (cert!=null) ? Number(cert).toFixed(1) : '—';
    complaintsVal.textContent = (d.complaint_count!=null) ? d.complaint_count : (d.ComplaintCount || '—');
    document.getElementById('detailsText').textContent =
      `${d.ModelYear || y} ${d.Make || make} ${d.Model || model} • Complaints: ${d.ComplaintCount ?? d.complaint_count ?? '—'}`;
    result.style.display='flex';
  }catch(e){
    showError('No grade found for that selection.');
    result.style.display='none';
  }

  // Top complaints
  try{
    const top = await getJSON(`/api/top?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const items = (top.items||[]).slice(0,8);
    document.getElementById('topList').innerHTML = items.map(it => `<li>${it.component||it.name||'Unknown'} — ${it.count ?? ''}</li>`).join('');
  }catch(e){ document.getElementById('topList').innerHTML = '<li>No data.</li>'; }

  // Trims
  try{
    const tr = await getJSON(`/api/trims?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const items = (tr.items||[]).sort((a,b)=> (b.count||0)-(a.count||0));
    document.getElementById('trimsList').innerHTML = items.map(it => `<li>${it.name} — ${it.percentage ?? ''}% (${it.count ?? ''})</li>`).join('');
  }catch(e){ document.getElementById('trimsList').innerHTML = '<li>No data.</li>'; }

  // History chart
  try{
    const hist = await getJSON(`/api/history?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const items = hist.items || [];
    const note = document.getElementById('historyNote');
    if(hist.note){ note.textContent = hist.note; note.style.display='inline-block'; } else { note.style.display='none'; }
    const cv = document.getElementById('historyChart');
    // ensure crisp width
    cv.width = cv.clientWidth || 740;
    const ctx = cv.getContext('2d');
    drawHistoryChart(ctx, items);
  }catch(e){ /* no-op */ }
});
