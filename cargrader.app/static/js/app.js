
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
// --- History chart responsive sizing (16:9) ---
function getCanvasCssSize(canvas){
  // Walk up until we find an ancestor with usable width (accordion may be 0 when closed)
  let node = canvas.parentElement;
  let w = 0;
  while (node && w < 320){
    const cs = getComputedStyle(node);
    const padH = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    w = Math.round(node.clientWidth - padH);
    node = node.parentElement;
  }
  if (w < 320) {
    // Fallback to viewport width minus a little margin
    w = Math.max(320, Math.round(document.documentElement.clientWidth - 48));
  }
  const h = Math.round(w * 9 / 16); // 16:9
  return { w, h };
}

function setupHiDPICanvas(canvas, cssW, cssH){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.style.width  = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS-pixel coords
  return ctx;
}

function renderHistory(items){
  const cv = document.getElementById('historyChart');
  if (!cv) return;

  // If hidden (accordion closed), wait a tick and try again
  if (cv.offsetParent === null) {
    requestAnimationFrame(() => renderHistory(items));
    return;
  }

  const { w, h } = getCanvasCssSize(cv);
  if (w < 320) {                      // still suspiciously small? try again shortly
    setTimeout(() => renderHistory(items), 60);
    return;
  }

  const ctx = setupHiDPICanvas(cv, w, h);
  drawHistoryChart(ctx, items, w, h);
}

// === Score "slot machine" animation ===
function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

function animateSlotNumber(el, finalValue, opts = {}){
  if (!el) return;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = prefersReduced ? 0 : (opts.duration ?? 800);
  const scramblePortion = 0.6; // first 60% shows “spinning” randoms
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const end = clamp(Math.round(finalValue ?? 0), 0, 100);
  if (duration <= 0){ el.textContent = String(end); return; }

  const startTime = performance.now();
  let raf;

  function frame(now){
    const t = clamp((now - startTime) / duration, 0, 1);
    if (t < scramblePortion){
      // spin random numbers early on
      const rand = Math.floor(Math.random() * 101);
      el.textContent = String(rand).padStart(2, '0');
    }else{
      // ease into the final value
      const p = (t - scramblePortion) / (1 - scramblePortion);
      const eased = easeOutCubic(p);
      const cur = Math.round(end * eased);
      el.textContent = String(cur).padStart(2, '0');
    }
    if (t < 1){ raf = requestAnimationFrame(frame); }
    else { el.textContent = String(end).padStart(2, '0'); }
  }

  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
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

    if (open && window.__historyItems && box.querySelector('#historyChart')) {
      setTimeout(() => renderHistory(window.__historyItems), 0);
    }
  });
});

// === Draw a square history chart with axes + legend ===
function drawHistoryChart(ctx, items, cssW, cssH){
  const C = ctx.canvas;
  const W = cssW;
  const H = cssH;

  // Colors from CSS variables (fallbacks provided)
  const css = getComputedStyle(document.documentElement);
  const PURPLE = (css.getPropertyValue('--primary-600') || '#522e93').trim();
  const YELLOW = (css.getPropertyValue('--accent') || '#efc362').trim();
  const GRID   = (css.getPropertyValue('--border') || '#2a2046').trim();
  const TEXT   = (css.getPropertyValue('--text') || '#f5f8ff').trim();

  // Padding and geometry
  const padL = 70, padR = 20, padT = 40, padB = 70; // room for labels & legend
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const years    = items.map(d => d.year ?? d.x ?? '');
  const actual   = items.map(d => Number(d.actual ?? d.count ?? 0));
  const expected = items.map(d => Number(d.expected ?? d.exp ?? 0));

  const maxY = Math.max(1, ...actual, ...expected);
  const { tickMax, step, ticks } = niceTicks(maxY, 5); // 5 y ticks

  // Clear
  ctx.clearRect(0,0,W,H);
  ctx.font = '12px Open Sans, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT;

  // Axes
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;

  // Y grid + labels
  ticks.forEach(t => {
    const y = padT + plotH * (1 - t/tickMax);
    // grid line
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();

    // label
    ctx.textAlign = 'right';
    ctx.fillText(String(t), padL - 10, y);
  });

  // X axis line
  ctx.beginPath();
  ctx.moveTo(padL, padT + plotH + 0.5);
  ctx.lineTo(W - padR, padT + plotH + 0.5);
  ctx.stroke();

  // X labels (years)
  const n = years.length || 1;
  const xFor = (i) => padL + (plotW * (i/(Math.max(1, n-1))));
  years.forEach((yr, i) => {
    const x = xFor(i);
    ctx.textAlign = 'center';
    ctx.fillText(String(yr), x, H - padB/2);
  });

  // Plot helper
  const yFor = (v) => padT + plotH * (1 - (v / tickMax));

  // Lines: actual (purple)
  ctx.lineWidth = 3;
  ctx.strokeStyle = PURPLE;
  ctx.beginPath();
  actual.forEach((v,i) => {
    const x = xFor(i), y = yFor(v);
    if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
  // points
  ctx.fillStyle = PURPLE;
  actual.forEach((v,i) => {
    const x = xFor(i), y = yFor(v);
    ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
  });

  // Lines: expected (yellow)
  ctx.strokeStyle = YELLOW;
  ctx.beginPath();
  expected.forEach((v,i) => {
    const x = xFor(i), y = yFor(v);
    if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
  // points
  ctx.fillStyle = YELLOW;
  expected.forEach((v,i) => {
    const x = xFor(i), y = yFor(v);
    ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
  });

// Legend (top-right, stacked)
  const legendPadR = 24;                    // a little extra right padding
  const legendX = W - legendPadR - 200;     // 200px allows long labels
  const legendY = padT - 8;                 // just above the plot area
  const lineH   = 20;
  
  // (Optional) ensure we have enough right padding for the legend
  // If you prefer, bump padR globally near the top instead of doing this check
  
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '13px Open Sans, system-ui, sans-serif';
  ctx.fillStyle = TEXT;
  
  // --- Actual ---
  ctx.strokeStyle = PURPLE;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(legendX, legendY);
  ctx.lineTo(legendX + 22, legendY);
  ctx.stroke();
  ctx.fillText('Actual Complaints Count', legendX + 30, legendY);
  
  // --- Expected ---
  const y2 = legendY + lineH;
  ctx.strokeStyle = YELLOW;
  ctx.beginPath();
  ctx.moveTo(legendX, y2);
  ctx.lineTo(legendX + 22, y2);
  ctx.stroke();
  ctx.fillText('Expected Complaints Count', legendX + 30, y2);

}

// Headroom-aware tick builder: ~15% padding above max, avoids big jumps (e.g., 200 -> 500)
function niceTicks(maxValue, desired=5){
  if (!isFinite(maxValue) || maxValue <= 0){
    return { tickMax: 10, step: 2, ticks: [0,2,4,6,8,10] };
  }

  const HEADROOM = 1.15;                         // tweak if you want more/less padding
  const rawTop   = maxValue * HEADROOM;

  // Choose a "nice" ceiling close to rawTop
  const base = Math.pow(10, Math.floor(Math.log10(rawTop)));
  const tops = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(m => m * base);
  let tickMax = tops.find(v => v >= rawTop);
  if (!tickMax) tickMax = 10 * base;             // fallback

  // Choose a "nice" step size close to tickMax / desired
  const idealStep   = tickMax / desired;
  const stepBase    = Math.pow(10, Math.floor(Math.log10(idealStep)));
  const stepChoices = [1, 1.2, 1.5, 2, 2.5, 5, 10].map(m => m * stepBase);
  let step = stepChoices.find(v => v >= idealStep) || 10 * stepBase;

  // Build integer tick labels from 0 up to tickMax
  const ticks = [];
  for (let t = 0; t <= tickMax + 1e-9; t += step){
    ticks.push(Math.round(t));
  }

  return { tickMax, step, ticks };
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

    const scoreBlock = document.getElementById('scoreBlock');   // wrapper div for score UI
    const noDataMsg  = document.getElementById('noDataMsg');    // new message element
    
    if (score === 0 || score == null) {
      // Hide the normal score UI
      if (scoreBlock) scoreBlock.style.display = 'none';
      // Show the yellow message
      if (noDataMsg) {
        noDataMsg.style.display = 'block';
        noDataMsg.textContent = "We don't have enough information yet!";
      }
    } else {
      // Show the normal score UI
      if (scoreBlock) scoreBlock.style.display = 'block';
      if (noDataMsg) noDataMsg.style.display = 'none';

      // Animate score
      if (scoreValueEl) {
        animateSlotNumber(scoreValueEl, Math.round(score), { duration: 800 });
      }

      // Certainty %
      if (certaintyPctEl) {
        const pct = (certainty != null)
          ? (Number(certainty) <= 1 ? Number(certainty) * 100 : Number(certainty))
          : null;
        certaintyPctEl.textContent = (pct != null && !Number.isNaN(pct))
          ? `${Math.round(pct)}%`
          : '—';
      }
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

  // Pull fields (support either camelCase or snake_case)
  const modelYear = d.ModelYear ?? d.year ?? y;
  const makeName  = d.Make      ?? d.make ?? make;
  const modelName = d.Model     ?? d.model ?? model;
  const count     = d.ComplaintCount ?? d.complaint_count ?? d.Count ?? null;
  const rel       = d.RelRatio  ?? d.rel_ratio ?? null;

  // Line 1
  const countText = (count != null) ? Number(count).toLocaleString() : '—';
  const line1 = `The ${modelYear} ${makeName} ${modelName} has received ${countText} complaints`;

  // Line 2
  let line2 = '';
  if (rel != null && Number(rel) > 0) {
    const r = Number(rel);
    // Treat ratios within ±5% of 1.0 as "typical"
    if (r >= 0.95 && r <= 1.05) {
      line2 = `According to our data this is very typical for this car's age and sales volume`;
    } else if (r < 1) {
      const x = (1 / r).toFixed(1);
      line2 = `According to our data that is ${x} times more than what is expected for this car's age and sales volume`;
    } else { // r > 1
      const x = r.toFixed(1);
      line2 = `According to our data that is ${x} times less than what is expected for this car's age and sales volume`;
    }
  } else {
    line2 = `According to our data we don't have enough information to compare this car to what is expected for its age and sales volume`;
  }

  // Write both lines into the Details panel
  const detailsEl = document.getElementById('detailsText') || document.getElementById('detailsPanel');
  if (detailsEl) {
    detailsEl.innerHTML = `
      <p>${line1}</p>
      <p>${line2}</p>
    `;
  }

  } catch (e) {
    // details is optional for the main score UI; do not block other loads
  }

// Top complaints (use percent + summary from API)
  try {
    const top = await getJSON(`/api/top-complaints?year=${y}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    const items = (top.items || []).slice(0, 8);
  
    const html = items.map(it => {
      const comp = it.component || 'Unknown';
      const pct  = (typeof it.percent === 'number')
        ? `${it.percent.toFixed(1)}%`
        : (it.percent != null ? `${Number(it.percent).toFixed(1)}%` : '—');
      const sum  = it.summary ? `<div class="top-summary">${it.summary}</div>` : '';
      return `<li><strong>${comp}</strong> — ${pct}${sum}</li>`;
    }).join('');
  
    const topList = document.getElementById('topList');
    if (topList) topList.innerHTML = html || '<li>No data.</li>';
  } catch (e) {
    const topList = document.getElementById('topList');
    if (topList) topList.innerHTML = '<li>No data.</li>';
  }

// Trims (render as table: Trim/Series | Count | %)
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
  
      return `
        <tr>
          <td>${name}</td>
          <td class="num">${count}</td>
          <td class="num">${pct}</td>
        </tr>
      `;
    }).join('');
  
    tbody.innerHTML = rows || `
      <tr><td colspan="3" style="text-align:center;color:var(--muted)">No data.</td></tr>
    `;
  } catch (e) {
    const tbody = document.getElementById('trimsTbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--muted)">No data.</td></tr>`;
    }
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
    renderHistory(items);  // uses 16:9 aspect ratio + Hi-DPI
    window.__historyItems = items; // optional: save for redraw on resize
  } catch (e) { /* no-op */ }
});

// --- Redraw history chart when the window is resized ---
let __resizeTimer = null;
window.addEventListener('resize', () => {
  if (!window.__historyItems) return;
  clearTimeout(__resizeTimer);
  __resizeTimer = setTimeout(() => renderHistory(window.__historyItems), 120);
});
// Footer Disclaimer button → navigates to /disclaimer
const btnDisclaimer = document.getElementById('btnDisclaimer');
if (btnDisclaimer) {
  btnDisclaimer.addEventListener('click', () => {
    window.location.href = '/disclaimer';
  });
}

