<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>CarGrader</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!-- simpler: serve favicon from /static -->
  <link rel="icon" href="{{ url_for('static', filename='favicon.ico') }}">
  <link rel="stylesheet" href="{{ url_for('static', filename='style.css') }}">
  <style>
    :root{
      --bg:#f5f7fb; --panel:#fff; --text:#0f172a; --muted:#64748b;
      --primary:#2563eb; --primary-600:#1d4ed8; --ring:rgba(37,99,235,.25); --border:#e5e7eb;
    }
    *{box-sizing:border-box} html,body{height:100%}
    body{
      margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--text);
      background:radial-gradient(1000px 600px at 10% -10%, #eaf0ff 0%, transparent 60%),
                 radial-gradient(900px 500px at 110% 10%, #e8f6ff 0%, transparent 60%), var(--bg);
      display:grid;place-items:center;padding:24px
    }
    .shell{
      width:100%;max-width:840px;background:var(--panel);border:1px solid var(--border);
      border-radius:20px;padding:28px;box-shadow:0 10px 35px rgba(2,6,23,.08);text-align:center
    }
    h1{margin:0 0 8px;font-size:40px;letter-spacing:.2px}
    .sub{margin:0 0 24px;color:var(--muted);font-size:18px;font-weight:600}
    .row{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
    .field{min-width:160px;text-align:left}
    label{display:block;font-weight:600;margin:0 0 6px}
    select{
      width:100%;padding:10px 12px;font-size:16px;border-radius:12px;border:1px solid var(--border);background:#fff;outline:none
    }
    select:focus{box-shadow:0 0 0 6px var(--ring);border-color:var(--primary)}
    button{
      padding:12px 18px;font-size:16px;border-radius:12px;border:1px solid var(--primary);
      background:var(--primary);color:#fff;font-weight:600;cursor:pointer;transition:transform .02s, background .2s
    }
    .of100 {
      margin-left: 10px;
      font-size: 18px;
      color: var(--muted);
      font-weight: 600;
    }
    .score-value { display:flex; align-items: baseline; justify-content:center; gap:12px; }
    .reels { display:inline-flex; gap:.06em; transform: translateZ(0); }
    .reel { position:relative; overflow:hidden; height:1em; width:.65em; }
    .reel .digits { position:absolute; top:0; left:0; will-change: transform; }
    .reel .digit { height:1em; line-height:1em;
    }
    button:hover{background:var(--primary-600)} button:active{transform:translateY(1px)}
    button:disabled{opacity:.5;cursor:not-allowed}
    .result{margin-top:24px;display:none;border-top:1px solid var(--border);padding-top:20px}
    .score-wrap{margin-top:8px}
    .score-value{font-size:72px;font-weight:900;line-height:1;letter-spacing:.5px}
    .score-footnote{margin-top:8px;color:var(--muted);font-size:14px}
    .muted{color:var(--muted);font-size:13px;margin-top:12px}
    .error{color:#b91c1c;background:#fee2e2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px;margin:10px auto;max-width:560px;display:none
    }
    .details-wrap { margin-top: 12px; }
    .details-wrap button { margin-right: 8px; }
    .details-panel {
      margin-top: 10px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
      line-height: 1.5;}
    .details-panel p { margin: 0 0 8px; }
    .details-panel {
        text-align: left;
      }

  
        .top-complaints { text-align: left; }
        .tc-item { margin: 10px 0 16px; }
        .tc-title { font-size: 18px; font-weight: 700; }
        .tc-percent { font-size: 16px; opacity: .85; margin-left: 8px; }
        .tc-summary { font-size: 14px; opacity: .9; margin-top: 6px; white-space: pre-wrap; }
        </style>
</head>
<body>
  {% from "macros/info_blurb.html" import info_blurb with context %}
  <main class="shell">
    <h1>CarGrader</h1>
    <p class="sub">Is it <em>Great</em> or is it <em>Garbage</em>?</p>

    <div id="err" class="error"></div>

    <div class="row">
      <div class="field">
        <label for="year">Year</label>
        <select id="year"><option value="">Select...</option></select>
      </div>
      <div class="field">
        <label for="make">Make</label>
        <select id="make" disabled><option value="">Select...</option></select>
      </div>
      <div class="field">
        <label for="model">Model</label>
        <select id="model" disabled><option value="">Select...</option></select>
      </div>
      <div class="field" style="align-self:flex-end;">
        <button id="checkBtn" type="button" disabled>Get Results</button>
      </div>
    </div>

    <section id="result" class="result">
        <h2 id="title" style="margin:0 0 8px; font-size:22px;"></h2>
        <div class="score-wrap">
          <div class="score-value">
            <span id="scoreVal">—</span>
            <span class="of100">Out Of 100</span>
          </div>
          <div class="score-footnote">
            {{ info_blurb('certainty', 'Certainty') }}: <span id="certVal">—</span>
          </div>
        </div>
        <div class="details-wrap">
    <button id="detailsBtn" type="button" disabled>Details</button>
    <div id="detailsPanel" class="details-panel" hidden></div>
    <button id="topComplaintsBtn" type="button" disabled>Top Complaints</button>
    <div id="topComplaintsPanel" class="details-panel top-complaints" hidden></div>
    <button id="trimsBtn" type="button" disabled>Trims</button>
    <div id="trimsPanel" class="details-panel trims" hidden></div>
  </div>

      </section>
  </main>

  <script>
    // -------- utilities --------
    const $    = (sel) => document.querySelector(sel);
    const yearSel  = $('#year');
    const makeSel  = $('#make');
    const modelSel = $('#model');
    const btn      = $('#checkBtn');
    const resultEl = $('#result');
    const titleEl  = $('#title');
    const scoreEl  = $('#scoreVal');
    const certEl   = $('#certVal');
    const errEl    = $('#err');
    const detailsBtn   = $('#detailsBtn');
    const detailsPanel = $('#detailsPanel');
    const topBtn      = $('#topComplaintsBtn');
    const trimsBtn    = $('#trimsBtn');
    const trimsPanel  = $('#trimsPanel');
    const topPanel    = $('#topComplaintsPanel');
    const nf0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
    const nf1 = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });


    async function fetchDetails(year, make, model){
    const qs = new URLSearchParams({ year, make, model }).toString();
    return fetchJSON(`/api/details?${qs}`);
    }

    function showError(msg){ errEl.textContent = msg; errEl.style.display = 'block'; }
    function clearError(){ errEl.textContent = ''; errEl.style.display = 'none'; }

    function setOptions(selectEl, list){
      selectEl.innerHTML = '<option value="">Select...</option>' +
        list.map(v => `<option value="${v}">${v}</option>`).join('');
    }
    function resetSelect(selectEl){
      selectEl.innerHTML = '<option value="">Select...</option>';
    }
    function updateButtonState(){
      btn.disabled = !(yearSel.value && makeSel.value && modelSel.value);
    }
    async function fetchJSON(url){
      const res = await fetch(url, { headers:{'Accept':'application/json'}, cache:'no-store' });
      if(!res.ok){ throw new Error(`HTTP ${res.status}: ${await res.text()}`); }
      return res.json();
    }

    // -------- loaders --------
    async function loadYears(){
      try{
        const data = await fetchJSON('/api/years');
        if(!data || !Array.isArray(data.years)) throw new Error('Bad payload: expected {years:[...]}');
        setOptions(yearSel, data.years);
        clearError();
      }catch(e){
        console.error('loadYears failed', e);
        showError('Failed to load years.');
      }
    }

    async function loadMakes(year){
      const data = await fetchJSON(`/api/makes?year=${encodeURIComponent(year)}`);
      const makes = Array.isArray(data.makes) ? data.makes : [];
      setOptions(makeSel, makes);
      makeSel.disabled = makes.length === 0;
    }

    async function loadModels(year, make){
      const data = await fetchJSON(`/api/models?year=${encodeURIComponent(year)}&make=${encodeURIComponent(make)}`);
      const models = Array.isArray(data.models) ? data.models : [];
      setOptions(modelSel, models);
      modelSel.disabled = models.length === 0;
    }

    async function fetchScore(year, make, model){
      const qs = new URLSearchParams({year, make, model}).toString();
      return fetchJSON(`/api/score?${qs}`);
    }
function percentify(val){
  if (val == null || isNaN(Number(val))) return '—';
  const num = Number(val);
  const pct = num <= 1 ? num * 100 : num;   // supports 0–1 or 0–100
  return `${Math.round(pct)}%`;
}

function animateScoreReels(containerEl, value){
  const n = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const s = String(n);
  const reelsWrap = document.createElement('span');
  reelsWrap.className = 'reels';

  s.split('').forEach((ch, idx) => {
    const target = parseInt(ch, 10);
    const reel = document.createElement('span');
    reel.className = 'reel';
    const digits = document.createElement('div');
    digits.className = 'digits';

    const cycles = 2 + (s.length - idx);   // more spins for rightmost digit
    for (let c = 0; c < cycles; c++) {
      for (let d = 0; d < 10; d++) {
        const row = document.createElement('div');
        row.className = 'digit';
        row.textContent = d;
        digits.appendChild(row);
      }
    }
    const final = document.createElement('div');
    final.className = 'digit';
    final.textContent = target;
    digits.appendChild(final);

    reel.appendChild(digits);
    reelsWrap.appendChild(reel);

    requestAnimationFrame(() => {
      const dh = reel.querySelector('.digit').getBoundingClientRect().height || containerEl.getBoundingClientRect().height;
      const steps = cycles * 10;
      const distance = -dh * steps;
      const base = 900, extra = idx * 120;
      digits.style.transition = `transform ${base + extra}ms cubic-bezier(.22,1,.36,1)`;
      digits.style.transform = `translateY(${distance}px)`;
    });
  });

  containerEl.innerHTML = '';
  containerEl.appendChild(reelsWrap);
}

    // -------- events --------
    document.addEventListener('DOMContentLoaded', async () => {
      await loadYears();

      // year -> makes
      yearSel.addEventListener('change', async () => {
        resetSelect(makeSel); resetSelect(modelSel);
        makeSel.disabled = true; modelSel.disabled = true; resultEl.style.display = 'none';
        updateButtonState();

        const y = yearSel.value;
        if(!y){ return; }
        try{
          await loadMakes(y);
        }catch(e){
          console.error('loadMakes failed', e);
          showError('Failed to load makes.');
        }
      });

      // make -> models
      makeSel.addEventListener('change', async () => {
        resetSelect(modelSel);
        modelSel.disabled = true; resultEl.style.display = 'none';
        updateButtonState();

        const y = yearSel.value, m = makeSel.value;
        if(!y || !m){ return; }
        try{
          await loadModels(y, m);
        }catch(e){
          console.error('loadModels failed', e);
          showError('Failed to load models.');
        }
      });

      // model -> enable button
      modelSel.addEventListener('change', () => {
        resultEl.style.display = 'none';
        updateButtonState();
      });

      // Get Results
      btn.addEventListener('click', async () => {
        updateButtonState();
        if(btn.disabled) return;

        const year  = yearSel.value;
        const make  = makeSel.value;
        const model = modelSel.value;

        try{
          clearError();
          btn.disabled = true;

          const data = await fetchScore(year, make, model);

          titleEl.textContent = `${year} ${make} ${model}`;
          animateScoreReels(scoreEl, data?.score);
          certEl.textContent = percentify(data?.certainty);
          resultEl.style.display = 'block';
       // Enable details button and reset panel
          detailsBtn.disabled = false;
          detailsPanel.hidden = true;
          if (topBtn) { topBtn.disabled = false; topPanel.hidden = true; topPanel.innerHTML=''; }
          if (trimsBtn) { trimsBtn.disabled = false; trimsPanel.hidden = true; trimsPanel.innerHTML=''; }
          detailsPanel.innerHTML = '';

        }catch(e){
          console.error('get results failed', e);
          showError('Failed to get results.');
        }finally{
          btn.disabled = false;
        }
      });
      detailsBtn.addEventListener('click', async () => {
        try {
          // If already open, toggle closed
          if (!detailsPanel.hidden && detailsPanel.innerHTML.trim()) {
            detailsPanel.hidden = true;
            return;
          }
      
          clearError();
      
          const year  = yearSel.value;
          const make  = makeSel.value;
          const model = modelSel.value;
          if (!year || !make || !model) return; // guard
      
          detailsBtn.disabled = true;
          const data = await fetchDetails(year, make, model);
      
          if (data.error) {
            showError(data.error);
            return;
          }
      
          const y   = data.y_value;
          const dir = data.direction; // 'more' | 'less' | null
          const complaints = data.complaint_count;
      
          const yText = (y && isFinite(y)) ? nf1.format(y) : '—';
          const cText = (complaints != null) ? nf0.format(complaints) : '—';
      
          const line1 = `The ${data.year} ${data.make} ${data.model} has received ${cText} complaints.`;
          let line2 = `According to our data, we don’t have enough information to compare this to typical expectations.`;
          if (dir === 'less') {
            line2 = `According to our data, that is ${yText} times less than what is typically expected for a vehicle of this age and sales volume.`;
          } else if (dir === 'more') {
            line2 = `According to our data, that is ${yText} times more than what is typically expected for a vehicle of this age and sales volume.`;
          }
      
          detailsPanel.innerHTML = `
            <p>${line1}</p>
            <p>${line2}</p>
          `;
          detailsPanel.hidden = false;
        } catch (e) {
          console.error('details failed', e);
          showError('Failed to load details.');
        } finally {
          detailsBtn.disabled = false;
        }
      });
    });   
  
      // Top Complaints
      // Trims list
      if (trimsBtn) {
        trimsBtn.addEventListener('click', async () => {
          try{
            if (!trimsPanel.hidden && trimsPanel.innerHTML.trim()) { trimsPanel.hidden = true; return; }
            const year  = yearSel.value;
            const make  = makeSel.value;
            const model = modelSel.value;
            if (!year || !make || !model) return;
            trimsBtn.disabled = true;
            trimsPanel.innerHTML = '';
            const qs = new URLSearchParams({year, make, model}).toString();
            const data = await fetchJSON(`/api/trims?${qs}`);
            if (!data?.ok) throw new Error(data?.error || 'Request failed');

            const list = Array.isArray(data.items) ? data.items : [];
            if (!list.length){
              trimsPanel.innerHTML = '<p>No trim data available.</p>';
              trimsPanel.hidden = false;
              return;
            }

            // Build a simple table
            const table = document.createElement('table');
            table.className = 'trims-table';
            const thead = document.createElement('thead');
            thead.innerHTML = '<tr><th>Trim/Series</th><th>Count</th><th>% of total</th></tr>';
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            list.forEach(it => {
              const tr = document.createElement('tr');
              const name = (it.name || '').trim();
              const count = (typeof it.count === 'number') ? it.count : parseInt(it.count||0,10);
              const pct = (typeof it.percentage === 'number') ? it.percentage : parseFloat(it.percentage||0);
              const pctTxt = isFinite(pct) ? (pct.toFixed(2) + '%') : '—';
              tr.innerHTML = `<td>${name}</td><td>${count.toLocaleString()}</td><td>${pctTxt}</td>`;
              tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            trimsPanel.appendChild(table);
            trimsPanel.hidden = false;
          } catch(e){
            console.error('trims failed', e);
            showError('Failed to load trims.');
          } finally {
            trimsBtn.disabled = false;
          }
        });
      }
    
      if (topBtn) {
        topBtn.addEventListener('click', async () => {
          try{
            if (!topPanel.hidden && topPanel.innerHTML.trim()) { topPanel.hidden = true; return; }
            const year  = yearSel.value;
            const make  = makeSel.value;
            const model = modelSel.value;
            if (!year || !make || !model) return;
            topBtn.disabled = true;
            topPanel.innerHTML = '';
            const qs = new URLSearchParams({year, make, model}).toString();
            const data = await fetchJSON(`/api/top-complaints?${qs}`);
            if (!data?.ok) throw new Error(data?.error || 'Request failed');

            const items = Array.isArray(data.items) ? data.items : [];
            if (items.length === 0){
              topPanel.innerHTML = '<p>No complaint summary data available.</p>';
              topPanel.hidden = false;
              return;
            }
            const frag = document.createDocumentFragment();
            items.forEach(it => {
              const wrap = document.createElement('div');
              wrap.className = 'tc-item';
              const title = document.createElement('div');
              title.className = 'tc-title';
              const pct = (typeof it.percent === 'number') ? `${Math.round(it.percent)}%` : '—';
              title.textContent = it.component || '—';
              const pctEl = document.createElement('span');
              pctEl.className = 'tc-percent'; pctEl.textContent = pct;
              title.appendChild(pctEl);
              wrap.appendChild(title);

              if (it.summary){
                const sum = document.createElement('div');
                sum.className = 'tc-summary';
                sum.textContent = it.summary.trim();
                wrap.appendChild(sum);
              }
              frag.appendChild(wrap);
            });
            topPanel.appendChild(frag);
            topPanel.hidden = false;
          } catch(e){
            console.error('top-complaints failed', e);
            showError('Failed to load top complaints.');
          } finally {
            topBtn.disabled = false;
          }
        });
      }
  </script>
</body>
</html>






