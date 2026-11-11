// Flock landing page, v3: arrivals, the city links, the live rota and the waitlist.
// Everything reads as plain HTML without it.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Content rises in as it reaches the screen, once.
  const reveal = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    reveal.forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 70}ms`; io.observe(el); });
  } else reveal.forEach((el) => el.classList.add('is-in'));

  // A city picked above is the one the form starts on.
  const wait = $('#wait-form');
  $$('[data-city]').forEach((a) => a.addEventListener('click', () => {
    if (wait) wait.city.value = a.dataset.city;
    setTimeout(() => wait?.email.focus({ preventScroll: true }), reduce ? 0 : 500);
  }));

  // The rota: people x chores, moved one place a week. The front bird takes the lead's colour.
  const PEOPLE = ['#7B2C5A', '#1D7A6F', '#5E52B5', '#2A6399', '#94600A'];
  const form = $('#pact-form');
  if (form) {
    const dateIn = $('#p-date');
    const pad = (n) => String(n).padStart(2, '0'); // taste-skill-ignore: ISO date parts
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const monday = (d) => { const m = new Date(d); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };
    const short = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    dateIn.value = iso(monday(new Date()));
    let lastLead = '';

    const read = () => {
      const names = $$('.pact__names input').map((i, k) => ({ name: i.value.trim(), colour: PEOPLE[k] })).filter((p) => p.name);
      const jobs = $$('input[name="job"]:checked').map((i) => i.value);
      const [y, m, d] = (dateIn.value || iso(new Date())).split('-').map(Number);
      return { names, jobs, start: monday(new Date(y, m - 1, d)) };
    };
    const who = (names, j, week) => names[(j + week) % names.length];

    const render = () => {
      const { names, jobs, start } = read();
      const thisList = $('[data-out="this"]');
      const table = $('[data-out="table"]');
      const mark = $('.pact__mark');
      $('[data-out="week"]').textContent = `the week of ${short(start)}`;
      if (!names.length || !jobs.length) {
        $('[data-out="lead"]').textContent = names.length ? 'Pick a chore' : 'Add a name';
        thisList.innerHTML = '';
        table.innerHTML = '<tbody><tr><td>Turns appear here once you add names and chores.</td></tr></tbody>';
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
    };

    form.addEventListener('input', render);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { names, jobs, start } = read();
      if (!names.length || !jobs.length) { $('[data-out="status"]').textContent = 'Add at least one name and one chore first.'; return; }
      const lines = [`Our rota, from the week of ${short(start)}`, ''];
      for (let w = 0; w < 5; w++) {
        const d = new Date(start); d.setDate(d.getDate() + 7 * w);
        lines.push(`${short(d)}: ${jobs.map((job, j) => `${job}, ${who(names, j, w).name}`).join('; ')}`);
      }
      try { await navigator.clipboard.writeText(lines.join('\n')); $('[data-out="status"]').textContent = 'Copied. Paste it in your flat chat.'; }
      catch { $('[data-out="status"]').textContent = 'Copying is blocked here. Select the table above and copy it instead.'; }
    });
    render();
  }

  // The waitlist: one RPC with the publishable key, which can write a signup but never read the list.
  const SUPABASE = 'https://cuhbeomfypzhvwcqavmw.supabase.co';
  const KEY = 'sb_publishable_M1VoyQMzQWttMUuqjdfeQw_WS7NJy7K';
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
          // The list keeps English or Italian; anything else is left blank.
          p_lang: (navigator.language || 'en').slice(0, 2) === 'it' ? 'it' : 'en',
          p_source: new URLSearchParams(location.search).get('s') || 'site-v3',
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      waitOut.textContent = `You're in the flock. We'll write to ${email} the day Flock opens in your city.`;
      wait.reset();
    } catch {
      waitOut.textContent = "That didn't go through. Check your connection and try again.";
    } finally {
      button.disabled = false;
    }
  });
})();
