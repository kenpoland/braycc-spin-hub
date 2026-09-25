/* BrayCC Admin Panel */

let ADMIN_TOKEN = sessionStorage.getItem('braycc_admin_token') || '';
let adminData = { spins: [], subscriptions: [] };
let subsPanelOpen = false;

function login() {
  const t = document.getElementById('token-input').value.trim();
  if (!t) return;
  ADMIN_TOKEN = t;
  sessionStorage.setItem('braycc_admin_token', t);
  bootAdmin();
}
function logout() {
  sessionStorage.removeItem('braycc_admin_token');
  ADMIN_TOKEN = '';
  document.getElementById('admin-view').classList.add('hidden');
  document.getElementById('login-view').classList.remove('hidden');
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': ADMIN_TOKEN,
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function bootAdmin() {
  try {
    await loadData();
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('admin-view').classList.remove('hidden');
  } catch (err) {
    const el = document.getElementById('login-error');
    el.textContent = err.message;
    el.classList.remove('hidden');
  }
}

async function loadData() {
  const data = await api('/api/admin?full=1');
  adminData = data;
  renderAdmin();
  renderStats();
}

function renderStats() {
  document.getElementById('stat-spins').textContent = adminData.spins.length;
  document.getElementById('stat-riders').textContent =
    adminData.spins.reduce((s, sp) => s + (sp.committed || []).length, 0);
  document.getElementById('stat-subs').textContent = (adminData.subscriptions || []).length;
}

function renderAdmin() {
  const q = (document.getElementById('admin-search').value || '').toLowerCase();
  const filtered = adminData.spins.filter(s => {
    if (!q) return true;
    return (s.title || '').toLowerCase().includes(q)
      || (s.author || '').toLowerCase().includes(q)
      || (s.location || '').toLowerCase().includes(q);
  });
  const container = document.getElementById('admin-spins');
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500">
        <i class="fa-solid fa-bicycle text-4xl text-slate-300 mb-3"></i>
        <p class="font-bold">No spins found</p>
      </div>`;
    return;
  }
  container.innerHTML = filtered.map(renderAdminCard).join('');
}

function renderAdminCard(spin) {
  const committed = spin.committed || [];
  const interested = spin.interested || [];

  const riderRows = committed.length === 0
    ? `<p class="text-xs text-slate-500 italic">No committed riders yet.</p>`
    : committed.map(c => {
        const hasICE = c.ice && c.ice.name && c.ice.phone;
        return `
          <div class="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs flex items-start justify-between gap-2">
            <div class="flex-1">
              <div class="font-bold text-slate-800">${escapeHtml(c.name)}</div>
              ${hasICE ? `
                <div class="text-[11px] text-slate-700 mt-1 space-y-0.5">
                  <div><i class="fa-solid fa-user text-clubPurple mr-1"></i>${escapeHtml(c.ice.name)} ${c.ice.relation ? `<span class="text-slate-500">(${escapeHtml(c.ice.relation)})</span>` : ''}</div>
                  <div><i class="fa-solid fa-phone text-emerald-600 mr-1"></i><a href="tel:${escapeHtml(c.ice.phone)}" class="underline font-semibold">${escapeHtml(c.ice.phone)}</a></div>
                  ${c.ice.notes ? `<div class="italic text-slate-500"><i class="fa-solid fa-notes-medical text-amber-600 mr-1"></i>${escapeHtml(c.ice.notes)}</div>` : ''}
                </div>` : `<div class="text-[11px] text-amber-700 mt-0.5"><i class="fa-solid fa-triangle-exclamation mr-1"></i>No ICE</div>`}
            </div>
            <button onclick="removeRider('${spin.id}', '${escapeJs(c.name)}')" title="Remove rider"
                    class="text-red-600 hover:text-red-800 px-1"><i class="fa-solid fa-user-minus"></i></button>
          </div>`;
      }).join('');

  return `
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="bg-slate-100 px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="bg-purple-900 text-white text-xs font-bold px-2 py-0.5 rounded">${escapeHtml(spin.type)}</span>
          <span class="pace-badge-${spin.pace} text-xs font-bold px-2 py-0.5 rounded">${spin.pace}</span>
          <span class="text-xs text-slate-500 font-mono">${spin.id}</span>
        </div>
        <div class="flex gap-2">
          <button onclick="openEditModal('${spin.id}')" class="px-3 py-1.5 bg-clubBlue hover:bg-clubBlueDark text-white text-xs font-bold rounded-lg transition">
            <i class="fa-solid fa-pen-to-square mr-1"></i>Edit
          </button>
          <button onclick="deleteSpin('${spin.id}')" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition">
            <i class="fa-solid fa-trash mr-1"></i>Delete
          </button>
        </div>
      </div>
      <div class="p-4 space-y-3">
        <div>
          <h3 class="text-lg font-black text-slate-900">${escapeHtml(spin.title)}</h3>
          <div class="text-xs text-slate-600 mt-1 space-y-0.5">
            <div><i class="fa-regular fa-clock text-clubPurple mr-1"></i>${escapeHtml(spin.date)} @ ${escapeHtml(spin.time)}</div>
            <div><i class="fa-solid fa-location-dot text-red-500 mr-1"></i>${escapeHtml(spin.location)} (${escapeHtml(spin.distance)} km)</div>
            <div><i class="fa-solid fa-user text-clubPurple mr-1"></i>${escapeHtml(spin.author)} — ${escapeHtml(spin.phone)}</div>
            <div><i class="fa-solid fa-users text-slate-500 mr-1"></i>Min riders: ${spin.minRiders} &bull; ${escapeHtml(spin.weatherPolicy)} ${spin.mudguardsRequired ? '&bull; Mudguards' : ''}</div>
          </div>
        </div>
        <div>
          <div class="text-xs font-bold text-slate-700 uppercase mb-1.5">Committed Riders (${committed.length})</div>
          <div class="space-y-1.5">${riderRows}</div>
        </div>
        ${interested.length > 0 ? `
          <div>
            <div class="text-xs font-bold text-slate-700 uppercase mb-1">Interested (${interested.length})</div>
            <div class="flex flex-wrap gap-1.5">
              ${interested.map(n => `
                <span class="text-xs bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">${escapeHtml(n)}
                  <button onclick="removeInterested('${spin.id}', '${escapeJs(n)}')" class="ml-1 text-amber-800 hover:text-red-700"><i class="fa-solid fa-xmark"></i></button>
                </span>`).join('')}
            </div>
          </div>` : ''}
      </div>
    </div>`;
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeJs(str) {
  return String(str == null ? '' : str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function openEditModal(id) {
  const spin = adminData.spins.find(s => s.id === id);
  if (!spin) return;
  document.getElementById('edit-id').value = spin.id;
  document.getElementById('edit-title').value = spin.title || '';
  document.getElementById('edit-type').value = spin.type || 'Road';
  document.getElementById('edit-date').value = spin.date || '';
  document.getElementById('edit-time').value = spin.time || '09:00';
  document.getElementById('edit-location').value = spin.location || '';
  document.getElementById('edit-distance').value = spin.distance || 0;
  document.getElementById('edit-pace').value = spin.pace || 'Yellow';
  document.getElementById('edit-minriders').value = spin.minRiders || 3;
  document.getElementById('edit-weather').value = spin.weatherPolicy || 'All-Weather';
  document.getElementById('edit-author').value = spin.author || '';
  document.getElementById('edit-phone').value = spin.phone || '';
  document.getElementById('edit-maplink').value = spin.mapLink || '';
  document.getElementById('edit-mudguards').checked = !!spin.mudguardsRequired;

  const riders = document.getElementById('edit-riders');
  const committed = spin.committed || [];
  if (committed.length === 0) {
    riders.innerHTML = `<p class="text-xs text-slate-500 italic">No committed riders.</p>`;
  } else {
    riders.innerHTML = committed.map((c, idx) => `
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label class="block font-bold text-slate-600 mb-0.5">Rider Name</label>
          <input type="text" value="${escapeHtml(c.name)}" data-idx="${idx}" class="rider-name w-full bg-white border border-slate-300 rounded p-1.5 text-xs">
        </div>
        <div>
          <label class="block font-bold text-slate-600 mb-0.5">ICE Contact Name</label>
          <input type="text" value="${escapeHtml(c.ice?.name || '')}" class="ice-name w-full bg-white border border-slate-300 rounded p-1.5 text-xs">
        </div>
        <div>
          <label class="block font-bold text-slate-600 mb-0.5">ICE Phone</label>
          <input type="tel" value="${escapeHtml(c.ice?.phone || '')}" class="ice-phone w-full bg-white border border-slate-300 rounded p-1.5 text-xs">
        </div>
        <div>
          <label class="block font-bold text-slate-600 mb-0.5">Relationship</label>
          <input type="text" value="${escapeHtml(c.ice?.relation || '')}" class="ice-relation w-full bg-white border border-slate-300 rounded p-1.5 text-xs">
        </div>
        <div class="sm:col-span-2">
          <label class="block font-bold text-slate-600 mb-0.5">Medical Notes</label>
          <input type="text" value="${escapeHtml(c.ice?.notes || '')}" class="ice-notes w-full bg-white border border-slate-300 rounded p-1.5 text-xs">
        </div>
      </div>`).join('');
  }
  document.getElementById('edit-modal').classList.remove('hidden');
}
function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

async function saveEdit() {
  const id = document.getElementById('edit-id').value;
  const riderBlocks = document.querySelectorAll('#edit-riders > div');
  const committed = [];
  riderBlocks.forEach(block => {
    const nameEl = block.querySelector('.rider-name');
    if (!nameEl) return;
    const name = nameEl.value.trim();
    if (!name) return;
    const iceName = block.querySelector('.ice-name')?.value.trim() || '';
    const icePhone = block.querySelector('.ice-phone')?.value.trim() || '';
    const iceRelation = block.querySelector('.ice-relation')?.value.trim() || '';
    const iceNotes = block.querySelector('.ice-notes')?.value.trim() || '';
    const ice = (iceName && icePhone) ? { name: iceName, phone: icePhone, relation: iceRelation, notes: iceNotes } : null;
    committed.push({ name, ice, committedAt: new Date().toISOString() });
  });

  const payload = {
    title: document.getElementById('edit-title').value.trim(),
    type: document.getElementById('edit-type').value.trim(),
    date: document.getElementById('edit-date').value,
    time: document.getElementById('edit-time').value,
    location: document.getElementById('edit-location').value.trim(),
    distance: parseInt(document.getElementById('edit-distance').value, 10) || 0,
    pace: document.getElementById('edit-pace').value,
    minRiders: parseInt(document.getElementById('edit-minriders').value, 10) || 3,
    weatherPolicy: document.getElementById('edit-weather').value,
    mudguardsRequired: document.getElementById('edit-mudguards').checked,
    author: document.getElementById('edit-author').value.trim(),
    phone: document.getElementById('edit-phone').value.trim(),
    mapLink: document.getElementById('edit-maplink').value.trim() || null,
    committed
  };

  try {
    await api('/api/admin?id=' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    closeEditModal();
    await loadData();
  } catch (err) {
    alert('Save failed: ' + err.message);
  }
}

async function deleteSpin(id) {
  if (!confirm('Delete this spin entirely? This cannot be undone.')) return;
  try {
    await api('/api/admin?id=' + encodeURIComponent(id), { method: 'DELETE' });
    await loadData();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}

async function removeRider(spinId, rider) {
  if (!confirm(`Remove ${rider} from the committed riders list?`)) return;
  try {
    await api(`/api/admin?id=${encodeURIComponent(spinId)}&rider=${encodeURIComponent(rider)}`, { method: 'DELETE' });
    await loadData();
  } catch (err) {
    alert('Remove failed: ' + err.message);
  }
}

async function removeInterested(spinId, name) {
  const spin = adminData.spins.find(s => s.id === spinId);
  if (!spin) return;
  const newInterested = (spin.interested || []).filter(n => n !== name);
  try {
    await api('/api/admin?id=' + encodeURIComponent(spinId), {
      method: 'PATCH',
      body: JSON.stringify({ interested: newInterested })
    });
    await loadData();
  } catch (err) {
    alert('Remove failed: ' + err.message);
  }
}

function toggleSubs() {
  subsPanelOpen = !subsPanelOpen;
  const panel = document.getElementById('subs-panel');
  const label = document.getElementById('subs-btn-label');
  if (subsPanelOpen) {
    panel.classList.remove('hidden');
    label.textContent = 'Hide Subscribers';
    const body = document.getElementById('subs-body');
    const subs = adminData.subscriptions || [];
    if (subs.length === 0) {
      body.innerHTML = `<p class="text-slate-500 italic">No subscribers yet.</p>`;
    } else {
      body.innerHTML = subs.map(s => `
        <div class="bg-slate-50 border border-slate-200 rounded p-2">
          <div class="font-mono text-[10px] break-all text-slate-600">${escapeHtml(s.endpoint).slice(0, 90)}…</div>
          <div class="text-[10px] text-slate-500 mt-1">Added: ${escapeHtml(s.addedAt || 'unknown')}</div>
        </div>`).join('');
    }
  } else {
    panel.classList.add('hidden');
    label.textContent = 'View Subscribers';
  }
}

// Auto-login if token cached
if (ADMIN_TOKEN) bootAdmin();