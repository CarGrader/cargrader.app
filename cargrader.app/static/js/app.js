// ========== CarGrader app.js (focused results + accordion) ==========

// ---- helpers ----
function pickNumber(obj, keys, fallback = null){
  for (const k of keys){
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)){
      const v = Number(obj[k]);
      if (!Number.isNaN(v)) return v;
    }
  }
  return fallback;
}

async function tryFetchJsonSequential(urls){
  for (const u of urls){
    try{
      const r = await fetch(u);
      if (r.ok) return await r.json();
    }catch(_){} // ignore and try next
  }
  return null;
}

function fmtPct(n){
  if (n == null) return '—';
  const pct = (n <= 1 ? (n*100) : n);
  return `${Math.round(pct)}%`;
}

// ---- dom refs ----
const yearSel  = document.getElementById('year');
const makeSel  = document.getElementById('make');
const modelSel = document.getElementById('model');
const checkBtn = document.getElementById('checkBtn');

const resultsSection = document.getElementById('resultsSection');
const resultTitle    = document.getElementById('resultTitle');
const scoreValueEl   = document.getElementById('scoreValue');
const certaintyPctEl = document.getElementById('certaintyPct');
const certaintyBtn   = document.getElementById('certaintyToggle');
const certaintyBlurb = document.getElementById('certaintyBlurb');

let blurbsCache = null;
async function loadBlurbs(){
  if (blurbsCache) return blurbsCache;
  const r = await fetch('/static/blurbs.json');
  if (r.ok){
    blurbsCache = await r.json();
    return blurbsCache;
  }
  return {};
}

// ---- get results ----
checkBtn?.addEventListener('click', async () => {
  const year  = yearSel?.value;
  const make  = makeSel?.value;
  const model = modelSel?.value;
  if (!year || !make || !model) return;

  checkBtn.disabled = true;

  const qs = `year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
  const urls = [
    `/api/details?${qs}`,  // old known-good
    `/api/score?${qs}`,    // alt route
    `/api/grade?${qs}`,    // alt route
  ];

  const data = await tryFetchJsonSequential(urls);
  checkBtn.disabled = false;
  if (!data) return;

  const score = pickNumber(
    data,
    ['score','Score','sigscore','y_value','grade_numeric'],
    null
  );
  const certainty = pickNumber(
    data,
    ['certainty','certainty_pct','certainty_percent','certaintyFactor','certainty_factor'],
    null
  );

  resultTitle.textContent = `${year} ${make} ${model}`;
  scoreValueEl.textContent = (score != null) ? Number(score).toFixed(0) : '00';
  certaintyPctEl.textContent = fmtPct(certainty);

  if (resultsSection) resultsSection.hidden = false;

  if (certaintyBtn){
    certaintyBtn.onclick = async () => {
      const blurbs = await loadBlurbs();
      const text = blurbs?.certainty || blurbs?.CERTAINTY || 'Info coming soon.';
      if (certaintyBlurb.hidden){
        certaintyBlurb.textContent = text;
        certaintyBlurb.hidden = false;
      }else{
        certaintyBlurb.hidden = true;
      }
    };
  }
});

// ---- accordion for details/top complaints/trims/history ----
document.querySelectorAll('.box__header').forEach(header => {
  header.addEventListener('click', () => {
    const box = header.closest('.box');
    const toggle = header.querySelector('.box__toggle');
    const willOpen = !box.classList.contains('open');
    box.classList.toggle('open', willOpen);
    if (toggle) toggle.textContent = willOpen ? '−' : '+';
  });
});
