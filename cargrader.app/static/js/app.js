// === CarGrader App ===
console.log('app.js loaded successfully');

// === Core helpers ===
async function getJSON(url){
  const r = await fetch(url);
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

function showError(msg){
  const el = document.getElementById('err');
  if (!el) return;
  el.textContent = msg || 'Something went wrong.';
  el.style.display = 'block';
}
function clearError(){
  const el = document.getElementById('err');
  if (!el) return;
  el.style.display='none';
  el.textContent='';
}

// === DOM refs (top selectors & score UI) ===
console.log('Getting DOM elements...');
const yearSel = document.getElementById('year');
const makeSel = document.getElementById('make');
const modelSel = document.getElementById('model');
const btn = document.getElementById('checkBtn');
const result = document.getElementById('result');
const scoreVal = document.getElementById('scoreVal');
const certVal = document.getElementById('certVal');
const complaintsVal = document.getElementById('complaintsVal');
console.log('DOM elements retrieved');

// === Inject minimal CSS to center/stack filters and style checklists & "View" link ===
(function injectLookupStyles(){
  const css = `
  .lookup { display:flex; flex-direction:column; gap:12px; }
  .lookup__filters { display:flex; flex-direction:column; gap:10px; max-width:720px; margin:0 auto; }
  .lookup__filters .form-row { display:flex; flex-direction:column; gap:6px; }
  .checks { max-height:220px; overflow:auto; border:1px solid var(--border,#333); border-radius:10px; padding:8px; }
  .checks .chk { display:flex; align-items:center; gap:8px; justify-content:space-between; }
  .checks .lbl { flex:1; text-align:left; }
  .checks input[type="checkbox"] { margin-left:8px; }
  .lookup .mini-view-link { background:none; border:none; padding:0; color:var(--primary-600); text-decoration:underline; cursor:pointer; }
  .lookup .mini-view-link:hover { color:var(--primary); }`;
  const style = document.createElement('style');
  style.setAttribute('data-injected','lookup');
  style.textContent = css;
  document.head.appendChild(style);
})();
console.log('CSS injection completed');

// === Blurbs cache ===
console.log('Starting blurbs cache setup...');
let __blurbsCache = null;
async function loadBlurbs(){
  if (__blurbsCache) return __blurbsCache;
  const r = await fetch('/static/blurbs.json');
  __blurbsCache = r.ok ? await r.json() : {};
  return __blurbsCache;
}
console.log('loadBlurbs function defined');

// === Years (top selectors) ===
async function loadYears(){
  try{
    const resp = await getJSON('/api/years');
    const years = Array.isArray(resp) ? resp : (resp.years || []);
    if (!years.length) throw new Error('No years');
    if (yearSel) {
      yearSel.insertAdjacentHTML(
        'beforeend',
        years.map(y => `<option value="${y}">${y}</option>`).join('')
      );
    }
  } catch (e) {
    console.error('loadYears error:', e);
    showError('Failed to load years.');
  }
}
document.addEventListener('DOMContentLoaded', loadYears);

// === History chart helpers (unchanged except responsive polish) ===
function getCanvasCssSize(canvas){
  let node = canvas.parentElement;
  let w = 0;
  while (node && w < 320){
    const cs = getComputedStyle(node);
    const padH = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    w = Math.round(node.clientWidth - padH);
    node = node.parentElement;
  }
  if (w < 320) {
    w = Math.max(320, Math.round(document.documentElement.clientWidth - 48));
  }
  const h = Math.round(w * 9 / 16);
  return { w, h };
}
function setupHiDPICanvas(canvas, cssW, cssH){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.style.width  = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
function renderHistory(items){
  const cv = document.getElementById('historyChart');
  if (!cv) return;
  if (cv.offsetParent === null) {
    requestAnimationFrame(() => renderHistory(items));
    return;
  }
  const { w, h } = getCanvasCssSize(cv);
  if (w < 320) { setTimeout(() => renderHistory(items), 60); return; }
  const ctx = setupHiDPICanvas(cv, w, h);
  drawHistoryChart(ctx, items, w, h);
}
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
function animateSlotNumber(el, finalValue, opts = {}){
  if (!el) return;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = prefersReduced ? 0 : (opts.duration ?? 800);
  const scramblePortion = 0.6;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const end = clamp(finalValue ?? 0, 0, 100);
  const hasDecimal = String(finalValue).includes('.');
  if (duration <= 0){ 
    el.textContent = hasDecimal ? end.toFixed(1) : String(Math.round(end)); 
    return; 
  }
  const startTime = performance.now();
  let raf;
  function frame(now){
    const t = clamp((now - startTime) / duration, 0, 1);
    if (t < scramblePortion){
      el.textContent = String(Math.floor(Math.random() * 101)).padStart(2,'0');
    }else{
      const p = (t - scramblePortion) / (1 - scramblePortion);
      const eased = easeOutCubic(p);
      const currentValue = end * eased;
      el.textContent = hasDecimal ? currentValue.toFixed(1) : String(Math.round(currentValue));
    }
    if (t < 1){ raf = requestAnimationFrame(frame); }
    else { el.textContent = hasDecimal ? end.toFixed(1) : String(Math.round(end)); }
  }
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

// === Top selectors: makes/models ===
if (yearSel) {
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
makeSel.addEventListener('change', async () => {
  try{
    clearError();
    modelSel.disabled = true; btn.disabled = true;
    modelSel.innerHTML = '<option value="">Select...</option>';
    if(!makeSel.value) return;
    const resp = await getJSON(`/api/models?year=${yearSel.value}&make=${encodeURIComponent(makeSel.value)}`);
    const models = Array.isArray(resp) ? resp : (resp.models || []);
    if (!models.length) throw new Error('No models');
    modelSel.insertAdjacentHTML('beforeend', models.map(m=>`<option value="${m}">${m}</option>`).join(''));
    modelSel.disabled = false;
  }catch(e){
    console.error('load models error:', e);
    showError('Failed to load models.');
  }
});
}
if (modelSel) {
modelSel.addEventListener('change', () => { btn.disabled = !(yearSel.value && makeSel.value && modelSel.value); });
}

// Collapsible box toggle (+ / -)
document.querySelectorAll('.box__header').forEach(h => {
  h.addEventListener('click', () => {
    const sel = h.getAttribute('data-toggle');
    const box = document.querySelector(sel);
    if(!box) return;
    const open = box.classList.toggle('open');
    const t = h.querySelector('.box__toggle');
    const content = h.nextElementSibling;
    if(t) t.classList.toggle('active');
    if(content && content.classList.contains('box__content')) {
      content.classList.toggle('active');
    }
    if (open && window.__historyItems && box.querySelector('#historyChart')) {
      setTimeout(() => renderHistory(window.__historyItems), 0);
    }
  });
});

// === History chart drawing (unchanged layout + legend) ===
function drawHistoryChart(ctx, items, cssW, cssH){
  const C = ctx.canvas, W = cssW, H = cssH;
  const css = getComputedStyle(document.documentElement);
  const PURPLE = (css.getPropertyValue('--primary-600') || '#522e93').trim();
  const YELLOW = (css.getPropertyValue('--accent') || '#efc362').trim();
  const GRID   = (css.getPropertyValue('--border') || '#2a2046').trim();
  const TEXT   = (css.getPropertyValue('--text') || '#f5f8ff').trim();
  const padL = 70, padR = 20, padT = 40, padB = 70;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const years    = items.map(d => d.year ?? d.x ?? '');
  const actual   = items.map(d => Number(d.actual ?? d.count ?? 0));
  const expected = items.map(d => Number(d.expected ?? d.exp ?? 0));
  const maxY = Math.max(1, ...actual, ...expected);
  const { tickMax, step, ticks } = niceTicks(maxY, 5);
  ctx.clearRect(0,0,W,H);
  ctx.font = '12px Open Sans, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT;
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ticks.forEach(t => {
    const y = padT + plotH * (1 - t/tickMax);
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(W - padR,y); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(String(t), padL - 10, y);
  });
  ctx.beginPath(); ctx.moveTo(padL, padT + plotH + 0.5); ctx.lineTo(W - padR, padT + plotH + 0.5); ctx.stroke();
  const n = years.length || 1;
  const xFor = (i) => padL + (plotW * (i/(Math.max(1, n-1))));
  years.forEach((yr, i) => { const x = xFor(i); ctx.textAlign='center'; ctx.fillText(String(yr), x, H - padB/2); });
  const yFor = (v) => padT + plotH * (1 - (v / tickMax));
  ctx.lineWidth = 3; ctx.strokeStyle = PURPLE; ctx.beginPath();
  actual.forEach((v,i) => { const x = xFor(i), y = yFor(v); if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
  ctx.fillStyle = PURPLE; actual.forEach((v,i) => { const x=xFor(i), y=yFor(v); ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill(); });
  ctx.strokeStyle = YELLOW; ctx.beginPath();
  expected.forEach((v,i) => { const x = xFor(i), y = yFor(v); if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.stroke();
  ctx.fillStyle = YELLOW; expected.forEach((v,i) => { const x=xFor(i), y=yFor(v); ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill(); });
  const legendPadR = 24; const legendX = W - legendPadR - 200; const legendY = padT - 8; const lineH=20;
  ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.font='13px Open Sans, system-ui, sans-serif'; ctx.fillStyle=TEXT;
  ctx.strokeStyle = PURPLE; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(legendX,legendY); ctx.lineTo(legendX+22,legendY); ctx.stroke();
  ctx.fillText('Actual Complaints Count', legendX + 30, legendY);
  const y2 = legendY + lineH; ctx.strokeStyle = YELLOW; ctx.beginPath(); ctx.moveTo(legendX,y2); ctx.lineTo(legendX+22,y2); ctx.stroke();
  ctx.fillText('Expected Complaints Count', legendX + 30, y2);
}
function niceTicks(maxValue, desired=5){
  if (!isFinite(maxValue) || maxValue <= 0){ return { tickMax:10, step:2, ticks:[0,2,4,6,8,10] }; }
  const HEADROOM = 1.15, rawTop = maxValue * HEADROOM;
  const base = Math.pow(10, Math.floor(Math.log10(rawTop)));
  const tops = [1,1.2,1.5,2,2.5,3,4,5,6,8,10].map(m => m*base);
  let tickMax = tops.find(v => v >= rawTop) || 10*base;
  const idealStep = tickMax / desired;
  const sb = Math.pow(10, Math.floor(Math.log10(idealStep)));
  const choices = [1,1.2,1.5,2,2.5,5,10].map(m => m*sb);
  let step = choices.find(v => v >= idealStep) || 10*sb;
  const ticks = []; for (let t = 0; t <= tickMax + 1e-9; t += step){ ticks.push(Math.round(t)); }
  return { tickMax, step, ticks };
}

// === Main "Check" button behavior ===
if (btn) {
btn.addEventListener('click', async () => {
  clearError();
  const y = yearSel.value, make = makeSel.value, model = modelSel.value;
  if (!(y && make && model)) return;

  // 1) Canonical score
  let score = null, certainty = null, groupId = null;
  try {
    const sc = await getJSON(`/api/score?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    score = (sc && sc.score != null) ? Number(sc.score) : null;
    certainty = (sc && sc.certainty != null) ? Number(sc.certainty) : null;
    groupId = sc && sc.group_id != null ? sc.group_id : null;
  } catch (e) { showError('No score found for that selection.'); }

  // Update results UI (new card layout)
  try {
    const resultsSection = document.getElementById('resultsSection');
    const resultTitle    = document.getElementById('resultTitle');
    const scoreValueEl   = document.getElementById('scoreValue');
    const certaintyPctEl = document.getElementById('certaintyPct');
    if (resultTitle) resultTitle.textContent = `${y} ${make} ${model}`;
    const scoreBlock = document.getElementById('scoreBlock');
    const noDataMsg  = document.getElementById('noDataMsg');
    if (score === 0 || score == null) {
      if (scoreBlock) scoreBlock.style.display = 'none';
      if (noDataMsg) { noDataMsg.style.display = 'block'; noDataMsg.textContent = "We don't have enough information yet!"; }
    } else {
      if (scoreBlock) scoreBlock.style.display = 'block';
      if (noDataMsg) noDataMsg.style.display = 'none';
      if (scoreValueEl) animateSlotNumber(scoreValueEl, Number(score.toFixed(1)), { duration: 800 });
      if (certaintyPctEl) {
        const pct = (certainty != null) ? (Number(certainty) <= 1 ? Number(certainty) * 100 : Number(certainty)) : null;
        certaintyPctEl.textContent = (pct != null && !Number.isNaN(pct)) ? `${Math.round(pct)}%` : '—';
      }
    }
    if (resultsSection) resultsSection.hidden = false;

    const certaintyBtn   = document.getElementById('certaintyToggle');
    const certaintyBlurb = document.getElementById('certaintyBlurb');
    if (certaintyBtn && certaintyBlurb){
      certaintyBtn.onclick = async () => {
        const blurbs = await loadBlurbs();
        const text = blurbs?.certainty ?? blurbs?.CERTAINTY ?? blurbs?.certainty_blurb ?? 'Info coming soon.';
        if (certaintyBlurb.hidden){ certaintyBlurb.textContent = text; certaintyBlurb.hidden = false; }
        else { certaintyBlurb.hidden = true; }
      };
    }
  } catch (_) {}

  // 2) Details (two-line write-up)
  try {
    const d = await getJSON(`/api/details?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const modelYear = d.ModelYear ?? d.year ?? y;
    const makeName  = d.Make      ?? d.make ?? make;
    const modelName = d.Model     ?? d.model ?? model;
    const count     = d.ComplaintCount ?? d.complaint_count ?? d.Count ?? null;
    const rel       = d.RelRatio  ?? d.rel_ratio ?? null;
    const countText = (count != null) ? Number(count).toLocaleString() : '—';
    const line1 = `The ${modelYear} ${makeName} ${modelName} has received ${countText} complaints`;
    let line2 = '';
    if (rel != null && Number(rel) > 0) {
      const r = Number(rel);
      if (r >= 0.95 && r <= 1.05) line2 = `According to our data this is very typical for this car's age and sales volume`;
      else if (r < 1) line2 = `According to our data that is ${(1/r).toFixed(1)} times more than what is expected for this car's age and sales volume`;
      else line2 = `According to our data that is ${r.toFixed(1)} times less than what is expected for this car's age and sales volume`;
    } else line2 = `According to our data we don't have enough information to compare this car to what is expected for its age and sales volume`;
    const detailsEl = document.getElementById('detailsText') || document.getElementById('detailsPanel');
    if (detailsEl) detailsEl.innerHTML = `<p>${line1}</p><p>${line2}</p>`;
  } catch (_) {}

  // 3) Top complaints
  try {
    const top = await getJSON(`/api/top-complaints?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const items = (top.items || []).slice(0, 8);
    const html = items.map(it => {
      const comp = it.component || 'Unknown';
      const pct  = (typeof it.percent === 'number') ? `${it.percent.toFixed(1)}%`
                 : (it.percent != null ? `${Number(it.percent).toFixed(1)}%` : '—');
      const sum  = it.summary ? `<div class="top-summary">${it.summary}</div>` : '';
      return `<li><strong>${comp}</strong> — ${pct}${sum}</li>`;
    }).join('');
    const topList = document.getElementById('topList');
    if (topList) topList.innerHTML = html || '<li>No data.</li>';
  } catch (_) {
    const topList = document.getElementById('topList');
    if (topList) topList.innerHTML = '<li>No data.</li>';
  }

  // 4) Trims
  try {
    const tr = await getJSON(`/api/trims?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const items = (tr.items || []).sort((a, b) => (b.count || 0) - (a.count || 0));
    const tbody = document.getElementById('trimsTbody');
    if (!tbody) throw new Error('Missing #trimsTbody');
    const rows = items.map(it => {
      const name = it.trim || it.series || it.name || 'Unknown';
      const count = (it.count != null) ? Number(it.count).toLocaleString() : '—';
      const pct = (it.percentage != null)
        ? `${Number(it.percentage).toFixed(0)}%`
        : (it.percent != null ? `${Number(it.percent).toFixed(0)}%` : '—');
      return `<tr><td>${name}</td><td class="num">${count}</td><td class="num">${pct}</td></tr>`;
    }).join('');
    tbody.innerHTML = rows || `<tr><td colspan="3" style="text-align:center;color:var(--muted)">No data.</td></tr>`;
  } catch (_) {
    const tbody = document.getElementById('trimsTbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--muted)">No data.</td></tr>`;
  }

  // 5) History
  try {
    const hist = await getJSON(`/api/history?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const items = hist.items || [];
    const note = document.getElementById('historyNote');
    if (note) { if (hist.note) { note.textContent = hist.note; note.style.display='inline-block'; } else { note.style.display='none'; } }
    renderHistory(items);
    window.__historyItems = items;
  } catch (_) {}
});
}

// Redraw chart on resize
let __resizeTimer = null;
window.addEventListener('resize', () => {
  if (!window.__historyItems) return;
  clearTimeout(__resizeTimer);
  __resizeTimer = setTimeout(() => renderHistory(window.__historyItems), 120);
});

// Footer nav
function setupFooterButtons() {
  console.log('Setting up footer buttons...');
  const btnDisclaimer = document.getElementById('btnDisclaimer'); 
  if (btnDisclaimer) {
    console.log('Disclaimer button found');
    btnDisclaimer.addEventListener('click', () => { window.location.href='/disclaimer'; });
  } else {
    console.log('Disclaimer button NOT found');
  }

  const btnTerms = document.getElementById('btnTerms'); 
  if (btnTerms) {
    console.log('Terms button found');
    btnTerms.addEventListener('click', () => { window.location.href='/terms'; });
  } else {
    console.log('Terms button NOT found');
  }

  const btnPrivacy = document.getElementById('btnPrivacy'); 
  if (btnPrivacy) {
    console.log('Privacy button found');
    btnPrivacy.addEventListener('click', () => { window.location.href='/privacy'; });
  } else {
    console.log('Privacy button NOT found');
  }
}

// Setup footer buttons when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupFooterButtons);
} else {
  setupFooterButtons();
}

// ======== Filtered Lookup (Updated) ========

// Global-safe shim so "View" always works
if (typeof window.gotoSelection !== 'function') {
  window.gotoSelection = async function(y, make, model){
    try{
      console.log('gotoSelection called with:', y, make, model);
      
      // Ensure DOM elements exist
      if (!yearSel || !makeSel || !modelSel) {
        console.error('Required DOM elements not found');
        return;
      }
      
      // Set Year & load makes
      if (yearSel.value !== String(y)){
        console.log('Setting year to:', y);
        yearSel.value = String(y);
        makeSel.disabled = true; 
        modelSel.disabled = true; 
        if (btn) btn.disabled = true;
        makeSel.innerHTML = '<option value="">Select...</option>';
        modelSel.innerHTML = '<option value="">Select...</option>';
        
        const respMks = await getJSON(`/api/makes?year=${y}`);
        const makes = Array.isArray(respMks) ? respMks : (respMks.makes || []);
        console.log('Loaded makes:', makes.length);
        makeSel.insertAdjacentHTML('beforeend', makes.map(m=>`<option value="${m}">${m}</option>`).join(''));
        makeSel.disabled = false;
      }
      
      // Wait a bit for makes to load
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Set Make & load models
      if (makeSel.value !== make){
        console.log('Setting make to:', make);
        makeSel.value = make;
        modelSel.disabled = true; 
        if (btn) btn.disabled = true;
        modelSel.innerHTML = '<option value="">Select...</option>';
        
        const respModels = await getJSON(`/api/models?year=${y}&make=${encodeURIComponent(make)}`);
        const models = Array.isArray(respModels) ? respModels : (respModels.models || []);
        console.log('Loaded models:', models.length);
        modelSel.insertAdjacentHTML('beforeend', models.map(m=>`<option value="${m}">${m}</option>`).join(''));
        modelSel.disabled = false;
      }
      
      // Wait a bit for models to load
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Set Model & run main search
      if (modelSel.value !== model){
        console.log('Setting model to:', model);
        modelSel.value = model;
      }
      
      if (btn) btn.disabled = !(yearSel?.value && makeSel?.value && modelSel?.value);
      if (btn && !btn.disabled) {
        console.log('Clicking button to get results');
        btn.click();
      }
    }catch(e){ 
      console.error('gotoSelection error:', e); 
    }
  }
}

function selectedCheckboxValues(containerEl){
  return Array.from(containerEl?.querySelectorAll('input[type="checkbox"]:checked') || [])
    .map(i => i.value);
}
function renderCheckboxes(containerEl, values){
  if (!containerEl) return;
  containerEl.innerHTML = values.map(v => `
    <label class="chk"><span class="lbl">${v}</span><input type="checkbox" value="${v}"></label>
  `).join('');
}

const flMinYear  = document.getElementById('fl-min-year');
const flMaxYear  = document.getElementById('fl-max-year');
const flMakesBox = document.getElementById('fl-makes-box');
const flModelsBox= document.getElementById('fl-models-box');
const flMinScore = document.getElementById('fl-min-score');
const flMaxScore = document.getElementById('fl-max-score');
const flSearch   = document.getElementById('fl-search');
const flTbody    = document.getElementById('fl-tbody');

async function flLoadYears(){
  if (!flMinYear || !flMaxYear) return;
  try{
    const resp  = await getJSON('/api/years');
    const years = Array.isArray(resp) ? resp : (resp.years || []);
    if (!years.length) return;
    const opts = years.map(y => `<option value="${y}">${y}</option>`).join('');
    flMinYear.innerHTML = opts;
    flMaxYear.innerHTML = opts;
    flMinYear.value = years[0];
    flMaxYear.value = years[years.length - 1];
    await flLoadMakes();
  }catch(e){ console.error('flLoadYears error', e); }
}

async function flLoadMakes(){
  if (!flMakesBox) return;
  renderCheckboxes(flMakesBox, []); renderCheckboxes(flModelsBox, []);
  const minY = Number(flMinYear.value), maxY = Number(flMaxYear.value);
  if (!minY || !maxY) return;
  try{
    const r = await getJSON(`/api/filter/makes?min_year=${minY}&max_year=${maxY}`);
    const makes = r?.makes || [];
    renderCheckboxes(flMakesBox, makes);
    await flLoadModels();
  }catch(e){ console.error('flLoadMakes error', e); }
}

async function flLoadModels(){
  if (!flModelsBox) return;
  renderCheckboxes(flModelsBox, []);
  const minY = Number(flMinYear.value), maxY = Number(flMaxYear.value);
  const makes = selectedCheckboxValues(flMakesBox);
  if (!minY || !maxY) return;
  try{
    const qs = new URLSearchParams({ min_year:String(minY), max_year:String(maxY), makes:makes.join(',') });
    const r = await getJSON(`/api/filter/models?${qs.toString()}`);
    const models = r?.models || [];
    renderCheckboxes(flModelsBox, models);
  }catch(e){ console.error('flLoadModels error', e); }
}

async function flSearchNow(){
  if (!flTbody) return;
  const minY = Number(flMinYear.value), maxY = Number(flMaxYear.value);
  const makes  = selectedCheckboxValues(flMakesBox);
  const models = selectedCheckboxValues(flModelsBox);

  const qs = new URLSearchParams({
    min_year: String(minY),
    max_year: String(maxY),
    makes: makes.join(','),
    models: models.join(','),
    min_score: (flMinScore && flMinScore.value ? String(flMinScore.value) : ''),
    max_score: (flMaxScore && flMaxScore.value ? String(flMaxScore.value) : ''),
    limit: '100'
  });

  flTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;opacity:.7;">Searching…</td></tr>`;

  try{
    const r = await getJSON(`/api/filter/search?${qs.toString()}`);
    let rows = r?.rows || [];

    // Dedupe: unique Year/Make/Model (avoid trim/series dupes)
    const seen = new Set();
    rows = rows.filter(row => {
      const key = `${row.year}::${row.make}::${row.model}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by Year (desc), then Make, then Model
    rows.sort((a,b) => (b.year - a.year) || a.make.localeCompare(b.make) || a.model.localeCompare(b.model));

    if (!rows.length){
      flTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;opacity:.7;">No results</td></tr>`;
      return;
    }

    flTbody.innerHTML = rows.map(row => {
      const score = (row.score == null || Number(row.score) === 0) ? '—' : Number(row.score).toFixed(1);
      return `
        <tr>
          <td>${row.year}</td>
          <td>${row.make}</td>
          <td>${row.model}</td>
          <td>${score}</td>
          <td><a href="#" class="mini-view-link" data-y="${row.year}" data-make="${encodeURIComponent(row.make)}" data-model="${encodeURIComponent(row.model)}">View</a></td>
        </tr>`;
    }).join('');

    flTbody.querySelectorAll('a.mini-view-link').forEach(a => {
      a.addEventListener('click', async (ev) => {
        ev.preventDefault();
        const y     = a.getAttribute('data-y');
        const make  = decodeURIComponent(a.getAttribute('data-make'));
        const model = decodeURIComponent(a.getAttribute('data-model'));
        
        // Navigate to grading page with URL parameters
        const params = new URLSearchParams({
          year: y,
          make: make,
          model: model
        });
        window.location.href = `/grade?${params.toString()}`;
      });
    });

  }catch(e){
    console.error('flSearchNow error', e);
    flTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#c66;">Error loading results</td></tr>`;
  }
}

// Wire up lookup events if present
if (flMinYear && flMaxYear){
  flMinYear.addEventListener('change', async () => {
    if (Number(flMinYear.value) > Number(flMaxYear.value)) flMaxYear.value = flMinYear.value;
    await flLoadMakes();
  });
  flMaxYear.addEventListener('change', async () => {
    if (Number(flMaxYear.value) < Number(flMinYear.value)) flMinYear.value = flMaxYear.value;
    await flLoadMakes();
  });
  flMakesBox?.addEventListener('change', flLoadModels);
  flSearch?.addEventListener('click', flSearchNow);
  document.addEventListener('DOMContentLoaded', flLoadYears);
}
// ======== End Filtered Lookup ========
