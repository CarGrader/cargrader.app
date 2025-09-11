
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

let __blurbsCache = null;
async function loadBlurbs(){
  if (__blurbsCache) return __blurbsCache;
  const r = await fetch('/static/blurbs.json');
  __blurbsCache = r.ok ? await r.json() : {};
  return __blurbsCache;
}

async function loadYears(){
  try{
    const resp = await getJSON('/api/years');     // resp is an object
    const years = Array.isArray(resp) ? resp : (resp.years || []);
    if (!years.length) throw new Error('No years');
    yearSel.insertAdjacentHTML(
      'beforeend',
      years.map(y => `<option value="${y}">${y}</option>`).join('')
    );
  } catch (e) {
    console.error('loadYears error:', e);
    showError('Failed to load years.');
  }
}
document.addEventListener('DOMContentLoaded', loadYears);

// MAKES
yearSel.addEventListener('change', async () => {
  try{
    clearError();
    makeSel.disabled = true; modelSel.disabled = true; btn.disabled = true;
    makeSel.innerHTML = '<option value="">Select...</option>';
    modelSel.innerHTML = '<option value="">Select...</option>';
    if(!yearSel.value) return;

    const resp = await getJSON(`/api/makes?year=${yearSel.value}`);
    const makes = Array.isArray(resp) ? resp : (resp.makes || []);
    if (!makes.length) throw new Error('No makes');
    makeSel.insertAdjacentHTML('beforeend', makes.map(m=>`<option value="${m}">${m}</option>`).join(''));
    makeSel.disabled = false;
  }catch(e){
    console.error('load makes error:', e);
    showError('Failed to load makes.');
  }
});

// MODELS
makeSel.addEventListener('change', async () => {
  try{
    clearError();
    modelSel.disabled = true; btn.disabled = true;
    modelSel.innerHTML = '<option value="">Select...</option>';
    if(!makeSel.value) return;

    const resp = await getJSON(
      `/api/models?year=${yearSel.value}&make=${encodeURIComponent(makeSel.value)}`
    );
    const models = Array.isArray(resp) ? resp : (resp.models || []);
    if (!models.length) throw new Error('No models');
    modelSel.insertAdjacentHTML('beforeend', models.map(m=>`<option value="${m}">${m}</option>`).join(''));
    modelSel.disabled = false;
  }catch(e){
    console.error('load models error:', e);
    showError('Failed to load models.');
  }
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

  const y = yearSel.value;
  const make = makeSel.value;
  const model = modelSel.value;
  if (!(y && make && model)) return;

  // --- 1) Read canonical Score + Certainty directly from AllCars via /api/score ---
  let score = null;
  let certainty = null;
  let groupId = null;

  try {
    const sc = await getJSON(`/api/score?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    score = (sc && sc.score != null) ? Number(sc.score) : null;
    certainty = (sc && sc.certainty != null) ? Number(sc.certainty) : null;
    groupId = sc && sc.group_id != null ? sc.group_id : null;
  } catch (e) {
    showError('No score found for that selection.');
  }

  // Update the centered Canva-style results (new markup)
  try {
    const resultsSection = document.getElementById('resultsSection');
    const resultTitle    = document.getElementById('resultTitle');
    const scoreValueEl   = document.getElementById('scoreValue');      // new big number
    const certaintyPctEl = document.getElementById('certaintyPct');    // new certainty %

    if (resultTitle) resultTitle.textContent = `${y} ${make} ${model}`;

    if (scoreValueEl) {
      scoreValueEl.textContent = (score != null && !Number.isNaN(score))
        ? Math.round(score)
        : '00';
    }

    if (certaintyPctEl) {
      certaintyPctEl.textContent = (certainty != null && !Number.isNaN(certainty))
        ? `${Math.round(certainty <= 1 ? certainty * 100 : certainty)}%`
        : '—';
    }

    if (resultsSection) resultsSection.hidden = false;
    // === Certainty blurb toggle (inside try) ===
    const certaintyBtn   = document.getElementById('certaintyToggle');
    const certaintyBlurb = document.getElementById('certaintyBlurb');
    
    if (certaintyBtn && certaintyBlurb){
      certaintyBtn.onclick = async () => {
        const blurbs = await loadBlurbs();
        const text =
          blurbs?.certainty ??
          blurbs?.CERTAINTY ??
          blurbs?.certainty_blurb ??
          'Info coming soon.';
        if (certaintyBlurb.hidden){
          certaintyBlurb.textContent = text;
          certaintyBlurb.hidden = false;
        } else {
          certaintyBlurb.hidden = true;
        }
      };
    }

  } catch (_) {
    /* no-op for UI update */
  }

  // (Legacy scorecard IDs, if they still exist in your DOM)
  try {
    if (typeof scoreVal !== 'undefined' && scoreVal) {
      scoreVal.textContent = (score != null && !Number.isNaN(score))
        ? Number(score).toFixed(1)
        : '—';
    }
    if (typeof certVal !== 'undefined' && certVal) {
      if (certainty != null && !Number.isNaN(certainty)) {
        const pct = certainty <= 1 ? certainty * 100 : certainty;
        certVal.textContent = Number(pct).toFixed(1);
      } else {
        certVal.textContent = '—';
      }
    }
  } catch (_) {}

  // --- 2) Continue loading the other panels using your existing endpoints ---
  // Details (complaints, rel_ratio, etc.) — NOTE: we DO NOT compute score here anymore.
  try {
    const d = await getJSON(`/api/details?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);

    // Optional: show summary text if you keep that element
    const detailsText = document.getElementById('detailsText');
    if (detailsText) {
      detailsText.textContent =
        `${d.ModelYear || y} ${d.Make || make} ${d.Model || model} • Complaints: ${d.ComplaintCount ?? d.complaint_count ?? '—'}`;
    }
  } catch (e) {
    // details is optional for the main score UI; do not block other loads
  }

  // Top complaints
  try {
    const top = await getJSON(`/api/top-complaints?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const items = (top.items || []).slice(0, 8);
    document.getElementById('topList').innerHTML =
      items.map(it => `<li>${it.component || it.name || 'Unknown'} — ${it.count ?? ''}</li>`).join('');
  } catch (e) {
    document.getElementById('topList').innerHTML = '<li>No data.</li>';
  }

  // Trims
  try {
    const tr = await getJSON(`/api/trims?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const items = (tr.items || []).sort((a, b) => (b.count || 0) - (a.count || 0));
    document.getElementById('trimsList').innerHTML =
      items.map(it => `<li>${it.trim || it.name || 'Unknown'} — ${it.percentage ?? ''}% (${it.count ?? ''})</li>`).join('');
  } catch (e) {
    document.getElementById('trimsList').innerHTML = '<li>No data.</li>';
  }

  // History chart
  try {
    const hist = await getJSON(`/api/history?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const items = hist.items || [];
    const note = document.getElementById('historyNote');
    if (note) {
      if (hist.note) { note.textContent = hist.note; note.style.display = 'inline-block'; }
      else { note.style.display = 'none'; }
    }
    const cv = document.getElementById('historyChart');
    if (cv) {
      cv.width = cv.clientWidth || 740;
      const ctx = cv.getContext('2d');
      drawHistoryChart(ctx, items);
    }
  } catch (e) { /* no-op */ }
});
