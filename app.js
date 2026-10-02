import { API_URL, NOTION_URL } from './config.js';

const DEMO = !API_URL;
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');

// ---------- Session ----------

const SESSION_KEY = 'mp.session';
let session = null;
try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { session = null; }

function saveSession(s) {
  session = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* private mode: stay signed in for this visit only */ }
}

const isStaff = () => session?.me?.role === 'Missions Team';
const firstName = (name) => (name || '').split(' ')[0];

// ---------- API ----------

async function api(action, body = {}) {
  if (DEMO) {
    const { mockApi } = await import('./mock.js');
    return mockApi(action, body, session);
  }
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.token ? { 'x-session': session.token } : {}),
      },
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    throw new Error('No connection. Your entry is still on this screen; try again when you have signal.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && action !== 'login') {
    saveSession(null);
    go('signin');
    throw new Error(data.error || 'Please sign in.');
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

let optionsCache = null;
async function getOptions() {
  if (!optionsCache) optionsCache = await api('options');
  return optionsCache;
}

// ---------- Small helpers ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const toDate = (iso) => new Date(iso.slice(0, 10) + 'T12:00:00');
function addDays(iso, days) {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addMonths(iso, months) {
  const d = toDate(iso);
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const fmt = (iso, opts = { month: 'short', day: 'numeric' }) =>
  (iso ? toDate(iso).toLocaleDateString('en-US', opts) : '');
const fmtLong = (iso) => fmt(iso, { weekday: 'short', month: 'short', day: 'numeric' });
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);

function dueTag(followUpBy, today) {
  if (!followUpBy) return '';
  const d = daysBetween(today, followUpBy);
  if (d < 0) return `<span class="tag warn">${-d}d overdue</span>`;
  if (d === 0) return '<span class="tag warn">Due today</span>';
  if (d === 1) return '<span class="tag">Tomorrow</span>';
  return `<span class="tag">${esc(fmt(followUpBy))}</span>`;
}

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3500);
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const pressed = (root, group) =>
  [...root.querySelectorAll(`[data-group="${group}"] [aria-pressed="true"]`)].map((b) => b.dataset.value);

// Chips and segmented buttons: one handler for the whole app.
app.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-group] > button');
  if (!btn) return;
  const group = btn.parentElement;
  if (group.dataset.multi === 'true') {
    btn.setAttribute('aria-pressed', btn.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
  } else {
    const was = btn.getAttribute('aria-pressed') === 'true';
    group.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    if (!was || group.dataset.required === 'true') btn.setAttribute('aria-pressed', 'true');
  }
  group.dispatchEvent(new CustomEvent('pick', { detail: btn.dataset.value }));
});

// ---------- Router ----------

function go(route, params = {}) {
  const q = new URLSearchParams(params).toString();
  location.hash = `#/${route}${q ? '?' + q : ''}`;
}

function parseHash() {
  const [path, q] = location.hash.replace(/^#\/?/, '').split('?');
  return { route: path || 'home', params: Object.fromEntries(new URLSearchParams(q || '')) };
}

const routes = {
  signin: viewSignIn, home: viewHome, find: viewFind, contact: viewContact,
  disco: (p) => viewMeeting('Disco', p), followup: (p) => viewMeeting('Follow-up', p),
  person: viewPerson,
};

async function render() {
  const { route, params } = parseHash();
  if (!session && route !== 'signin') return go('signin');
  const view = routes[route] || viewHome;
  window.scrollTo(0, 0);
  try {
    await view(params);
  } catch (err) {
    app.innerHTML = `${header('Something went wrong')}<p class="notice">${esc(err.message)}</p>
      <button class="btn secondary" id="retry">Try again</button>`;
    app.querySelector('#retry').onclick = render;
  }
}
window.addEventListener('hashchange', render);

const demoBanner = () => (DEMO ? '<div class="demo">Demo mode: made-up people, nothing is saved</div>' : '');
const header = (title, sub = '') => `
  ${demoBanner()}
  <div class="stack">
    <a class="back" href="#/home">‹ Home</a>
    <h1>${esc(title)}</h1>
    ${sub ? `<p class="small muted">${esc(sub)}</p>` : ''}
  </div>`;
const loading = (title) => { app.innerHTML = `${header(title)}<p class="muted">Loading…</p>`; };

// ---------- Sign in ----------

async function viewSignIn() {
  app.innerHTML = `${demoBanner()}<p class="muted">Loading…</p>`;
  const { team } = await api('team');
  app.innerHTML = `
    ${demoBanner()}
    <div class="stack" style="padding-top:36px">
      <div class="eyebrow">The Well Missions</div>
      <h1 style="font-size:30px">Missions Pipeline</h1>
      <p class="muted">Sign in once. This phone remembers you.</p>
    </div>
    <form id="f" class="stack-lg" style="gap:18px">
      <div class="stack">
        <label for="who">Your name</label>
        <select id="who" required>
          <option value="">Choose your name</option>
          ${team.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('')}
        </select>
      </div>
      <div class="stack">
        <label for="code">Your personal code</label>
        <input id="code" type="text" inputmode="numeric" autocomplete="off" placeholder="6 digits" required
          style="font-size:20px;letter-spacing:0.2em">
        <p class="tiny muted">Each person has their own code, so the app knows whose follow-ups to show.</p>
      </div>
      <p class="notice" id="err" hidden></p>
      <button class="btn" type="submit">Sign in</button>
    </form>`;
  const f = app.querySelector('#f');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button');
    const err = f.querySelector('#err');
    btn.disabled = true; err.hidden = true;
    try {
      const out = await api('login', { teamId: f.querySelector('#who').value, code: f.querySelector('#code').value.trim() });
      saveSession(out);
      optionsCache = null;
      go('home');
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
    } finally { btn.disabled = false; }
  };
}

// ---------- Home ----------

async function viewHome() {
  app.innerHTML = `${demoBanner()}<p class="muted">Loading…</p>`;
  const data = await api('home');
  const due = data.followUps;
  const overdue = due.filter((p) => p.followUpBy < data.today).length;
  app.innerHTML = `
    ${demoBanner()}
    <div class="row">
      <div class="stack" style="gap:2px">
        <div class="eyebrow">The Well Missions</div>
        <h1>Missions Pipeline</h1>
      </div>
      <button class="pill" id="me" aria-label="Signed in as ${esc(data.me.name)}. Sign out">${esc(firstName(data.me.name))}</button>
    </div>

    <div class="stack-lg">
      <a class="action" href="#/find"><div><strong>Find a Person</strong><span>Check if they've had a disco</span></div></a>
      <a class="action" href="#/contact"><div><strong>New Contact</strong><span>Someone you just met</span></div></a>
      <a class="action primary" href="#/disco"><div><strong>New Disco Meeting</strong><span>Log a discovery meeting</span></div></a>
      <a class="action" href="#/followup"><div><strong>Follow-up Meeting</strong><span>Notes, next step, follow-up-by date</span></div></a>
    </div>

    <div class="stack-lg">
      <div class="row" style="align-items:baseline">
        <h2>Your follow-ups</h2>
        <span class="tiny muted">${due.length ? `${overdue} overdue · ${due.length - overdue} coming up` : ''}</span>
      </div>
      ${due.length ? `<div class="card">${due.map((p) => `
        <a class="list-item" href="#/followup?person=${esc(p.id)}">
          <div><b>${esc(p.name)}</b><small>${esc(p.nextStep || 'No next step written')}</small></div>
          ${dueTag(p.followUpBy, data.today)}
        </a>`).join('')}</div>`
      : '<p class="card pad muted small">Nothing due. Follow-up-by dates you set will show here.</p>'}
    </div>

    <div class="stack-lg">
      <h2>${data.stats.scope === 'team' ? 'Team this month' : 'You this month'}</h2>
      <div class="grid-3" style="gap:10px">
        <div class="stat"><b>${data.stats.discos}</b><span>Discos</span></div>
        <div class="stat"><b>${data.stats.followUps}</b><span>Follow-ups</span></div>
        <div class="stat"><b class="${data.stats.overdue ? 'warn-text' : ''}">${data.stats.overdue}</b><span>Overdue</span></div>
      </div>
    </div>

    ${isStaff() ? `<p class="push center small"><a href="${esc(NOTION_URL)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 16px;font-weight:600">Open full pipeline in Notion</a></p>` : ''}`;
  app.querySelector('#me').onclick = () => {
    if (confirm(`Sign out ${data.me.name}?`)) { saveSession(null); optionsCache = null; go('signin'); }
  };
}

// ---------- Find a person ----------

function resultCard(r, today) {
  const disco = r.discoDate
    ? `<b>Disco done</b> · ${esc(fmt(r.discoDate, { month: 'short', day: 'numeric', year: 'numeric' }))}${r.discoBy?.length ? ' with ' + esc(r.discoBy.map(firstName).join(', ')) : ''}`
    : `<b>No disco yet</b> · added ${esc(fmt(r.added))}`;
  const owner = r.owners?.length ? r.owners.map(firstName).join(' & ') : 'No owner';
  const tag = r.mine ? '<span class="tag own">Yours</span>' : `<span class="tag">${esc(owner)}${r.owners?.length ? "'s" : ''}</span>`;
  return `
    <div class="card pad stack ${r.mine ? 'mine' : ''}">
      <div class="row" style="align-items:baseline"><b>${esc(r.name)}</b>${tag}</div>
      <div class="small">${disco}</div>
      ${r.canOpen ? `
        ${r.stage ? `<div class="tiny muted">${esc(r.stage)}${r.readiness ? ' · ' + esc(r.readiness) : ''}${r.followUpBy ? ' · follow up ' + esc(fmt(r.followUpBy)) : ''}</div>` : ''}
        <div class="row" style="justify-content:flex-start;gap:18px">
          <a class="linkbtn" style="display:inline-flex;align-items:center" href="#/person?id=${esc(r.id)}">Open notes</a>
          <a class="linkbtn" style="display:inline-flex;align-items:center" href="#/${r.discoDate ? 'followup' : 'disco'}?person=${esc(r.id)}">Log a meeting</a>
        </div>`
      : `<div class="tiny muted">Notes are visible to the missions team only. Check with ${esc(owner)} before reaching out.</div>`}
    </div>`;
}

async function viewFind(params) {
  app.innerHTML = `
    ${header('Find a Person', 'Check before you schedule a disco.')}
    <div class="stack">
      <label for="q">Name</label>
      <input id="q" type="search" placeholder="Search by name" autocomplete="off" value="${esc(params.q || '')}">
    </div>
    <div id="out" class="stack-lg"></div>
    <div id="add" class="push stack" hidden>
      <p class="small muted center" id="addmsg"></p>
      <a class="btn" id="addbtn" href="#/contact">Add a new contact</a>
    </div>`;
  const q = app.querySelector('#q');
  const out = app.querySelector('#out');
  const add = app.querySelector('#add');
  let seq = 0;
  const run = async () => {
    const term = q.value.trim();
    if (term.length < 2) { out.innerHTML = ''; add.hidden = true; return; }
    const mine = ++seq;
    out.innerHTML = '<p class="muted small">Searching…</p>';
    try {
      const { results } = await api('search', { q: term });
      if (mine !== seq) return;
      out.innerHTML = results.map((r) => resultCard(r)).join('');
      add.hidden = false;
      app.querySelector('#addmsg').textContent = results.length
        ? 'Not the person you mean?'
        : `No one named "${term}" is in the pipeline yet.`;
      app.querySelector('#addbtn').href = `#/contact?name=${encodeURIComponent(term)}`;
    } catch (err) {
      if (mine === seq) out.innerHTML = `<p class="notice">${esc(err.message)}</p>`;
    }
  };
  q.addEventListener('input', debounce(run, 350));
  q.focus();
  if (params.q) run();
}

// ---------- New contact ----------

async function viewContact(params) {
  loading('New Contact');
  const opts = await getOptions();
  app.innerHTML = `
    ${header('New Contact', 'Only the name is required. Add the rest when you know it.')}
    <form id="f" class="stack-lg" style="gap:18px" novalidate>
      <div class="stack">
        <label for="name">Full name</label>
        <input id="name" type="text" placeholder="First and last" autocomplete="off" value="${esc(params.name || '')}" required>
        <div id="dupes"></div>
      </div>
      <div class="grid-2" style="gap:12px">
        <div class="stack"><label for="phone">Phone</label><input id="phone" type="tel" autocomplete="off"></div>
        <div class="stack"><label for="email">Email</label><input id="email" type="email" autocomplete="off"></div>
      </div>
      <div class="stack">
        <div class="label">Gender</div>
        <div class="grid-2" data-group="gender">
          <button type="button" class="seg" data-value="Male" aria-pressed="false">Male</button>
          <button type="button" class="seg" data-value="Female" aria-pressed="false">Female</button>
        </div>
      </div>
      <div class="stack">
        <div class="label">How did we meet?</div>
        <div class="chips" data-group="met">
          ${['Sunday', 'Missions Class', 'Referral', 'Trip', 'Event', 'Other'].map((v) =>
            `<button type="button" class="chip" data-value="${v}" aria-pressed="false">${v}</button>`).join('')}
        </div>
      </div>
      ${opts.canPickOwner ? `
      <div class="stack">
        <label for="owner">Who owns this relationship?</label>
        <select id="owner">
          ${opts.team.map((m) => `<option value="${esc(m.id)}" ${m.id === session.me.id ? 'selected' : ''}>${esc(m.name)}${m.id === session.me.id ? ' (me)' : ''}</option>`).join('')}
        </select>
      </div>` : ''}
      <div class="stack">
        <label for="interests">Interests <span class="optional">(optional)</span></label>
        <input id="interests" type="text" placeholder="Region, people group, kind of work">
      </div>
      <details class="more">
        <summary>More details <span class="optional small" style="margin-left:6px">family, college, ethnic minority</span></summary>
        <div class="stack-lg">
          <div class="stack">
            <label for="marital">Marital status</label>
            <select id="marital"><option value="">Not set</option>${['Single', 'Engaged', 'Married', 'Divorced', 'Widowed'].map((v) => `<option>${v}</option>`).join('')}</select>
          </div>
          <div class="stack">
            <div class="label">Kids?</div>
            <div class="grid-2" data-group="kids">
              <button type="button" class="seg" data-value="No" aria-pressed="false">No</button>
              <button type="button" class="seg" data-value="Yes" aria-pressed="false">Yes</button>
            </div>
          </div>
          <div class="stack"><label for="kidsDetail">Kids' names and ages</label><input id="kidsDetail" type="text"></div>
          <div class="chips" data-group="flags" data-multi="true">
            <button type="button" class="chip" data-value="college" aria-pressed="false">College student</button>
            <button type="button" class="chip" data-value="minority" aria-pressed="false">Ethnic minority</button>
          </div>
        </div>
      </details>
      <p class="notice" id="err" hidden></p>
      <div class="stack-lg">
        <button class="btn" type="submit" data-then="home">Save contact</button>
        <button class="btn secondary" type="submit" data-then="disco">Save and log a disco meeting</button>
      </div>
    </form>`;

  const f = app.querySelector('#f');
  const nameEl = f.querySelector('#name');
  const dupes = f.querySelector('#dupes');
  const checkDupes = debounce(async () => {
    const term = nameEl.value.trim();
    if (term.length < 3) { dupes.innerHTML = ''; return; }
    try {
      const { results } = await api('search', { q: term });
      dupes.innerHTML = results.length
        ? `<p class="notice" style="margin-top:6px">Already in the pipeline: ${results.slice(0, 3).map((r) =>
            `<a href="#/find?q=${encodeURIComponent(r.name)}">${esc(r.name)}</a>`).join(', ')}. Check before adding again.</p>`
        : '';
    } catch { dupes.innerHTML = ''; }
  }, 450);
  nameEl.addEventListener('input', checkDupes);
  if (params.name) checkDupes();

  f.onsubmit = async (e) => {
    e.preventDefault();
    const then = e.submitter?.dataset.then || 'home';
    const err = f.querySelector('#err');
    err.hidden = true;
    if (!nameEl.value.trim()) { err.textContent = 'Add a name.'; err.hidden = false; nameEl.focus(); return; }
    const flags = pressed(f, 'flags');
    const buttons = f.querySelectorAll('button[type=submit]');
    buttons.forEach((b) => { b.disabled = true; });
    try {
      const { person } = await api('addContact', {
        name: nameEl.value.trim(),
        phone: f.querySelector('#phone').value.trim(),
        email: f.querySelector('#email').value.trim(),
        gender: pressed(f, 'gender')[0] || '',
        howWeMet: pressed(f, 'met')[0] || '',
        ownerId: f.querySelector('#owner')?.value || '',
        interests: f.querySelector('#interests').value.trim(),
        marital: f.querySelector('#marital').value,
        kids: pressed(f, 'kids')[0] || '',
        kidsDetail: f.querySelector('#kidsDetail').value.trim(),
        college: flags.includes('college'),
        ethnicMinority: flags.includes('minority'),
      });
      toast(`${person.name} added`);
      if (then === 'disco') go('disco', { person: person.id });
      else go('home');
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
      buttons.forEach((b) => { b.disabled = false; });
    }
  };
}

// ---------- Person picker (shared by both meeting forms) ----------

function mountPicker(root, { onPick }) {
  root.innerHTML = `
    <label for="pq">Who did you meet with?</label>
    <input id="pq" type="search" placeholder="Search people" autocomplete="off">
    <div id="pr"></div>`;
  const input = root.querySelector('#pq');
  const list = root.querySelector('#pr');
  let seq = 0;
  input.addEventListener('input', debounce(async () => {
    const term = input.value.trim();
    if (term.length < 2) { list.innerHTML = ''; return; }
    const mine = ++seq;
    try {
      const { results } = await api('search', { q: term });
      if (mine !== seq) return;
      const usable = results.filter((r) => r.canOpen);
      const blocked = results.length - usable.length;
      list.innerHTML = `
        ${usable.length ? `<div class="results">${usable.map((r) =>
          `<button type="button" data-id="${esc(r.id)}"><b>${esc(r.name)}</b><br><span class="tiny muted">${esc(r.stage || '')}${r.discoDate ? ' · disco ' + esc(fmt(r.discoDate)) : ' · no disco yet'}</span></button>`).join('')}</div>` : ''}
        ${blocked ? `<p class="tiny muted" style="margin-top:6px">${blocked} more match${blocked === 1 ? 'es' : ''} belong${blocked === 1 ? 's' : ''} to someone else. Use Find a Person to see who.</p>` : ''}
        <a class="linkbtn" style="display:inline-flex;align-items:center" href="#/contact?name=${encodeURIComponent(term)}">Not listed? Add "${esc(term)}" as a new contact</a>`;
      list.querySelectorAll('button[data-id]').forEach((b) => {
        b.onclick = () => onPick(usable.find((r) => r.id === b.dataset.id));
      });
    } catch (err) { list.innerHTML = `<p class="notice">${esc(err.message)}</p>`; }
  }, 350));
  input.focus();
}

// ---------- Disco and follow-up forms ----------

async function viewMeeting(type, params) {
  const isDisco = type === 'Disco';
  const title = isDisco ? 'New Disco Meeting' : 'Follow-up Meeting';
  loading(title);
  const opts = await getOptions();
  const today = localToday();
  let person = null;
  if (params.person) {
    const out = await api('person', { id: params.person });
    person = out.person;
  }

  app.innerHTML = `
    ${header(title, isDisco ? 'About two minutes. Short answers are fine.' : '')}
    <form id="f" class="stack-lg" style="gap:18px" novalidate>
      <div class="stack" id="picker"></div>

      ${!isDisco ? `
      <div class="stack" id="doneWrap" hidden>
        <div class="label">Did that next step happen?</div>
        <div class="grid-2" data-group="done">
          <button type="button" class="seg" data-value="Yes" aria-pressed="false">Yes, done</button>
          <button type="button" class="seg" data-value="Not yet" aria-pressed="false">Not yet</button>
        </div>
      </div>` : ''}

      <div class="stack">
        <label for="date">Date</label>
        <input id="date" type="date" value="${today}" max="${today}">
      </div>

      <div class="stack">
        <div class="label">Who from the team was there?</div>
        <div class="chips" data-group="metBy" data-multi="true">
          ${opts.team.map((m) => `<button type="button" class="chip" data-value="${esc(m.id)}" aria-pressed="${m.id === session.me.id}">${esc(firstName(m.name))}</button>`).join('')}
        </div>
      </div>

      ${isDisco ? `
      <div class="stack"><label for="story">Their story</label>
        <textarea id="story" rows="3" placeholder="Who are they, and how did they come to know the Lord?"></textarea></div>
      <div class="stack"><label for="interest">Missions interest</label>
        <textarea id="interest" rows="3" placeholder="Where, who, or what kind of work are they drawn to?"></textarea></div>
      <div class="stack"><label for="prayer">Prayer</label>
        <textarea id="prayer" rows="2" placeholder="What are you praying for them right now?"></textarea></div>
      <div class="stack">
        <div class="label">Readiness</div>
        <div class="grid-3" data-group="readiness" data-required="true">
          <button type="button" class="seg" data-value="🟢" aria-pressed="true">🟢 Green</button>
          <button type="button" class="seg" data-value="🟡" aria-pressed="false">🟡 Yellow</button>
          <button type="button" class="seg" data-value="🔴" aria-pressed="false">🔴 Red</button>
        </div>
        <p class="tiny muted">Green: all good, moving toward ICT. Yellow: a few things first, or slowing. Red: paused.</p>
      </div>
      <div class="stack">
        <div class="label">Good next steps for them <span class="optional">(pick any)</span></div>
        <div class="chips" data-group="steps" data-multi="true">
          ${['Missions Class', 'STT', 'DMC', 'Vision Trip', 'ICT'].map((v) =>
            `<button type="button" class="chip" data-value="${v}" aria-pressed="false">${v}</button>`).join('')}
        </div>
      </div>` : `
      <div class="stack"><label for="notes">Notes</label>
        <textarea id="notes" rows="5" placeholder="What did you talk about? Anything the team should know or pray for?"></textarea></div>
      <div class="stack">
        <label for="stage">Stage <span class="optional">(change only if they moved)</span></label>
        <select id="stage">${opts.stages.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select>
      </div>
      <div class="stack">
        <div class="label">Readiness</div>
        <div class="grid-5" data-group="readiness">
          ${['🟢', '🟡', '\u23F8\uFE0F', '🔴', '✈️'].map((v) => `<button type="button" class="seg" data-value="${v}" aria-pressed="false">${v}</button>`).join('')}
        </div>
        <p class="tiny muted">Leave as is unless something changed. ⏸️ stalled: progress has slowed. ✈️ finished ICT and could go.</p>
      </div>
      ${opts.involvement.length ? `
      <div class="stack">
        <div class="label">Anything new they joined? <span class="optional">(optional)</span></div>
        <div class="chips" data-group="involvement" data-multi="true">
          ${opts.involvement.map((i) => `<button type="button" class="chip" data-value="${esc(i.id)}" aria-pressed="false">${esc(i.name)}</button>`).join('')}
        </div>
      </div>` : ''}`}

      <div class="stack"><label for="next">Next step</label>
        <input id="next" type="text" placeholder="What happens next, and who does it?"></div>

      <div class="stack">
        <div class="label">Follow up by</div>
        <div class="grid-4" data-group="fu">
          <button type="button" class="seg" data-value="7" aria-pressed="false">1 wk</button>
          <button type="button" class="seg" data-value="14" aria-pressed="false">2 wks</button>
          <button type="button" class="seg" data-value="month" aria-pressed="false">1 mo</button>
          <button type="button" class="seg" data-value="pick" aria-pressed="false">Pick</button>
        </div>
        <input id="fuDate" type="date" min="${today}" aria-label="Follow up by date" hidden>
        <p class="small muted" id="fuLabel">No follow-up date set</p>
      </div>

      <p class="notice" id="err" hidden></p>
      <div class="stack">
        <button class="btn" type="submit">${isDisco ? 'Save disco meeting' : 'Save follow-up'}</button>
        <p class="tiny muted center" id="saveNote"></p>
      </div>
    </form>`;

  const f = app.querySelector('#f');
  const picker = f.querySelector('#picker');

  function showPerson() {
    if (!person) {
      mountPicker(picker, {
        onPick: async (r) => {
          picker.innerHTML = '<p class="muted small">Loading…</p>';
          try { person = (await api('person', { id: r.id })).person; } catch (err) { toast(err.message); }
          showPerson();
        },
      });
      return;
    }
    const overdue = person.followUpBy && person.followUpBy < today;
    picker.innerHTML = `
      <div class="label">Who did you meet with?</div>
      <div class="picked stack">
        <div class="row" style="align-items:baseline"><b>${esc(person.name)}</b><span class="tiny">${esc(person.stage || '')}</span></div>
        ${person.lastContact ? `<div class="small">Last met ${esc(fmt(person.lastContact))}</div>` : `<div class="small">${person.discoDate ? '' : 'No disco yet · '}added ${esc(fmt(person.added))}</div>`}
        ${!isDisco && person.nextStep ? `<div class="small"><b>Next step was:</b> ${esc(person.nextStep)}</div>` : ''}
        ${!isDisco && person.followUpBy ? `<div class="tiny ${overdue ? 'warn-text' : 'muted'}">Follow-up ${overdue ? 'was' : 'is'} due ${esc(fmt(person.followUpBy))}${overdue ? ` · ${daysBetween(person.followUpBy, today)} days overdue` : ''}</div>` : ''}
        ${isDisco && person.discoDate ? `<div class="tiny warn-text">Already had a disco on ${esc(fmt(person.discoDate))}. Log a follow-up instead?</div>` : ''}
        <button type="button" class="linkbtn" id="change">Change person</button>
      </div>`;
    picker.querySelector('#change').onclick = () => { person = null; showPerson(); };
    const stage = f.querySelector('#stage');
    if (stage && person.stage) stage.value = person.stage;
    const doneWrap = f.querySelector('#doneWrap');
    if (doneWrap) doneWrap.hidden = !person.nextStep;
    f.querySelector('#saveNote').textContent = isDisco
      ? `Saves to Notion${['New Contact', 'Disco Scheduled', ''].includes(person.stage) ? ` and moves ${firstName(person.name)} to Engaging Discover` : ''}`
      : 'Saves to Notion and updates their follow-up date';
  }
  showPerson();

  // Follow-up-by quick picks
  const fuDate = f.querySelector('#fuDate');
  const fuLabel = f.querySelector('#fuLabel');
  const baseDate = () => f.querySelector('#date').value || today;
  const setFu = (iso) => {
    fuDate.value = iso || '';
    fuLabel.textContent = iso ? fmtLong(iso) : 'No follow-up date set';
  };
  f.querySelector('[data-group="fu"]').addEventListener('pick', (e) => {
    const on = pressed(f, 'fu')[0];
    fuDate.hidden = on !== 'pick';
    if (!on) return setFu('');
    if (on === 'pick') { if (fuDate.value) setFu(fuDate.value); else fuLabel.textContent = 'Choose a date'; return; }
    setFu(e.detail === 'month' ? addMonths(baseDate(), 1) : addDays(baseDate(), Number(e.detail)));
  });
  fuDate.addEventListener('change', () => setFu(fuDate.value));

  f.onsubmit = async (e) => {
    e.preventDefault();
    const err = f.querySelector('#err');
    err.hidden = true;
    const fail = (msg) => { err.textContent = msg; err.hidden = false; err.scrollIntoView({ block: 'center' }); };
    if (!person) return fail('Choose who you met with.');
    const nextStep = f.querySelector('#next').value.trim();
    const val = (id) => f.querySelector('#' + id)?.value.trim() || '';
    if (isDisco && !val('story') && !val('interest') && !val('prayer')) return fail('Add at least a line about the meeting.');
    if (!isDisco && !val('notes')) return fail('Add a note about the meeting.');
    if (fuDate.value && !nextStep) return fail('Add a next step to go with the follow-up date.');

    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await api('addMeeting', {
        type,
        personId: person.id,
        date: f.querySelector('#date').value || today,
        metBy: pressed(f, 'metBy'),
        notes: val('notes'), story: val('story'), interest: val('interest'), prayer: val('prayer'),
        readiness: pressed(f, 'readiness')[0] || '',
        potentialNextSteps: pressed(f, 'steps'),
        involvementIds: pressed(f, 'involvement'),
        lastStepDone: pressed(f, 'done')[0] || '',
        stage: val('stage'),
        nextStep,
        followUpBy: fuDate.value,
      });
      toast(`${isDisco ? 'Disco' : 'Follow-up'} saved for ${firstName(person.name)}`);
      go('home');
    } catch (ex) {
      fail(ex.message);
      btn.disabled = false;
    }
  };
}

// ---------- Person page ----------

async function viewPerson(params) {
  loading('Person');
  const { person: p, meetings, involvement } = await api('person', { id: params.id });
  const today = localToday();
  const line = (label, value) => (value ? `<div class="small"><span class="muted">${label}:</span> ${value}</div>` : '');
  app.innerHTML = `
    ${header(p.name, [p.stage, p.readiness].filter(Boolean).join(' · '))}
    <div class="card pad stack">
      ${line('Owner', esc(p.owners.map(firstName).join(' & ')))}
      ${line('Phone', p.phone ? `<a href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : '')}
      ${line('Email', p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : '')}
      ${line('How we met', esc(p.howWeMet))}
      ${line('Interests', esc(p.interests))}
      ${line('Possible next steps', esc(p.potentialNextSteps.join(', ')))}
      ${line('Prayer', esc(p.prayer))}
    </div>
    <div class="card pad stack">
      <div class="row"><b>Next step</b>${dueTag(p.followUpBy, today)}</div>
      <div class="small">${esc(p.nextStep || 'None written')}</div>
    </div>
    <div class="grid-2">
      <a class="btn secondary" href="#/disco?person=${esc(p.id)}">Log disco</a>
      <a class="btn" href="#/followup?person=${esc(p.id)}">Log follow-up</a>
    </div>
    ${involvement.length ? `
    <div class="stack-lg"><h2>Involvement</h2>
      <div class="card">${involvement.map((i) => `<div class="list-item" style="min-height:52px"><div><b>${esc(i.name)}</b><small>${esc(i.type)}</small></div>${i.date ? `<span class="tag">${esc(fmt(i.date, { month: 'short', year: 'numeric' }))}</span>` : ''}</div>`).join('')}</div>
    </div>` : ''}
    <div class="stack-lg"><h2>Meetings</h2>
      ${meetings.length ? `<div class="card pad">${meetings.map((m) => `
        <div class="meeting stack">
          <div class="row"><b>${esc(m.type)} · ${esc(fmt(m.date, { month: 'short', day: 'numeric', year: 'numeric' }))}</b><span class="tiny muted">${esc(m.metBy.map(firstName).join(', '))}</span></div>
          ${[['', m.notes], ['Story', m.story], ['Missions interest', m.interest], ['Prayer', m.prayer]].filter(([, v]) => v).map(([k, v]) =>
            `<div class="small pre">${k ? `<span class="muted">${k}:</span> ` : ''}${esc(v)}</div>`).join('')}
          ${m.nextStep ? `<div class="tiny muted">Next step: ${esc(m.nextStep)}${m.followUpBy ? ' · by ' + esc(fmt(m.followUpBy)) : ''}</div>` : ''}
        </div>`).join('')}</div>`
      : '<p class="card pad muted small">No meetings logged yet.</p>'}
    </div>
    ${isStaff() && p.notionUrl ? `<p class="center small"><a href="${esc(p.notionUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 16px;font-weight:600">Edit in Notion</a></p>` : ''}`;
}

render();
