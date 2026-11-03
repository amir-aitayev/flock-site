// Flock landing page: the stub, the held stage, the rooms list, the live house pact and the waitlist.
// Everything reads as plain HTML without it.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The stub appears once the hero has gone and steps aside over the pact and the final band.
  const stub = $('.stub');
  if (stub && 'IntersectionObserver' in window) {
    const seen = new Map();
    const watched = ['.hero', '#pact', '.cta', '.how'].map((s) => $(s));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target, e.isIntersecting));
      const on = seen.get(watched[0]) === false && !watched.slice(1).some((el) => seen.get(el));
      stub.classList.toggle('is-on', on);
      stub.inert = !on;
    });
    watched.forEach((el) => io.observe(el));
  }

  // How it works: one held stage; scrolling through the section brings each job to the front. rAF-throttled.
  const how = $('.how');
  if (how) {
    const steps = $$('.step', how);
    how.classList.add('staged');
    let cur = -1, ticking = false;
    const set = () => {
      ticking = false;
      const r = how.getBoundingClientRect();
      const p = Math.min(0.999, Math.max(0, -r.top / (r.height - innerHeight)));
      const i = Math.floor(p * steps.length);
      if (i === cur) return;
      steps.forEach((s, k) => s.classList.toggle('is-on', k === i));
      cur = i;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(set); } }, { passive: true });
    addEventListener('resize', set);
    set();
  }

  // Pictures start opening a little before they reach the screen; list rows arrive one after another.
  if ('IntersectionObserver' in window) {
    const early = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); early.unobserve(e.target); }
    }), { rootMargin: '0px 0px 25% 0px' });
    $$('.pic .shutter').forEach((el) => early.observe(el));
  }
  const rowList = $('.rows');
  if (rowList) {
    $$('li', rowList).forEach((li, i) => li.style.setProperty('--i', i));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { rowList.classList.add('is-in'); io.disconnect(); } }, { rootMargin: '0px 0px -15% 0px' });
      io.observe(rowList);
    } else rowList.classList.add('is-in');
  }

  // Rooms: the active job lights its room in the job's module colour.
  const rows = $$('.row');
  const rooms = $$('.room');
  function activate(row) {
    rows.forEach((r) => r.setAttribute('aria-pressed', String(r === row)));
    rooms.forEach((g) => {
      const on = g.dataset.room === row.dataset.room;
      g.classList.toggle('is-active', on);
      if (on) g.style.setProperty('--room', row.style.getPropertyValue('--m'));
    });
  }
  rows.forEach((r) => {
    r.addEventListener('mouseenter', () => activate(r));
    r.addEventListener('focus', () => activate(r));
    r.addEventListener('click', () => activate(r));
  });

  // The house pact: people x jobs, rotated one place a week. The front bird takes the lead's colour.
  const PEOPLE = ['#7B2C5A', '#2A9D8F', '#7368C5', '#2F6FA8', '#E0A33A'];
  const form = $('#pact-form');
  if (!form) return;
  const dateIn = $('#p-date');
  const pad = (n) => String(n).padStart(2, '0'); // taste-skill-ignore: ISO date parts
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monday = (d) => { const m = new Date(d); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };
  const short = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  dateIn.value = iso(monday(new Date()));
  let lastLead = '';

  function read() {
    const names = $$('.pact__names input').map((i, k) => ({ name: i.value.trim(), colour: PEOPLE[k] })).filter((p) => p.name);
    const jobs = $$('input[name="job"]:checked').map((i) => i.value);
    const [y, m, d] = (dateIn.value || iso(new Date())).split('-').map(Number);
    return { names, jobs, start: monday(new Date(y, m - 1, d)) };
  }
  const who = (names, j, week) => names[(j + week) % names.length];

  function render() {
    const { names, jobs, start } = read();
    const thisList = $('[data-out="this"]');
    const table = $('[data-out="table"]');
    const mark = $('.pact__mark');
    $('[data-out="week"]').textContent = `the week of ${short(start)}`;
    if (!names.length || !jobs.length) {
      $('[data-out="lead"]').textContent = names.length ? 'Pick a job' : 'Add a name';
      thisList.innerHTML = '';
      table.innerHTML = '<tbody><tr><td>Turns appear here once you add names and jobs.</td></tr></tbody>';
      return;
    }
    const lead = who(names, 0, 0);
    $('[data-out="lead"]').textContent = `${lead.name} leads`;
    mark.style.setProperty('--lead', lead.colour);
    if (lastLead && lastLead !== lead.name && !reduce && mark.animate) {
      mark.animate([{ transform: 'translateY(6px) rotate(-6deg)' }, { transform: 'none' }], { duration: 600, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
    }
    lastLead = lead.name;
    thisList.innerHTML = jobs.map((job, j) => { const p = who(names, j, 0); return `<li><span>${esc(job)}</span><span style="--c:${p.colour}">${esc(p.name)}</span></li>`; }).join('');
    const head = `<thead><tr><th>Week of</th>${jobs.map((j) => `<th>${esc(j)}</th>`).join('')}</tr></thead>`;
    const body = [1, 2, 3, 4].map((w) => {
      const d = new Date(start); d.setDate(d.getDate() + 7 * w);
      return `<tr><td>${short(d)}</td>${jobs.map((_, j) => `<td>${esc(who(names, j, w).name)}</td>`).join('')}</tr>`;
    }).join('');
    table.innerHTML = head + `<tbody>${body}</tbody>`;
    $('[data-out="status"]').textContent = '';
  }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  form.addEventListener('input', render);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { names, jobs, start } = read();
    if (!names.length || !jobs.length) { $('[data-out="status"]').textContent = 'Add at least one name and one job first.'; return; }
    const lines = [`House pact, from the week of ${short(start)}`, ''];
    for (let w = 0; w < 5; w++) {
      const d = new Date(start); d.setDate(d.getDate() + 7 * w);
      lines.push(`${short(d)}: ${jobs.map((job, j) => `${job}, ${who(names, j, w).name}`).join('; ')}`);
    }
    const text = lines.join('\n');
    try { await navigator.clipboard.writeText(text); $('[data-out="status"]').textContent = 'Copied. Paste it in your flat chat.'; }
    catch { $('[data-out="status"]').textContent = 'Copying is blocked here. Select the table above and copy it instead.'; }
  });
  render();

  // The waitlist: one RPC with the publishable key, which can write a signup but never read the list.
  const SUPABASE = 'https://cuhbeomfypzhvwcqavmw.supabase.co';
  const KEY = 'sb_publishable_M1VoyQMzQWttMUuqjdfeQw_WS7NJy7K';
  const wait = $('#wait-form');
  const waitOut = $('[data-out="wait"]');
  wait?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = wait.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { waitOut.textContent = 'Enter an email address like name@example.com.'; wait.email.focus(); return; }
    const button = $('button', wait);
    button.disabled = true;
    waitOut.textContent = 'Adding you…';
    try {
      const res = await fetch(`${SUPABASE}/rest/v1/rpc/join_waitlist`, {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_email: email,
          p_city: wait.city.value,
          p_lang: (navigator.language || 'en').slice(0, 2),
          p_source: new URLSearchParams(location.search).get('s') || 'site',
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      waitOut.textContent = `You're on the list. We'll write to ${email} the day Flock opens.`;
      wait.reset();
    } catch {
      waitOut.textContent = "That didn't go through. Check your connection and try again.";
    } finally {
      button.disabled = false;
    }
  });
})();
