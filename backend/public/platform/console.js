/* SEC-05 / S10 — Platform console client.
 *
 * The operator session is an HttpOnly cookie scoped to /api/platform, so this script never
 * holds or stores the token: there is nothing here for an XSS to steal. The CSRF token is
 * read from its companion (readable) cookie and echoed in X-CSRF-Token, which is what
 * proves a state-changing request came from this page rather than another site.
 *
 * Plain DOM, no framework and no build step — an internal tool for a handful of operators.
 */
(function () {
  'use strict';
  var API = '/api/platform';

  // ── helpers ────────────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function toast(msg, isError) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast' + (isError ? ' err' : '');
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, isError ? 6000 : 3000);
  }
  // Escape before inserting anything server-provided into the DOM. Tenant names and audit
  // details are operator/tenant supplied, so they are untrusted here.
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(ts) { return ts ? new Date(ts).toLocaleString() : '—'; }

  async function api(path, options) {
    options = options || {};
    var headers = { 'Content-Type': 'application/json' };
    var csrf = readCookie('ac_platform_csrf');
    if (csrf) headers['X-CSRF-Token'] = csrf;
    var res = await fetch(API + path, {
      method: options.method || 'GET',
      credentials: 'include',          // send the HttpOnly operator cookie
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    var data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      if (res.status === 401) { showLogin(); throw new Error(data && data.error || 'Session expired'); }
      throw new Error((data && (data.error || data.message)) || ('Request failed (' + res.status + ')'));
    }
    return data;
  }

  // ── views ──────────────────────────────────────────────────────────────────
  function showLogin() {
    $('loginView').hidden = false;
    $('consoleView').hidden = true;
    $('who').hidden = true;
  }
  function showConsole(op) {
    $('loginView').hidden = true;
    $('consoleView').hidden = false;
    $('who').hidden = false;
    $('whoEmail').textContent = op.email;
    renderMfaState(op);
    loadTenants();
  }

  // ── auth ───────────────────────────────────────────────────────────────────
  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    $('loginError').hidden = true;
    try {
      var body = { email: $('email').value.trim(), password: $('password').value };
      var code = $('mfaCode').value.trim();
      if (code) body.mfaCode = code;
      var out = await api('/login', { method: 'POST', body: body });
      $('password').value = '';
      showConsole(out.operator);
    } catch (err) {
      $('loginError').textContent = err.message;
      $('loginError').hidden = false;
    }
  });

  $('signOut').addEventListener('click', async function () {
    try { await api('/logout', { method: 'POST' }); } catch (e) { /* clear locally anyway */ }
    showLogin();
  });

  // ── plans ──────────────────────────────────────────────────────────────────
  // Stripe wants a lower-case ISO-4217 code; a free-text box invited typos that Stripe
  // would only reject at push time, so the choice is constrained here instead.
  var CURRENCIES = ["usd", "eur", "gbp", "cad", "aud", "nzd", "inr", "aed", "sgd", "chf", "jpy", "zar", "sek", "nok", "dkk"];
  function currencyOptions(selected) {
    var cur = String(selected || 'usd').toLowerCase();
    return CURRENCIES.map(function (c) {
      return '<option value="' + c + '"' + (c === cur ? ' selected' : '') + '>' + c.toUpperCase() + '</option>';
    }).join('');
  }

  // Everything the server returns is escaped through esc(); this page never builds
  // markup from unescaped data.
  async function loadPlans() {
    var el = $('plansList');
    el.textContent = 'Loading…';
    try {
      var plans = await api('/plans');
      if (!plans.length) { el.innerHTML = '<p class="muted">No active plans.</p>'; return; }
      el.innerHTML = plans.map(function (p) {
        // A plan is only offered on the public signup page when BOTH are true. Saying so
        // per plan turns "No plans are available" from a mystery into a checklist.
        var sellable = p.is_active && p.self_serve && p.stripe_price_id;
        var why = !p.is_active
          ? 'inactive'
          : (!p.stripe_price_id
              ? 'not sellable — no Stripe price yet'
              : (!p.self_serve ? 'not sellable — "Sell on the public signup page" is off'
                               : 'live on the signup page'));
        return '<div class="card">' +
          '<h3>' + esc(p.display_name || p.name) +
          ' <span class="small" style="font-weight:400">' + (sellable ? '✓ ' : '· ') + esc(why) + '</span></h3>' +
          '<p class="muted small">' + (p.price != null ? esc(p.price) + ' ' + esc((p.currency || 'usd').toUpperCase()) : 'no price') +
          ' · ' + esc(p.billing_cycle || 'monthly') +
          (p.stripe_price_id ? ' · ' + esc(p.stripe_price_id) : '') + '</p>' +
          '<form class="planForm" data-id="' + esc(p.id) + '">' +
            '<label class="check"><input type="checkbox" name="isActive"' +
              (p.is_active ? ' checked' : '') + ' /> <span>Active</span></label>' +
            '<label class="check"><input type="checkbox" name="selfServe"' +
              (p.self_serve ? ' checked' : '') + ' /> <span>Sell on the public signup page</span></label>' +
            '<label>Price<input name="price" type="number" min="0" step="0.01" value="' +
              esc(p.price == null ? '' : p.price) + '" /></label>' +
            '<label>Currency<select name="currency">' + currencyOptions(p.currency) + '</select></label>' +
            '<label>Stripe price id<input name="stripePriceId" placeholder="price_…" value="' +
              esc(p.stripe_price_id || '') + '" /></label>' +
            '<label>Trial days<input name="trialDays" type="number" min="0" value="' +
              esc(p.trial_days == null ? 0 : p.trial_days) + '" /></label>' +
            '<button type="submit" class="primary">Save</button>' +
            '<button type="button" class="pushStripe" data-id="' + esc(p.id) + '">' +
              (p.stripe_price_id ? 'Re-create price in Stripe' : 'Create in Stripe') + '</button>' +
            '<span class="planMsg small"></span>' +
          '</form>' +
        '</div>';
      }).join('');
    } catch (e) {
      el.innerHTML = '<p class="error">' + esc(e.message) + '</p>';
    }
  }

  document.addEventListener('submit', async function (e) {
    var form = e.target.closest('form.planForm');
    if (!form) return;
    e.preventDefault();
    var msg = form.querySelector('.planMsg');
    msg.textContent = 'Saving…';
    try {
      await api('/plans/' + encodeURIComponent(form.dataset.id), {
        method: 'PUT',
        body: {
          isActive: form.isActive.checked,
          selfServe: form.selfServe.checked,
          stripePriceId: form.stripePriceId.value.trim(),
          trialDays: Number(form.trialDays.value || 0),
          price: form.price.value === '' ? null : Number(form.price.value),
          currency: form.currency.value,
        },
      });
      msg.textContent = 'Saved.';
      // Re-read from the server: the badge must reflect what was stored, not what was typed.
      loadPlans();
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  // Create the Product and Price in Stripe, so an operator never has to copy a price id
  // out of the Stripe dashboard. Confirm first when it would replace an existing price:
  // Stripe prices are immutable, so this mints a new one and archives the old.
  document.addEventListener('click', async function (e) {
    var btn = e.target.closest('button.pushStripe');
    if (!btn) return;
    var form = btn.closest('form.planForm');
    var msg = form.querySelector('.planMsg');
    var replacing = form.stripePriceId.value.trim();
    if (replacing && !window.confirm(
      'This creates a NEW Stripe price and archives ' + replacing + '.\n\n' +
      'Existing subscribers keep paying their current price; only new customers get the new one.\n\nContinue?'
    )) return;

    btn.disabled = true;
    msg.textContent = 'Creating in Stripe…';
    try {
      var updated = await api('/plans/' + encodeURIComponent(btn.dataset.id) + '/stripe', { method: 'POST' });
      msg.textContent = 'Created ' + updated.stripe_price_id +
        (updated.archivedPriceId ? ' (archived ' + updated.archivedPriceId + ')' : '');
      loadPlans();
    } catch (err) {
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  // ── new plan ───────────────────────────────────────────────────────────────
  $('newPlanBtn').addEventListener('click', function () {
    var f = $('newPlanForm');
    f.hidden = !f.hidden;
  });
  $('cancelPlan').addEventListener('click', function () { $('newPlanForm').hidden = true; });

  $('newPlanForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = $('newPlanMsg');
    msg.textContent = 'Creating…';
    try {
      await api('/plans', {
        method: 'POST',
        body: {
          name: $('pName').value.trim(),
          displayName: $('pDisplay').value.trim(),
          description: $('pDesc').value.trim() || null,
          price: Number($('pPrice').value),
          currency: $('pCurrency').value.trim() || 'usd',
          billingCycle: $('pCycle').value,
          trialDays: Number($('pTrial').value || 0),
          maxUsers: Number($('pMaxUsers').value || -1),
          maxProviders: Number($('pMaxProviders').value || -1),
        },
      });
      msg.textContent = 'Created. Now use "Create in Stripe", then tick "Sell on the public signup page".';
      $('newPlanForm').reset();
      loadPlans();
    } catch (err) {
      msg.textContent = err.message;
    }
  });

  // ── tabs ───────────────────────────────────────────────────────────────────
  $('tabs').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    var tab = btn.dataset.tab;
    Array.prototype.forEach.call(document.querySelectorAll('#tabs button'), function (b) {
      b.classList.toggle('active', b === btn);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (p) {
      p.hidden = p.dataset.panel !== tab;
    });
    if (tab === 'audit') loadAudit();
    if (tab === 'tenants') loadTenants();
    if (tab === 'plans') loadPlans();
  });

  // ── tenants ────────────────────────────────────────────────────────────────
  async function loadTenants() {
    var el = $('tenantList');
    el.textContent = 'Loading…';
    try {
      var tenants = await api('/tenants');
      if (!tenants.length) { el.textContent = 'No tenants yet.'; return; }
      el.innerHTML = tenants.map(function (t) {
        return '<div class="item" data-id="' + esc(t.id) + '">' +
          '<div class="row between"><h4>' + esc(t.name) +
            ' <span class="pill ' + esc(t.status) + '">' + esc(t.status) + '</span></h4>' +
            '<div class="row">' +
              '<button data-act="sub">Subscription</button>' +
              (t.status === 'active'
                 ? '<button data-act="suspend">Suspend</button>'
                 : '<button data-act="resume">Resume</button>') +
              '<button data-act="bg">Break-glass</button>' +
            '</div></div>' +
          '<div class="meta">slug ' + esc(t.slug) + ' · schema ' + esc(t.schema_name) +
            ' · ' + esc(t.user_count || 0) + ' users · created ' + esc(fmt(t.created_at)) + '</div>' +
          '<div class="detail" hidden></div></div>';
      }).join('');
    } catch (err) { el.textContent = err.message; }
  }

  $('tenantList').addEventListener('click', async function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var item = btn.closest('.item');
    var id = item.dataset.id;
    var detail = item.querySelector('.detail');
    try {
      if (btn.dataset.act === 'suspend' || btn.dataset.act === 'resume') {
        var act = btn.dataset.act;
        if (act === 'suspend' && !confirm('Suspend this tenant? Its users will be blocked from signing in.')) return;
        await api('/tenants/' + id + '/' + act, { method: 'POST' });
        toast('Tenant ' + act + 'd');
        loadTenants();
      } else if (btn.dataset.act === 'sub') {
        var sub = await api('/tenants/' + id + '/subscription').catch(function () { return null; });
        var plans = await api('/plans');
        detail.hidden = false;
        detail.innerHTML =
          '<hr><div class="row"><label>Plan<select data-f="plan">' +
            plans.map(function (p) {
              return '<option value="' + esc(p.id) + '"' + (sub && sub.plan_id === p.id ? ' selected' : '') +
                     '>' + esc(p.display_name || p.name) + '</option>';
            }).join('') + '</select></label>' +
          '<label>Status<select data-f="status">' +
            ['trialing', 'active', 'past_due', 'canceled'].map(function (s) {
              return '<option' + (sub && sub.status === s ? ' selected' : '') + '>' + s + '</option>';
            }).join('') + '</select></label>' +
          '<label>Seats<input data-f="seats" type="number" min="0" value="' + esc(sub && sub.seats || 0) + '" /></label>' +
          '<button data-act="save-sub" class="primary">Save</button></div>' +
          '<p class="muted small">past_due or canceled makes the workspace read-only.</p>';
      } else if (btn.dataset.act === 'save-sub') {
        var body = {
          planId: Number(detail.querySelector('[data-f=plan]').value),
          status: detail.querySelector('[data-f=status]').value,
          seats: Number(detail.querySelector('[data-f=seats]').value)
        };
        await api('/tenants/' + id + '/subscription', { method: 'PUT', body: body });
        toast('Subscription updated');
        detail.hidden = true;
      } else if (btn.dataset.act === 'bg') {
        var reason = prompt('Break-glass access is time-boxed and audited.\n\nWhy do you need to read this tenant\'s activity? (min 8 characters)');
        if (!reason || reason.trim().length < 8) { if (reason !== null) toast('A justification of at least 8 characters is required', true); return; }
        var session = await api('/tenants/' + id + '/break-glass', { method: 'POST', body: { reason: reason.trim(), ttlMinutes: 30 } });
        var rows = await api('/tenants/' + id + '/tenant-audit');
        detail.hidden = false;
        detail.innerHTML = '<hr><div class="row between"><strong>Tenant activity</strong>' +
          '<button data-act="end-bg" data-session="' + esc(session.id) + '">End session</button></div>' +
          '<p class="muted small">This read has been recorded in the platform audit trail.</p>' +
          (rows.length ? '<table><tr><th>When</th><th>Action</th><th>Resource</th><th>User</th></tr>' +
            rows.map(function (r) {
              return '<tr><td>' + esc(fmt(r.created_at)) + '</td><td>' + esc(r.action_type) +
                     '</td><td>' + esc(r.resource_name || r.resource_type) + '</td><td>' + esc(r.user_email || '—') + '</td></tr>';
            }).join('') + '</table>' : '<p class="muted">No activity recorded.</p>');
      } else if (btn.dataset.act === 'end-bg') {
        await api('/break-glass/' + btn.dataset.session + '/end', { method: 'POST' });
        toast('Break-glass session ended');
        detail.hidden = true;
      }
    } catch (err) { toast(err.message, true); }
  });

  $('newTenantBtn').addEventListener('click', function () { $('newTenantForm').hidden = false; });
  $('cancelTenant').addEventListener('click', function () { $('newTenantForm').hidden = true; });
  $('newTenantForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    try {
      await api('/tenants', { method: 'POST', body: {
        name: $('tName').value.trim(),
        planTier: $('tPlan').value.trim() || undefined,
        country: $('tCountry').value.trim() || undefined,
        timezone: $('tTz').value.trim() || undefined
      }});
      toast('Tenant created and its schema provisioned');
      $('newTenantForm').hidden = true;
      $('tName').value = '';
      loadTenants();
    } catch (err) { toast(err.message, true); }
  });

  // ── audit ──────────────────────────────────────────────────────────────────
  async function loadAudit() {
    var el = $('auditList');
    el.textContent = 'Loading…';
    try {
      var rows = await api('/audit?limit=100');
      if (!rows.length) { el.textContent = 'No entries.'; return; }
      el.innerHTML = '<table><tr><th>When</th><th>Operator</th><th>Action</th><th>Target</th><th>Detail</th></tr>' +
        rows.map(function (r) {
          return '<tr><td>' + esc(fmt(r.created_at)) + '</td><td>' + esc(r.operator_email || '—') +
            '</td><td>' + esc(r.action) + '</td><td>' + esc(r.target_type || '') + ' ' + esc((r.target_id || '').slice(0, 8)) +
            '</td><td class="small muted">' + esc(r.detail ? JSON.stringify(r.detail) : '') + '</td></tr>';
        }).join('') + '</table>';
    } catch (err) { el.textContent = err.message; }
  }

  // ── MFA ────────────────────────────────────────────────────────────────────
  function renderMfaState(op) {
    var enabled = op && op.mfaEnabled;
    $('mfaState').innerHTML = enabled
      ? '<p class="pill active">Enabled</p>'
      : '<p class="pill suspended">Not enabled</p>';
    $('mfaEnroll').hidden = !!enabled;
  }
  $('mfaEnroll').addEventListener('click', async function () {
    try {
      var out = await api('/mfa/enroll', { method: 'POST' });
      $('otpUrl').textContent = out.otpauthUrl || out.base32;
      $('mfaSetup').hidden = false;
    } catch (err) { toast(err.message, true); }
  });
  $('mfaVerifyForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    try {
      await api('/mfa/verify', { method: 'POST', body: { code: $('mfaVerifyCode').value.trim() } });
      toast('MFA enabled');
      $('mfaSetup').hidden = true;
      renderMfaState({ mfaEnabled: true });
    } catch (err) { toast(err.message, true); }
  });

  // ── boot: restore the session from the cookie, if there is one ─────────────
  (async function init() {
    try {
      var me = await api('/me');
      showConsole(me.operator);
    } catch (e) {
      showLogin();
    }
  })();
})();
