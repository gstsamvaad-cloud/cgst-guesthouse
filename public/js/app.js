/* ═══════════════════════════════════════════════════════════════
   CGST Guest House Portal — Frontend SPA
   All data flows through /api/* REST endpoints.
   No business logic here — just UI + API calls.
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── State ──────────────────────────────────────────────────── */
let CURRENT_USER = null;
let TOKEN        = null;
let ROOMS        = [];
let activeTab    = 'apply';

/* ── Domain constants (mirrored from backend/src/utils/domain.js) ── */
const APPLICANT_TYPES = [
  { v: 'duty',    label: 'Departmental officer — official duty',         priority: 1 },
  { v: 'private', label: 'Departmental officer — private visit',         priority: 2 },
  { v: 'other',   label: 'Officer of other Central/State Govt/PSU/Bank', priority: 3 },
  { v: 'retired', label: 'Retired departmental official',                priority: 4 },
  { v: 'guest',   label: 'Guest of a departmental officer',              priority: 5 },
];
const RATES = {
  duty:    { suite: 450,  room: 350 },
  private: { suite: 600,  room: 400 },
  other:   { suite: 1000, room: 800 },
  retired: { suite: 600,  room: 400 },
  guest:   { suite: 750,  room: 600 },
};
function getRoomType(grp)            { return grp === 'A' ? 'suite' : 'room'; }
function getRate(type, rt)           { return RATES[type]?.[rt] ?? 0; }
function calcNights(ci, co)          { return Math.max(0, Math.round((new Date(co) - new Date(ci)) / 86400000)); }
function fmtDate(s)                  { if (!s) return ''; return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function todayStr()                  { return new Date().toISOString().slice(0, 10); }
function priorityLabel(p)            { return ['', '1st — official duty', '2nd — private visit', '3rd — reciprocal officer', '4th — retired official', '5th — guest'][p] || ''; }
function escHtml(s)                  { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

/* ── API helper ─────────────────────────────────────────────── */
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',           // send HttpOnly cookie
  };
  if (TOKEN) opts.headers['Authorization'] = `Bearer ${TOKEN}`;
  if (body)  opts.body = JSON.stringify(body);

  const res = await fetch('/api' + path, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data.details ? data.details.join('; ') : (data.error || 'Request failed.');
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

/* ── Toast ──────────────────────────────────────────────────── */
let _toastTimer;
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ── Spinner helpers ─────────────────────────────────────────── */
function setLoading(btnId, spinnerId, loading) {
  const btn     = document.getElementById(btnId);
  const spinner = document.getElementById(spinnerId);
  if (!btn) return;
  btn.disabled = loading;
  if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
}

/* ════════════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════════════ */
(function setupAuth() {
  /* Tab switching */
  document.querySelectorAll('.login-tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.login-tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.login-panel').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('lp_' + t.dataset.ltab).classList.add('active');
    });
  });

  /* Sign In */
  async function doSignIn() {
    const email = document.getElementById('si_email').value.trim();
    const pass  = document.getElementById('si_pass').value;
    const err   = document.getElementById('si_err');
    err.classList.remove('show');
    if (!email || !pass) { err.textContent = 'Please fill in all fields.'; err.classList.add('show'); return; }

    setLoading('si_btn', 'si_spinner', true);
    document.getElementById('si_btn_text').textContent = 'Signing in…';
    try {
      const data = await api('POST', '/auth/login', { email, password: pass });
      TOKEN = data.token;
      await bootPortal(data.user);
    } catch (e) {
      err.textContent = e.message;
      err.classList.add('show');
    } finally {
      setLoading('si_btn', 'si_spinner', false);
      document.getElementById('si_btn_text').textContent = 'Sign In';
    }
  }

  document.getElementById('si_btn').addEventListener('click', doSignIn);
  ['si_email', 'si_pass'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') doSignIn(); });
  });

  /* Register */
  document.getElementById('reg_btn').addEventListener('click', async () => {
    const name   = document.getElementById('reg_name').value.trim();
    const email  = document.getElementById('reg_email').value.trim();
    const mobile = document.getElementById('reg_mobile').value.trim();
    const role   = document.getElementById('reg_role').value;
    const pass   = document.getElementById('reg_pass').value;
    const err    = document.getElementById('reg_err');
    const ok     = document.getElementById('reg_ok');
    err.classList.remove('show'); ok.classList.remove('show');

    setLoading('reg_btn', 'reg_spinner', true);
    document.getElementById('reg_btn_text').textContent = 'Creating…';
    try {
      await api('POST', '/auth/register', { name, email, mobile, role, password: pass });
      ok.textContent = 'Account created! A welcome email has been sent. You can now sign in.';
      ok.classList.add('show');
      ['reg_name', 'reg_email', 'reg_mobile', 'reg_pass'].forEach(id => document.getElementById(id).value = '');
    } catch (e) {
      err.textContent = e.message;
      err.classList.add('show');
    } finally {
      setLoading('reg_btn', 'reg_spinner', false);
      document.getElementById('reg_btn_text').textContent = 'Create Account';
    }
  });
})();

/* ════════════════════════════════════════════════════════════════
   BOOT PORTAL after login
════════════════════════════════════════════════════════════════ */
async function bootPortal(user) {
  CURRENT_USER = user;

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('userBar').style.display    = 'flex';
  document.getElementById('portalWrap').style.display = 'block';
  document.getElementById('ub_name').textContent = user.name;
  document.getElementById('ub_role').textContent = user.role === 'officer' ? 'JC / ADC' : 'Applicant';

  /* Show/hide officer-only tabs */
  ['approve', 'rooms'].forEach(t => {
    document.querySelector(`.tab[data-tab="${t}"]`).style.display =
      user.role === 'officer' ? '' : 'none';
  });

  if (user.role !== 'officer') {
    activeTab = 'apply';
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.tab[data-tab="apply"]').classList.add('active');
  }

  /* Logout */
  document.getElementById('logoutBtn').onclick = async () => {
    await api('POST', '/auth/logout').catch(() => {});
    TOKEN = null; CURRENT_USER = null; ROOMS = [];
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('userBar').style.display    = 'none';
    document.getElementById('portalWrap').style.display = 'none';
    document.getElementById('inboxPanel').classList.remove('open');
    document.getElementById('inboxBackdrop').style.display = 'none';
    ['approve', 'rooms'].forEach(t => {
      document.querySelector(`.tab[data-tab="${t}"]`).style.display = 'none';
    });
  };

  /* Notification bell */
  document.getElementById('notifBtn').onclick = async () => {
    const panel = document.getElementById('inboxPanel');
    const isOpen = panel.classList.contains('open');
    if (isOpen) { closeInbox(); return; }
    panel.classList.add('open');
    document.getElementById('inboxBackdrop').style.display = 'block';
    await renderInbox();
    api('PATCH', '/notifications/read-all').catch(() => {});
    document.getElementById('notifDot').classList.remove('show');
  };
  document.getElementById('inboxClose').onclick = closeInbox;
  document.getElementById('inboxBackdrop').onclick = closeInbox;

  /* Tab navigation */
  document.getElementById('tabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    const restricted = ['approve', 'rooms'];
    if (restricted.includes(tab.dataset.tab) && CURRENT_USER?.role !== 'officer') return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    render();
  });

  /* Load rooms and render */
  document.getElementById('panel').innerHTML = '<div class="empty"><div class="glyph">…</div>Loading…</div>';
  try {
    const data = await api('GET', '/rooms');
    ROOMS = data.rooms;
  } catch (e) { ROOMS = []; }

  render();
  refreshNotifDot();
}

function closeInbox() {
  document.getElementById('inboxPanel').classList.remove('open');
  document.getElementById('inboxBackdrop').style.display = 'none';
}

async function refreshNotifDot() {
  try {
    const data = await api('GET', '/notifications');
    document.getElementById('notifDot').classList.toggle('show', data.unread > 0);
  } catch (e) { /* silent */ }
}

async function renderInbox() {
  const body = document.getElementById('inboxBody');
  body.innerHTML = '<div class="inbox-empty">Loading…</div>';
  try {
    const data = await api('GET', '/notifications');
    if (!data.notifications.length) {
      body.innerHTML = '<div class="inbox-empty">No notifications yet.<br>You will be notified when your application is decided.</div>';
      return;
    }
    body.innerHTML = data.notifications.map(n => {
      const d = n.data;
      const isApproved = n.type === 'approved';
      const timeStr = new Date(n.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `<div class="inbox-msg ${isApproved ? 'approved' : 'rejected'} ${n.is_read ? '' : 'unread'}">
        <div class="inbox-msg-header">
          <div class="inbox-msg-title">${isApproved ? '✓ Booking Approved' : '✕ Application Rejected'}</div>
          <div class="inbox-msg-time">${timeStr}</div>
        </div>
        <div>
          ${isApproved
            ? `Your application for <b>${escHtml(d.name)}</b> has been <b style="color:var(--ok)">approved</b>.<br>
               Room: <b>${escHtml(d.roomLabel)}</b> · ${fmtDate(d.checkIn)} → ${fmtDate(d.checkOut)} (${d.nights} night${d.nights === 1 ? '' : 's'})<br>
               Rate: Rs. ${d.rate}/day · <b>Total: Rs. ${d.total}</b><br>
               Payment: ${d.payMode === 'upi' ? '📲 UPI' : '💵 Cash'}${d.upiRef ? ' · UTR: ' + escHtml(d.upiRef) : ''}`
            : `Your application for <b>${escHtml(d.name)}</b> for <b>${fmtDate(d.checkIn)} → ${fmtDate(d.checkOut)}</b> was <b style="color:var(--stamp)">not approved</b>.<br>
               Contact the Guest House office for details.`
          }
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    body.innerHTML = '<div class="inbox-empty">Could not load notifications.</div>';
  }
}

/* ════════════════════════════════════════════════════════════════
   RENDER ROUTER
════════════════════════════════════════════════════════════════ */
function render() {
  const panel = document.getElementById('panel');
  if (activeTab === 'apply')    { panel.innerHTML = renderApply();    attachApplyHandlers(); }
  else if (activeTab === 'approve') renderApproveAsync(panel);
  else if (activeTab === 'register') renderRegisterAsync(panel);
  else if (activeTab === 'rooms')    renderRoomsAsync(panel);
}

/* ════════════════════════════════════════════════════════════════
   TAB: APPLY FOR STAY
════════════════════════════════════════════════════════════════ */
function renderApply() {
  return `
  <h2 class="section-title">New Application</h2>
  <p class="section-sub">Check availability for your dates, then complete your application. Allotment follows priority order per the Rules and is confirmed by JC/ADC.</p>

  <div class="avail-module">
    <h3><span class="avail-step-badge">1</span> Check Availability</h3>
    <div class="avail-row">
      <div><label style="margin-top:0;">Check‑in Date</label><input type="date" id="av_ci" min="${todayStr()}"></div>
      <div><label style="margin-top:0;">Check‑out Date</label><input type="date" id="av_co"></div>
      <div>
        <label style="margin-top:0;">Room Type</label>
        <select id="av_rt">
          <option value="suite">AC Suite (Group A)</option>
          <option value="room">AC Room (Group B &amp; C)</option>
        </select>
      </div>
      <div><button class="btn" id="av_checkBtn" type="button" style="white-space:nowrap;">Check</button></div>
    </div>
    <div class="avail-result" id="av_result">
      <div class="avail-summary" id="av_summary"></div>
      <div class="avail-rooms"   id="av_rooms"></div>
      <div class="avail-proceed-bar" id="av_proceed">
        <span id="av_proceed_msg"></span>
        <button class="btn btn-approve btn-sm" id="av_proceedBtn" type="button">Proceed to Book →</button>
      </div>
      <div class="avail-blocked-bar" id="av_blocked"></div>
    </div>
  </div>

  <div class="booking-form-wrap" id="bookingFormWrap">
    <div class="apply-grid">
      <div>
        <div class="form-step-header">
          <span class="avail-step-badge">2</span>
          <span>Fill in Application Details</span>
        </div>
        <div class="prefilled-note" id="prefillNote" style="display:none;"></div>
        <div class="api-error" id="formErr" style="display:none;"></div>
        <form id="applyForm" novalidate>
          <label>Name &amp; Designation</label>
          <input type="text" id="f_name" placeholder="e.g. S. Banerjee, Superintendent" required>

          <div class="row2">
            <div>
              <label>Group / Category</label>
              <select id="f_group"><option value="A">Group A</option><option value="BC">Group B &amp; C</option></select>
            </div>
            <div>
              <label>Commissionerate / Office</label>
              <input type="text" id="f_office" placeholder="e.g. CGST Kolkata North" required>
            </div>
          </div>

          <label>Purpose of Visit</label>
          <select id="f_type">${APPLICANT_TYPES.map(t => `<option value="${t.v}">${t.label}</option>`).join('')}</select>

          <div class="row2">
            <div><label>Check‑in</label><input type="date" id="f_checkin" required></div>
            <div><label>Check‑out</label><input type="date" id="f_checkout" required></div>
          </div>

          <label>Mobile Number</label>
          <input type="tel" id="f_mobile" placeholder="10-digit mobile" required>

          <label>Remarks <span style="font-weight:400;color:var(--ink-soft);">(optional)</span></label>
          <textarea id="f_remarks" placeholder="Dependent name, relationship, purpose, etc."></textarea>

          <div id="rateInfo" class="note" style="margin-top:10px;"></div>

          <!-- Payment -->
          <div class="payment-box">
            <div class="payment-box-title">💳 Payment Mode</div>
            <div class="pay-summary">
              <div class="pay-summary-row"><span>Room type</span><span id="ps_room">—</span></div>
              <div class="pay-summary-row"><span>Rate / day</span><span id="ps_rate">—</span></div>
              <div class="pay-summary-row"><span>Nights</span><span id="ps_nights">—</span></div>
              <div class="pay-summary-row pay-summary-total"><span>Estimated Total</span><span id="ps_total">—</span></div>
            </div>
            <div style="margin:14px 0 4px;font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-soft);">Choose Payment Method</div>
            <div class="pay-options">
              <label class="pay-opt selected" id="payOptUpi">
                <input type="radio" name="payMode" value="upi" checked>
                <span class="pay-opt-icon">📲</span>
                <span class="pay-opt-label">UPI<small>Pay via UPI app</small></span>
              </label>
              <label class="pay-opt" id="payOptCash">
                <input type="radio" name="payMode" value="cash">
                <span class="pay-opt-icon">💵</span>
                <span class="pay-opt-label">Cash<small>Pay at counter</small></span>
              </label>
            </div>
            <div class="upi-fields show" id="upiFields">
              <div class="upi-qr-wrap">
                <div class="upi-qr">
                  <svg viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;width:100%;height:100%;">
                    <rect width="21" height="21" fill="white"/>
                    <rect x="1" y="1" width="7" height="7" fill="#1E2A38"/><rect x="2" y="2" width="5" height="5" fill="white"/><rect x="3" y="3" width="3" height="3" fill="#1E2A38"/>
                    <rect x="13" y="1" width="7" height="7" fill="#1E2A38"/><rect x="14" y="2" width="5" height="5" fill="white"/><rect x="15" y="3" width="3" height="3" fill="#1E2A38"/>
                    <rect x="1" y="13" width="7" height="7" fill="#1E2A38"/><rect x="2" y="14" width="5" height="5" fill="white"/><rect x="3" y="15" width="3" height="3" fill="#1E2A38"/>
                    <rect x="9" y="1" width="1" height="1" fill="#1E2A38"/><rect x="11" y="1" width="1" height="1" fill="#1E2A38"/><rect x="9" y="3" width="1" height="1" fill="#1E2A38"/><rect x="10" y="4" width="1" height="1" fill="#1E2A38"/>
                    <rect x="9" y="5" width="1" height="1" fill="#1E2A38"/><rect x="11" y="5" width="1" height="1" fill="#1E2A38"/><rect x="1" y="9" width="1" height="1" fill="#1E2A38"/><rect x="3" y="9" width="1" height="1" fill="#1E2A38"/>
                    <rect x="5" y="9" width="1" height="1" fill="#1E2A38"/><rect x="7" y="9" width="2" height="1" fill="#1E2A38"/><rect x="10" y="9" width="1" height="1" fill="#1E2A38"/><rect x="12" y="9" width="1" height="1" fill="#1E2A38"/>
                    <rect x="14" y="9" width="1" height="1" fill="#1E2A38"/><rect x="16" y="9" width="3" height="1" fill="#1E2A38"/><rect x="9" y="10" width="3" height="1" fill="#1E2A38"/><rect x="13" y="10" width="1" height="1" fill="#1E2A38"/>
                    <rect x="9" y="13" width="2" height="1" fill="#1E2A38"/><rect x="13" y="13" width="1" height="1" fill="#1E2A38"/><rect x="16" y="13" width="2" height="1" fill="#1E2A38"/>
                    <rect x="9" y="15" width="2" height="1" fill="#1E2A38"/><rect x="14" y="15" width="1" height="1" fill="#1E2A38"/><rect x="9" y="17" width="1" height="1" fill="#1E2A38"/>
                  </svg>
                </div>
                <div style="flex:1;min-width:140px;">
                  <div style="font-size:11.5px;color:var(--ink-soft);margin-bottom:4px;">Scan QR or pay to UPI ID:</div>
                  <div class="upi-id-display">cgst.kolkata@upi</div>
                  <div style="font-size:11px;color:var(--ink-soft);line-height:1.5;">Pay the estimated total. Exact amount confirmed post-approval.</div>
                </div>
              </div>
              <div class="pay-ref-field">
                <label style="margin-top:12px;">UPI Transaction ID / Reference No. <span style="color:var(--stamp)">*</span></label>
                <input type="text" id="f_upiRef" placeholder="12-digit UTR number" style="font-family:'IBM Plex Mono',monospace;">
                <div class="note">Enter the UTR / reference number from your UPI app after completing payment.</div>
              </div>
            </div>
            <div class="cash-note" id="cashFields">
              <div style="border:1px solid var(--line);background:var(--paper);padding:12px 14px;font-size:13px;line-height:1.7;">
                <b>Pay at the Guest House Counter</b><br>
                Cash is due at check-in. Carry the exact amount. A receipt will be issued by the caretaker.
              </div>
              <label style="margin-top:12px;">Cash Payment Remarks <span style="font-weight:400;color:var(--ink-soft);">(optional)</span></label>
              <input type="text" id="f_cashRemark" placeholder="e.g. Will pay at check-in">
            </div>
          </div>

          <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;align-items:center;">
            <button class="btn" type="submit" id="submitBtn">
              <span id="submitBtnText">Submit Application</span>
              <span class="spinner" id="submitSpinner" style="display:none;"></span>
            </button>
            <button class="btn btn-ghost btn-sm" id="av_resetBtn" type="button">← Change Dates</button>
          </div>
        </form>
      </div>

      <div>
        <div class="vac-card">
          <h3>Room Charges — Kolkata (A‑1/Metro), Rs./day</h3>
          <table class="rate-table">
            <tr><th>Applicant</th><th>Suite</th><th>Room</th></tr>
            <tr><td>Official duty</td><td>450</td><td>350</td></tr>
            <tr><td>Private visit</td><td>600</td><td>400</td></tr>
            <tr><td>Other Govt/PSU/Bank</td><td>1000</td><td>800</td></tr>
            <tr><td>Guest of officer</td><td>750</td><td>600</td></tr>
          </table>
          <div class="note">Inclusive of AC/heater/geyser &amp; service charge. Meals not included.</div>
        </div>
      </div>
    </div>
  </div>`;
}

function attachApplyHandlers() {
  const avCI = document.getElementById('av_ci');
  const avCO = document.getElementById('av_co');
  const avRT = document.getElementById('av_rt');

  avCI.addEventListener('change', () => { avCO.min = avCI.value; });

  /* Availability check */
  document.getElementById('av_checkBtn').addEventListener('click', async () => {
    const ci = avCI.value, co = avCO.value, rt = avRT.value;
    if (!ci || !co || calcNights(ci, co) <= 0) { toast('Select valid check-in and check-out dates.', true); return; }

    const btn = document.getElementById('av_checkBtn');
    btn.disabled = true; btn.textContent = 'Checking…';
    try {
      const data = await api('GET', `/bookings/availability?check_in=${ci}&check_out=${co}&room_type=${rt}`);
      const label = rt === 'suite' ? 'AC Suite' : 'AC Room';

      document.getElementById('av_summary').innerHTML = `
        <div class="avail-badge"><span class="dot ${data.free_count > 0 ? 'dot-ok' : 'dot-full'}"></span>
          <b>${data.free_count}</b> of <b>${data.total_count}</b> ${label}(s) free</div>
        <div class="avail-badge" style="font-size:11.5px;">${fmtDate(ci)} → ${fmtDate(co)} · ${data.nights} night${data.nights === 1 ? '' : 's'}</div>`;

      document.getElementById('av_rooms').innerHTML = data.rooms.map(r =>
        `<span class="avail-room-chip ${r.available ? 'free' : 'busy'}">${escHtml(r.label)}${r.available ? ' ✓' : ' ✕'}</span>`
      ).join('');

      if (data.free_count > 0) {
        document.getElementById('av_proceed_msg').textContent =
          `${data.free_count} room${data.free_count > 1 ? 's are' : ' is'} available. You may proceed.`;
        document.getElementById('av_proceed').classList.add('show');
        document.getElementById('av_blocked').classList.remove('show');
      } else {
        document.getElementById('av_blocked').innerHTML =
          `<b>No ${label}s available</b> for ${fmtDate(ci)} – ${fmtDate(co)}. Please try different dates.`;
        document.getElementById('av_blocked').classList.add('show');
        document.getElementById('av_proceed').classList.remove('show');
      }
      document.getElementById('av_result').classList.add('show');
    } catch (e) { toast(e.message, true); }
    finally { btn.disabled = false; btn.textContent = 'Check'; }
  });

  /* Proceed to form */
  document.getElementById('av_proceedBtn').addEventListener('click', () => {
    const ci = avCI.value, co = avCO.value, rt = avRT.value;
    const wrap = document.getElementById('bookingFormWrap');
    wrap.classList.add('show');

    const fci = document.getElementById('f_checkin');
    const fco = document.getElementById('f_checkout');
    if (fci) { fci.value = ci; }
    if (fco) { fco.value = co; fco.min = ci; }
    document.getElementById('f_group').value = rt === 'suite' ? 'A' : 'BC';

    if (CURRENT_USER) {
      const fn = document.getElementById('f_name');
      const fm = document.getElementById('f_mobile');
      if (fn && !fn.value) fn.value = CURRENT_USER.name;
      if (fm && !fm.value) fm.value = CURRENT_USER.mobile;
    }

    const note = document.getElementById('prefillNote');
    note.textContent = `Dates pre-filled: ${fmtDate(ci)} → ${fmtDate(co)} · ${rt === 'suite' ? 'Group A – AC Suite' : 'Group B & C – AC Room'}`;
    note.style.display = 'block';

    updateRateAndSummary();
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    attachFormHandlers();
  });

  /* Reset dates */
  document.getElementById('av_resetBtn') && document.getElementById('av_resetBtn').addEventListener('click', () => {
    document.getElementById('bookingFormWrap').classList.remove('show');
    document.getElementById('av_result').classList.remove('show');
    document.getElementById('av_proceed').classList.remove('show');
    document.getElementById('av_blocked').classList.remove('show');
    avCI.value = ''; avCO.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function updateRateAndSummary() {
  const type = document.getElementById('f_type')?.value;
  const grp  = document.getElementById('f_group')?.value;
  const ci   = document.getElementById('f_checkin')?.value;
  const co   = document.getElementById('f_checkout')?.value;
  if (!type || !grp) return;

  const rt   = getRoomType(grp);
  const rate = getRate(type, rt);
  const n    = calcNights(ci, co);

  const rateInfo = document.getElementById('rateInfo');
  if (rateInfo) {
    let note = '';
    if (['private','other','guest'].includes(type)) note = 'Max. stay 3 days; extension of 2 days possible if no demand.';
    if (type === 'duty') note = 'Allotted for the duration of the tour.';
    rateInfo.innerHTML = `Applicable rate: <b>Rs. ${rate}/day</b> (${rt === 'suite' ? 'AC Suite' : 'AC Room'}). <i>${note}</i>`;
  }
  const ps = id => document.getElementById(id);
  if (ps('ps_room'))   ps('ps_room').textContent   = rt === 'suite' ? 'AC Suite' : 'AC Room';
  if (ps('ps_rate'))   ps('ps_rate').textContent   = `Rs. ${rate}/day`;
  if (ps('ps_nights')) ps('ps_nights').textContent = n > 0 ? `${n} night${n === 1 ? '' : 's'}` : '—';
  if (ps('ps_total'))  ps('ps_total').textContent  = n > 0 ? `Rs. ${rate * n}` : '—';
}

function attachFormHandlers() {
  ['f_group', 'f_type'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updateRateAndSummary);
  });
  document.getElementById('f_checkin')?.addEventListener('change', () => {
    document.getElementById('f_checkout').min = document.getElementById('f_checkin').value;
    updateRateAndSummary();
  });
  document.getElementById('f_checkout')?.addEventListener('change', updateRateAndSummary);

  /* Payment mode toggle */
  document.querySelectorAll('input[name="payMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const mode = radio.value;
      document.getElementById('upiFields').classList.toggle('show', mode === 'upi');
      document.getElementById('cashFields').classList.toggle('show', mode === 'cash');
      document.getElementById('payOptUpi').classList.toggle('selected', mode === 'upi');
      document.getElementById('payOptCash').classList.toggle('selected', mode === 'cash');
    });
  });

  /* Form submit */
  document.getElementById('applyForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('formErr');
    errEl.style.display = 'none';

    const payMode = document.querySelector('input[name="payMode"]:checked')?.value || 'cash';
    const upiRef  = document.getElementById('f_upiRef')?.value.trim() || '';

    if (payMode === 'upi' && !upiRef) {
      errEl.textContent = 'Please enter the UPI Transaction ID / Reference No.';
      errEl.style.display = 'block';
      document.getElementById('f_upiRef')?.focus();
      return;
    }

    const body = {
      name:        document.getElementById('f_name').value.trim(),
      office:      document.getElementById('f_office').value.trim(),
      grp:         document.getElementById('f_group').value,
      visit_type:  document.getElementById('f_type').value,
      check_in:    document.getElementById('f_checkin').value,
      check_out:   document.getElementById('f_checkout').value,
      mobile:      document.getElementById('f_mobile').value.trim(),
      remarks:     document.getElementById('f_remarks').value.trim(),
      pay_mode:    payMode,
      upi_ref:     upiRef,
      cash_remark: document.getElementById('f_cashRemark')?.value.trim() || '',
    };

    setLoading('submitBtn', 'submitSpinner', true);
    document.getElementById('submitBtnText').textContent = 'Submitting…';
    try {
      await api('POST', '/bookings', body);
      toast('Application submitted! It is now in the JC/ADC approval queue.');
      document.getElementById('applyForm').reset();
      document.getElementById('bookingFormWrap').classList.remove('show');
      document.getElementById('av_result').classList.remove('show');
      document.getElementById('av_proceed').classList.remove('show');
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    } finally {
      setLoading('submitBtn', 'submitSpinner', false);
      document.getElementById('submitBtnText').textContent = 'Submit Application';
    }
  });
}

/* ════════════════════════════════════════════════════════════════
   TAB: APPROVAL DESK
════════════════════════════════════════════════════════════════ */
async function renderApproveAsync(panel) {
  panel.innerHTML = '<div class="empty"><div class="glyph">…</div>Loading queue…</div>';
  try {
    const data = await api('GET', '/bookings/pending');
    const pending = data.bookings;

    if (!pending.length) {
      panel.innerHTML = `<h2 class="section-title">Approval Desk</h2>
        <p class="section-sub">Applications awaiting decision, ordered by rule priority then time of receipt.</p>
        <div class="empty"><div class="glyph">—</div>Queue is clear. No pending applications.</div>`;
      return;
    }

    panel.innerHTML = `
      <h2 class="section-title">Approval Desk</h2>
      <p class="section-sub">Ordered by rule priority then receipt time. Allot a room before approving.</p>
      ${pending.map(b => {
        const type = APPLICANT_TYPES.find(t => t.v === b.visit_type);
        const freeRooms = ROOMS.filter(r => r.type === b.room_type);
        const rate = getRate(b.visit_type, b.room_type);
        const n = calcNights(b.check_in, b.check_out);
        return `
        <div class="queue-item" data-id="${b.id}">
          <div class="queue-head">
            <div>
              <div class="queue-name">${escHtml(b.name)}</div>
              <div class="queue-meta">${escHtml(b.office)} · Group ${b.grp === 'A' ? 'A' : 'B & C'}</div>
            </div>
            <div class="priority-tag">${priorityLabel(type?.priority || 99)}</div>
          </div>
          <div class="queue-body">
            <b>${type?.label || b.visit_type}</b> · ${b.room_type === 'suite' ? 'AC Suite' : 'AC Room'} requested<br>
            Stay: <b>${fmtDate(b.check_in)} → ${fmtDate(b.check_out)}</b> (${n} night${n === 1 ? '' : 's'}) · Rate: <b>Rs. ${rate}/day</b> · Est. total: <b>Rs. ${rate * n}</b><br>
            Mobile: ${escHtml(b.mobile)}${b.remarks ? ' · Remarks: ' + escHtml(b.remarks) : ''}<br>
            Payment: <span class="payment-badge ${b.pay_mode === 'upi' ? 'upi' : 'cash'}">${b.pay_mode === 'upi' ? '📲 UPI' : '💵 Cash'}</span>
            ${b.pay_mode === 'upi' && b.upi_ref ? `&nbsp;· UTR: <b style="font-family:'IBM Plex Mono',monospace;">${escHtml(b.upi_ref)}</b>` : ''}
            ${b.pay_mode === 'cash' && b.cash_remark ? `&nbsp;· ${escHtml(b.cash_remark)}` : ''}
            &nbsp;· Est. payable: <b>Rs. ${b.estimated_total}</b>
          </div>
          <div class="queue-actions">
            <select class="room-select" id="room_${b.id}">
              ${freeRooms.length
                ? freeRooms.map(r => `<option value="${r.id}">${escHtml(r.label)}</option>`).join('')
                : `<option value="">No rooms of this type configured</option>`}
            </select>
            <button class="btn btn-approve btn-sm" data-action="approve" data-id="${b.id}" ${!freeRooms.length ? 'disabled' : ''}>Approve &amp; Allot</button>
            <button class="btn btn-reject btn-sm"  data-action="reject"  data-id="${b.id}">Reject</button>
          </div>
        </div>`;
      }).join('')}`;

    /* Approve / Reject handlers */
    panel.querySelectorAll('[data-action="approve"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id     = btn.dataset.id;
        const roomId = document.getElementById('room_' + id)?.value;
        if (!roomId) { toast('Select a room first.', true); return; }
        btn.disabled = true; btn.textContent = 'Processing…';
        try {
          await api('POST', `/bookings/${id}/approve`, { room_id: roomId });
          const card = panel.querySelector(`.queue-item[data-id="${id}"]`);
          if (card) {
            const stamp = document.createElement('div');
            stamp.className = 'stamp stamp-approved';
            stamp.textContent = 'APPROVED';
            card.appendChild(stamp);
          }
          toast('Approved & allotted. Applicant notified by email.');
          setTimeout(() => renderApproveAsync(panel), 700);
        } catch (e) {
          toast(e.message, true);
          btn.disabled = false; btn.textContent = 'Approve & Allot';
        }
      });
    });

    panel.querySelectorAll('[data-action="reject"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true; btn.textContent = 'Processing…';
        try {
          await api('POST', `/bookings/${id}/reject`);
          const card = panel.querySelector(`.queue-item[data-id="${id}"]`);
          if (card) {
            const stamp = document.createElement('div');
            stamp.className = 'stamp stamp-rejected';
            stamp.textContent = 'REJECTED';
            card.appendChild(stamp);
          }
          toast('Rejected. Applicant notified by email.');
          setTimeout(() => renderApproveAsync(panel), 700);
        } catch (e) {
          toast(e.message, true);
          btn.disabled = false; btn.textContent = 'Reject';
        }
      });
    });

  } catch (e) {
    panel.innerHTML = `<div class="api-error">Could not load approval queue: ${escHtml(e.message)}</div>`;
  }
}

/* ════════════════════════════════════════════════════════════════
   TAB: ALLOTMENT REGISTER
════════════════════════════════════════════════════════════════ */
async function renderRegisterAsync(panel) {
  panel.innerHTML = '<div class="empty"><div class="glyph">…</div>Loading register…</div>';
  try {
    const data = await api('GET', '/bookings');
    const bookings = data.bookings;

    const rows = bookings.map(b => {
      const type = APPLICANT_TYPES.find(t => t.v === b.visit_type);
      const n    = calcNights(b.check_in, b.check_out);
      const rate = getRate(b.visit_type, b.room_type);
      const payLabel = b.pay_mode === 'upi' ? `UPI${b.upi_ref ? ' (' + b.upi_ref + ')' : ''}` : 'Cash';
      return `<tr>
        <td>${escHtml(b.name)}</td>
        <td>${escHtml(b.office)}</td>
        <td>${b.grp === 'A' ? 'A' : 'B&C'}</td>
        <td>${type?.label || b.visit_type}</td>
        <td>${fmtDate(b.check_in)}</td>
        <td>${fmtDate(b.check_out)}</td>
        <td>${n}</td>
        <td>${escHtml(b.room_label || (b.room_type === 'suite' ? 'Suite (unallotted)' : 'Room (unallotted)'))}</td>
        <td>${rate}</td>
        <td>${rate * n}</td>
        <td>${escHtml(payLabel)}</td>
        <td class="status-${b.status}">${b.status.toUpperCase()}</td>
      </tr>`;
    }).join('');

    panel.innerHTML = `
      <h2 class="section-title">Allotment Register</h2>
      <p class="section-sub">Full record of all applications. Per Rule 3 — for internal audit.</p>
      <div class="register-wrap">
        <table class="register">
          <thead><tr>
            <th>Name &amp; Desig.</th><th>Office</th><th>Grp</th><th>Category</th>
            <th>Arrival</th><th>Departure</th><th>Nights</th><th>Room</th>
            <th>Rate/day</th><th>Total (Rs.)</th><th>Payment</th><th>Status</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--ink-soft);">No entries yet.</td></tr>'}</tbody>
        </table>
      </div>`;
  } catch (e) {
    panel.innerHTML = `<div class="api-error">Could not load register: ${escHtml(e.message)}</div>`;
  }
}

/* ════════════════════════════════════════════════════════════════
   TAB: ROOM SETUP
════════════════════════════════════════════════════════════════ */
async function renderRoomsAsync(panel) {
  panel.innerHTML = '<div class="empty"><div class="glyph">…</div>Loading rooms…</div>';
  try {
    const data = await api('GET', '/rooms');
    ROOMS = data.rooms;

    const suites = ROOMS.filter(r => r.type === 'suite');
    const rooms  = ROOMS.filter(r => r.type === 'room');
    const chip   = r => `<div class="room-chip">${escHtml(r.label)} <button data-remove="${r.id}" title="Remove">×</button></div>`;

    panel.innerHTML = `
      <h2 class="section-title">Room Setup</h2>
      <p class="section-sub">Configure the guest house room inventory. Changes take effect immediately.</p>
      <h3 style="font-family:'Source Serif 4',serif;font-size:15px;margin:18px 0 8px;">AC Suites (Group A)</h3>
      <div class="room-list" id="suiteList">${suites.map(chip).join('') || '<span class="note">None configured.</span>'}</div>
      <h3 style="font-family:'Source Serif 4',serif;font-size:15px;margin:18px 0 8px;">AC Rooms (Group B &amp; C)</h3>
      <div class="room-list" id="roomList">${rooms.map(chip).join('') || '<span class="note">None configured.</span>'}</div>
      <div class="api-error" id="roomErr" style="display:none;"></div>
      <div class="add-room-row">
        <div><label>Room label</label><input type="text" id="newRoomLabel" placeholder="e.g. AC Room 204"></div>
        <div><label>Type</label><select id="newRoomType"><option value="room">AC Room</option><option value="suite">AC Suite</option></select></div>
        <button class="btn btn-sm" id="addRoomBtn" type="button">Add Room</button>
      </div>`;

    /* Add room */
    document.getElementById('addRoomBtn').addEventListener('click', async () => {
      const label = document.getElementById('newRoomLabel').value.trim();
      const type  = document.getElementById('newRoomType').value;
      const errEl = document.getElementById('roomErr');
      errEl.style.display = 'none';
      if (!label) { toast('Enter a room label first.', true); return; }
      try {
        await api('POST', '/rooms', { label, type });
        toast('Room added.');
        renderRoomsAsync(panel);
      } catch (e) {
        errEl.textContent = e.message; errEl.style.display = 'block';
      }
    });

    /* Remove rooms */
    panel.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Remove "${btn.closest('.room-chip')?.textContent.trim().slice(0,-1)}"?`)) return;
        try {
          await api('DELETE', '/rooms/' + btn.dataset.remove);
          toast('Room removed.');
          renderRoomsAsync(panel);
        } catch (e) { toast(e.message, true); }
      });
    });

  } catch (e) {
    panel.innerHTML = `<div class="api-error">Could not load rooms: ${escHtml(e.message)}</div>`;
  }
}

/* ════════════════════════════════════════════════════════════════
   INIT — check if already logged in via cookie
════════════════════════════════════════════════════════════════ */
(async function init() {
  try {
    const data = await api('GET', '/auth/me');
    if (data.user) await bootPortal(data.user);
  } catch (e) {
    // Not logged in — login screen is already visible
  }
})();
