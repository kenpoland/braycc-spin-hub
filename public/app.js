/* =========================================================
   BrayCC Spin Hub - Client logic
   ========================================================= */

const VAPID_PUBLIC_KEY = 'BAmVnXA4DYan8zyZ7Ovo-ickuNlSXN1oGyBKxwAIbeukg5XI4Ao78oO4cEN2rMHj2_vmUv7HdfytUiAUHEVcc7w';

let spinsData = [];
let userRSVPs = {};
let currentUserName = localStorage.getItem('braycc_user') || '';
let currentFormStep = 1;
let selectedPaceInForm = 'Yellow';
let minRidersInForm = 3;
let pendingICECommit = null;
let whatsAppConfig = null;

window.addEventListener('DOMContentLoaded', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('prop-date').value = tomorrow.toISOString().split('T')[0];
  injectProposerModals();
  wireNotificationButton();
  registerServiceWorker();
  loadWhatsAppNumbers();   // ← NEW
  loadSpins();
});

/* ---------- Inject proposer edit + cancel modals ---------- */
function injectProposerModals() {
  const container = document.createElement('div');
  container.innerHTML = `
    <!-- PROPOSER EDIT SPIN MODAL -->
    <div id="edit-spin-modal" class="hidden fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8">
        <div class="bg-gradient-to-r from-clubPurple to-clubBlue p-4 text-white flex items-center justify-between rounded-t-xl">
          <h3 class="font-extrabold flex items-center"><i class="fa-solid fa-pen-to-square mr-2"></i>Edit My Spin</h3>
          <button onclick="closeEditSpinModal()" class="text-white/80 hover:text-white text-lg"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="edit-spin-form" onsubmit="event.preventDefault(); saveProposerEdit();" class="p-5 space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Title</label>
              <input type="text" id="es-title" required class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Date</label>
              <input type="date" id="es-date" required class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Time</label>
              <input type="time" id="es-time" required class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm">
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Location</label>
              <input type="text" id="es-location" required class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Distance (km)</label>
              <input type="number" id="es-distance" required class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Pace</label>
              <select id="es-pace" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm">
                <option value="Red">Red — Leisurely</option>
                <option value="Orange">Orange — Moderate</option>
                <option value="Yellow">Yellow — Steady</option>
                <option value="Green">Green — Brisk</option>
                <option value="Blue">Blue — Fastest</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Min Riders</label>
              <input type="number" id="es-minriders" required class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Weather Policy</label>
              <select id="es-weather" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm">
                <option value="All-Weather">All-Weather</option>
                <option value="Fair-Weather Only">Fair-Weather Only</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">WhatsApp Phone</label>
              <input type="tel" id="es-phone" required class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Map Link</label>
              <input type="url" id="es-maplink" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm">
            </div>
            <div class="sm:col-span-2">
              <label class="inline-flex items-center space-x-2">
                <input type="checkbox" id="es-mudguards" class="w-4 h-4">
                <span class="text-xs font-bold text-slate-800">Mudguards Required</span>
              </label>
            </div>
          </div>
          <div class="bg-amber-50 border-l-4 border-amber-500 p-2.5 rounded text-xs text-slate-700">
            <i class="fa-solid fa-circle-info text-amber-600 mr-1"></i>
            Changes apply immediately. Existing RSVPs and ICE contacts are preserved.
          </div>
          <div class="flex justify-between pt-3 border-t">
            <button type="button" onclick="closeEditSpinModal()" class="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-sm">Cancel</button>
            <button type="submit" class="px-6 py-2 bg-clubBlue hover:bg-clubBlueDark text-white font-bold rounded-lg text-sm">
              <i class="fa-solid fa-save mr-1"></i> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- CONFIRM CANCEL MODAL -->
    <div id="confirm-cancel-modal" class="hidden fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div class="bg-gradient-to-r from-red-600 to-red-700 p-4 text-white rounded-t-xl">
          <h3 class="font-extrabold flex items-center"><i class="fa-solid fa-triangle-exclamation mr-2"></i>Cancel This Spin?</h3>
        </div>
        <div class="p-5 space-y-3">
          <p class="text-sm text-slate-700">This will <strong>permanently delete</strong> the spin, all committed riders, and all ICE contacts collected for it.</p>
          <p class="text-xs text-slate-500">Subscribers with push notifications enabled will be notified that it was cancelled.</p>
          <div class="bg-red-50 border-l-4 border-red-500 p-3 rounded text-xs text-red-900 font-semibold">
            This cannot be undone.
          </div>
        </div>
        <div class="bg-slate-50 p-4 flex justify-end gap-2 border-t rounded-b-xl">
          <button type="button" onclick="closeConfirmCancel()" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-sm">Keep Spin</button>
          <button type="button" id="confirm-cancel-btn" class="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm">
            <i class="fa-solid fa-trash mr-1"></i> Yes, Cancel Spin
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(container);
}

/* ---------- Tabs ---------- */
function switchTab(tabName) {
  const upcomingBtn = document.getElementById('tab-upcoming-btn');
  const proposeBtn = document.getElementById('tab-propose-btn');
  const upcomingView = document.getElementById('view-upcoming');
  const proposeView = document.getElementById('view-propose');
  if (tabName === 'upcoming') {
    upcomingBtn.classList.add('active'); upcomingBtn.classList.remove('text-purple-200');
    proposeBtn.classList.remove('active'); proposeBtn.classList.add('text-purple-200');
    upcomingView.classList.remove('hidden'); proposeView.classList.add('hidden');
  } else {
    proposeBtn.classList.add('active'); proposeBtn.classList.remove('text-purple-200');
    upcomingBtn.classList.remove('active'); upcomingBtn.classList.add('text-purple-200');
    proposeView.classList.remove('hidden'); upcomingView.classList.add('hidden');
  }
}

/* ---------- Load spins ---------- */
async function loadSpins() {
  const loading = document.getElementById('loading-spins');
  try {
    const res = await fetch('/api/spins');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    spinsData = data.spins || [];
    userRSVPs = {};
    spinsData.forEach((s) => {
      const committedNames = (s.committed || []).map(c => typeof c === 'string' ? c : c.name);
      if (currentUserName && committedNames.includes(currentUserName)) userRSVPs[s.id] = 'committed';
      else if (currentUserName && (s.interested || []).includes(currentUserName)) userRSVPs[s.id] = 'interested';
    });
    if (loading) loading.classList.add('hidden');
    renderSpins();
  } catch (err) {
    if (loading) loading.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation text-3xl text-red-500 mb-3"></i>
      <p class="font-bold text-slate-700">Could not load spins</p>
      <p class="text-xs mt-1">${escapeHtml(err.message)}</p>`;
  }
}

/* ---------- Render ---------- */
function renderSpins() {
  const container = document.getElementById('spins-list-container');
  const noSpinsNotice = document.getElementById('no-spins-notice');
  const filterType = document.getElementById('filter-type').value;
  const filterPace = document.getElementById('filter-pace').value;
  document.getElementById('spin-count-badge').textContent = spinsData.length;
  const filtered = spinsData.filter((s) => {
    const mType = filterType === 'ALL' || s.type === filterType;
    const mPace = filterPace === 'ALL' || s.pace === filterPace;
    return mType && mPace;
  });
  if (filtered.length === 0) {
    container.innerHTML = ''; noSpinsNotice.classList.remove('hidden'); return;
  }
  noSpinsNotice.classList.add('hidden');
  container.innerHTML = filtered.map(renderSpinCard).join('');
}

function renderSpinCard(spin) {
  const isCommitted = userRSVPs[spin.id] === 'committed';
  const isInterested = userRSVPs[spin.id] === 'interested';
  const committedArr = (spin.committed || []).map(c => typeof c === 'string' ? { name: c } : c);
  const totalCommitted = committedArr.length;
  const totalInterested = (spin.interested || []).length;
  const quorumMet = totalCommitted >= spin.minRiders;
  const dateObj = new Date(spin.date + 'T' + spin.time);
  const formattedDate = dateObj.toLocaleDateString('en-IE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
  const mapBtn = spin.mapLink
    ? `<a href="${spin.mapLink}" target="_blank" rel="noopener" class="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 transition">
         <i class="fa-solid fa-map-location-dot text-clubBlue mr-1.5"></i> Route Map</a>` : '';
  const mudguardBadge = spin.mudguardsRequired
    ? `<span class="bg-slate-200 text-slate-800 text-xs font-bold px-2 py-1 rounded-md border border-slate-300">
         <i class="fa-solid fa-shield-halved text-clubPurple mr-1"></i> Mudguards</span>` : '';
  const weatherBadge = spin.weatherPolicy === 'All-Weather'
    ? `<span class="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold px-2.5 py-1 rounded-md">
         <i class="fa-solid fa-cloud-showers-heavy mr-1"></i> All-Weather</span>`
    : `<span class="bg-sky-100 text-sky-900 border border-sky-300 text-xs font-extrabold px-2.5 py-1 rounded-md">
         <i class="fa-solid fa-sun mr-1"></i> Fair-Weather Only</span>`;
  const quorumBadge = quorumMet
    ? `<span class="bg-green-100 text-green-800 text-xs font-black px-2 py-0.5 rounded-full border border-green-300"><i class="fa-solid fa-check mr-1"></i> Confirmed (${totalCommitted}/${spin.minRiders} min riders)</span>`
    : `<span class="bg-amber-100 text-amber-800 text-xs font-black px-2 py-0.5 rounded-full border border-amber-300"><i class="fa-solid fa-hourglass-half mr-1"></i> Needs ${Math.max(0, spin.minRiders - totalCommitted)} more rider(s)</span>`;
  const phoneDigits = String(spin.phone || '').replace(/[^0-9]/g, '');
  const waHref = `https://wa.me/${phoneDigits}?text=${encodeURIComponent("Hi " + spin.author + ", I'm asking about the BrayCC spin: " + spin.title)}`;
  const hasAnyICE = committedArr.some(c => c.hasICE);
  const isProposer = currentUserName && currentUserName.toLowerCase() === String(spin.author).toLowerCase();
  const iceBtn = (isProposer && hasAnyICE)
    ? `<button onclick="viewICEContacts('${spin.id}')"
               class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-1">
         <i class="fa-solid fa-heart-pulse"></i><span>ICE Contacts</span></button>` : '';
    const totalRSVPs = committedArr.length + totalInterested;
  const proposerBtns = isProposer
    ? `<button onclick="openWAGroupModal('${spin.id}')"
               class="px-3 py-1.5 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-1">
         <i class="fa-brands fa-whatsapp"></i><span>WhatsApp Group</span></button>
       <button onclick="openEditSpinModal('${spin.id}')"
               class="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-1">
         <i class="fa-solid fa-pen-to-square"></i><span>Edit</span></button>
       <button onclick="openConfirmCancel('${spin.id}')"
               class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-1">
         <i class="fa-solid fa-trash"></i><span>Cancel</span></button>` : '';

  return `
    <div class="bg-white rounded-xl border border-slate-200 shadow-md hover:shadow-lg transition overflow-hidden ${isProposer ? 'ring-2 ring-clubPurple/20' : ''}">
      <div class="bg-slate-100 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center space-x-2">
          <span class="bg-purple-900 text-white text-xs font-bold px-2.5 py-1 rounded-md flex items-center">
            <i class="${getSpinTypeIcon(spin.type)} mr-1.5"></i> ${escapeHtml(spin.type)}</span>
          <span class="pace-badge-${spin.pace} text-xs font-bold px-2.5 py-1 rounded-md">${spin.pace} Pace</span>
          ${isProposer ? `<span class="bg-purple-100 text-clubPurple text-[10px] font-black uppercase px-2 py-1 rounded border border-purple-300"><i class="fa-solid fa-star mr-1"></i>Yours</span>` : ''}
        </div>
        <div class="flex items-center space-x-2">${mudguardBadge}${weatherBadge}</div>
      </div>
      <div class="p-5">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 class="text-xl font-black text-slate-900">${escapeHtml(spin.title)}</h3>
            <div class="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs font-semibold text-slate-600 mt-2">
              <span class="text-purple-800 font-bold"><i class="fa-regular fa-clock text-clubPurple mr-1"></i> ${formattedDate} @ ${spin.time}</span>
              <span><i class="fa-solid fa-location-dot text-red-500 mr-1"></i> ${escapeHtml(spin.location)}</span>
              <span><i class="fa-solid fa-route text-clubBlue mr-1"></i> ${spin.distance} km</span>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">${mapBtn}${iceBtn}</div>
        </div>
        <div class="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <div class="flex items-center space-x-2">
              <span class="text-xs font-bold text-slate-500">Ride Status:</span>${quorumBadge}</div>
            <div class="text-xs text-slate-600 mt-1">
              <span class="font-bold text-slate-800">${totalCommitted}</span> Committed &bull;
              <span class="font-bold text-slate-800">${totalInterested}</span> Interested</div>
          </div>
          <div class="flex items-center justify-between md:justify-end space-x-3">
            <div class="text-left md:text-right">
              <span class="block text-[10px] uppercase font-bold text-slate-400">Proposed by</span>
              <span class="text-xs font-extrabold text-slate-800">${escapeHtml(spin.author)}</span></div>
            <a href="${waHref}" target="_blank" rel="noopener"
               class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-1">
              <i class="fa-brands fa-whatsapp text-sm"></i><span>WhatsApp</span></a>
          </div>
        </div>
        <div class="mt-4 bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span class="text-xs font-extrabold text-slate-700 uppercase">Your Attendance:</span>
          <div class="flex items-center space-x-2 w-full sm:w-auto">
            <button onclick="toggleRSVP('${spin.id}', 'committed')"
                    class="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 ${isCommitted ? 'bg-emerald-600 text-white shadow' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'}">
              <i class="fa-solid fa-circle-check"></i><span>Committed (Turning Up)</span></button>
            <button onclick="toggleRSVP('${spin.id}', 'interested')"
                    class="flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1 ${isInterested ? 'bg-amber-500 text-white shadow' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'}">
              <i class="fa-solid fa-star"></i><span>Interested</span></button>
          </div>
        </div>
        ${isProposer ? `
          <div class="mt-3 pt-3 border-t border-dashed border-purple-200 flex flex-wrap gap-2 items-center">
            <span class="text-[10px] font-black uppercase text-clubPurple">Organiser Tools:</span>
            ${proposerBtns}
          </div>` : ''}
      </div>
    </div>`;
}

function getSpinTypeIcon(type) {
  switch (type) {
    case 'Road': return 'fa-solid fa-road';
    case 'Off-Road (MTB / Gravel)': return 'fa-solid fa-mountain';
    case 'Away Day': return 'fa-solid fa-van-shuttle';
    case 'Evening Spin': return 'fa-solid fa-moon';
    case 'Weekday Spin': return 'fa-solid fa-calendar-day';
    case 'Audax': return 'fa-solid fa-compass';
    case 'Touring': return 'fa-solid fa-route';
    case 'Virtual': return 'fa-solid fa-laptop';
    default: return 'fa-solid fa-bicycle';
  }
}
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- RSVP ---------- */
async function toggleRSVP(spinId, rsvpType) {
  if (!currentUserName) {
    const name = prompt('Enter your name to RSVP:');
    if (!name || !name.trim()) return;
    currentUserName = name.trim();
    localStorage.setItem('braycc_user', currentUserName);
  }

  // If already in this state → toggle off (no modal needed)
  if (userRSVPs[spinId] === rsvpType) {
    const newAction = 'none';
    try {
      const res = await fetch('/api/spins?id=' + encodeURIComponent(spinId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: newAction, user: currentUserName })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'HTTP ' + res.status);
      }
      const { spin } = await res.json();
      const idx = spinsData.findIndex((s) => s.id === spinId);
      if (idx !== -1) spinsData[idx] = spin;
      userRSVPs[spinId] = 'none';
      renderSpins();
    } catch (err) {
      alert('Could not update RSVP: ' + err.message);
    }
    return;
  }

  // Otherwise open the modal for phone (+ ICE if committing)
  openICEModal(spinId, rsvpType);
}

/* ---------- ICE modals ---------- */
let pendingRSVP = null;   // { spinId, rsvpType }

function openICEModal(spinId, rsvpType) {
  const spin = spinsData.find(s => s.id === spinId);
  if (!spin) return;
  pendingRSVP = { spinId, rsvpType };

  const modal = document.getElementById('ice-modal');
  const form = document.getElementById('ice-form');
  form.reset();

  // Adjust modal contents for the type
  const title = document.getElementById('rsvp-modal-title');
  const subtitle = document.getElementById('rsvp-modal-subtitle');
  const iceSection = document.getElementById('rsvp-ice-section');
  const submitBtn = document.getElementById('rsvp-submit-btn');

  if (rsvpType === 'committed') {
    title.textContent = 'Confirm Your Commitment';
    subtitle.textContent = 'Your phone and emergency contact are required.';
    iceSection.classList.remove('hidden');
    document.getElementById('ice-name').required = true;
    document.getElementById('ice-phone').required = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i><span>Confirm &amp; Commit</span>';
  } else {
    title.textContent = 'Mark as Interested';
    subtitle.textContent = 'We just need your WhatsApp number.';
    iceSection.classList.add('hidden');
    document.getElementById('ice-name').required = false;
    document.getElementById('ice-phone').required = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-star"></i><span>Save Interest</span>';
  }

  // Prefill phone if we have one saved
  const savedPhone = localStorage.getItem('braycc_user_phone') || '';
  document.getElementById('rsvp-user-phone').value = savedPhone;

  modal.classList.remove('hidden');
}

function closeICEModal() {
  pendingRSVP = null;
  document.getElementById('ice-modal').classList.add('hidden');
}

async function submitRSVPWithDetails() {
  if (!pendingRSVP) return;
  const { spinId, rsvpType } = pendingRSVP;

  const phone = document.getElementById('rsvp-user-phone').value.trim();
  if (!phone) {
    alert('Please enter your phone number.');
    return;
  }
  localStorage.setItem('braycc_user_phone', phone);

  const payload = {
    action: rsvpType,
    user: currentUserName,
    phone
  };

  if (rsvpType === 'committed') {
    const ice = {
      name: document.getElementById('ice-name').value.trim(),
      phone: document.getElementById('ice-phone').value.trim(),
      relation: document.getElementById('ice-relation').value,
      notes: document.getElementById('ice-notes').value.trim()
    };
    if (!ice.name || !ice.phone) {
      alert('Please enter both the ICE contact name and phone.');
      return;
    }
    payload.ice = ice;
  }

  try {
    const res = await fetch('/api/spins?id=' + encodeURIComponent(spinId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'HTTP ' + res.status);
    }
    const { spin } = await res.json();
    const idx = spinsData.findIndex((s) => s.id === spinId);
    if (idx !== -1) spinsData[idx] = spin;
    userRSVPs[spinId] = rsvpType;
    closeICEModal();
    renderSpins();
  } catch (err) {
    alert('Could not save: ' + err.message);
  }
}
async function viewICEContacts(spinId) {
  const body = document.getElementById('ice-view-body');
  body.innerHTML = `<div class="text-center text-slate-500 py-6"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;
  document.getElementById('ice-view-modal').classList.remove('hidden');
  try {
    const res = await fetch(`/api/ice?id=${encodeURIComponent(spinId)}&user=${encodeURIComponent(currentUserName)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'HTTP ' + res.status);
    }
    const { contacts } = await res.json();
    if (!contacts || contacts.length === 0) {
      body.innerHTML = `<p class="text-sm text-slate-500 text-center py-6">No ICE contacts recorded yet.</p>`;
      return;
    }
    body.innerHTML = contacts.map(c => `
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-3">
        <div class="flex items-center justify-between">
          <span class="font-extrabold text-slate-900 text-sm">${escapeHtml(c.rider)}</span>
          ${c.ice.relation ? `<span class="text-[10px] uppercase font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">${escapeHtml(c.ice.relation)}</span>` : ''}
        </div>
        <div class="text-xs text-slate-700 mt-2 space-y-0.5">
          <div><i class="fa-solid fa-user text-clubPurple mr-1"></i> <strong>${escapeHtml(c.ice.name)}</strong></div>
          <div><i class="fa-solid fa-phone text-emerald-600 mr-1"></i> <a href="tel:${escapeHtml(c.ice.phone)}" class="font-bold text-emerald-700 underline">${escapeHtml(c.ice.phone)}</a></div>
          ${c.ice.notes ? `<div class="mt-1 text-[11px] italic text-slate-600"><i class="fa-solid fa-notes-medical text-amber-600 mr-1"></i>${escapeHtml(c.ice.notes)}</div>` : ''}
        </div>
      </div>`).join('');
  } catch (err) {
    body.innerHTML = `<p class="text-sm text-red-600 text-center py-6">${escapeHtml(err.message)}</p>`;
  }
}
function closeICEViewModal() {
  document.getElementById('ice-view-modal').classList.add('hidden');
}

/* ---------- Proposer Edit ---------- */
function openEditSpinModal(spinId) {
  const spin = spinsData.find(s => s.id === spinId);
  if (!spin) return;
  document.getElementById('es-title').value = spin.title || '';
  document.getElementById('es-date').value = spin.date || '';
  document.getElementById('es-time').value = spin.time || '09:00';
  document.getElementById('es-location').value = spin.location || '';
  document.getElementById('es-distance').value = spin.distance || 0;
  document.getElementById('es-pace').value = spin.pace || 'Yellow';
  document.getElementById('es-minriders').value = spin.minRiders || 3;
  document.getElementById('es-weather').value = spin.weatherPolicy || 'All-Weather';
  document.getElementById('es-phone').value = spin.phone || '';
  document.getElementById('es-maplink').value = spin.mapLink || '';
  document.getElementById('es-mudguards').checked = !!spin.mudguardsRequired;
  document.getElementById('edit-spin-form').dataset.spinId = spinId;
  document.getElementById('edit-spin-modal').classList.remove('hidden');
}
function closeEditSpinModal() {
  document.getElementById('edit-spin-modal').classList.add('hidden');
}
async function saveProposerEdit() {
  const spinId = document.getElementById('edit-spin-form').dataset.spinId;
  const payload = {
    _edit: true,
    _requester: currentUserName,
    author: currentUserName,
    title: document.getElementById('es-title').value.trim(),
    date: document.getElementById('es-date').value,
    time: document.getElementById('es-time').value,
    location: document.getElementById('es-location').value.trim(),
    distance: parseInt(document.getElementById('es-distance').value, 10) || 0,
    pace: document.getElementById('es-pace').value,
    minRiders: parseInt(document.getElementById('es-minriders').value, 10) || 3,
    weatherPolicy: document.getElementById('es-weather').value,
    phone: document.getElementById('es-phone').value.trim(),
    mapLink: document.getElementById('es-maplink').value.trim() || null,
    mudguardsRequired: document.getElementById('es-mudguards').checked
  };
  try {
    const res = await fetch('/api/spins?id=' + encodeURIComponent(spinId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'HTTP ' + res.status);
    }
    const { spin } = await res.json();
    const idx = spinsData.findIndex((s) => s.id === spinId);
    if (idx !== -1) spinsData[idx] = spin;
    closeEditSpinModal();
    renderSpins();
  } catch (err) {
    alert('Could not save: ' + err.message);
  }
}

/* ---------- Proposer Cancel ---------- */
function openConfirmCancel(spinId) {
  const btn = document.getElementById('confirm-cancel-btn');
  btn.onclick = () => cancelSpin(spinId);
  document.getElementById('confirm-cancel-modal').classList.remove('hidden');
}
function closeConfirmCancel() {
  document.getElementById('confirm-cancel-modal').classList.add('hidden');
}
async function cancelSpin(spinId) {
  try {
    const res = await fetch('/api/spins?id=' + encodeURIComponent(spinId) + '&user=' + encodeURIComponent(currentUserName), {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'HTTP ' + res.status);
    }
    spinsData = spinsData.filter(s => s.id !== spinId);
    delete userRSVPs[spinId];
    closeConfirmCancel();
    renderSpins();
  } catch (err) {
    alert('Could not cancel: ' + err.message);
  }
}

/* ---------- Filters ---------- */
function applyFilters() { renderSpins(); }
function resetFilters() {
  document.getElementById('filter-type').value = 'ALL';
  document.getElementById('filter-pace').value = 'ALL';
  renderSpins();
}

/* ---------- Form nav ---------- */
function goToStep(stepNumber) {
  if (stepNumber > currentFormStep && !validateStep(currentFormStep)) return;
  document.getElementById('form-step-' + currentFormStep).classList.add('hidden');
  document.getElementById('form-step-' + stepNumber).classList.remove('hidden');
  for (let i = 1; i <= 4; i++) {
    const label = document.getElementById('step-label-' + i);
    if (i === stepNumber) label.className = 'text-clubPurple font-extrabold';
    else if (i < stepNumber) label.className = 'text-emerald-600 font-bold';
    else label.className = 'text-slate-400';
  }
  currentFormStep = stepNumber;
  if (stepNumber === 4) populateReviewCard();
}
function validateStep(step) {
  if (step === 1) {
    const title = document.getElementById('prop-title').value.trim();
    const dist = document.getElementById('prop-distance').value;
    const date = document.getElementById('prop-date').value;
    const location = document.getElementById('prop-location').value.trim();
    if (!title || !dist || !date || !location) {
      alert('Please fill in all required fields (Title, Distance, Date, Location).');
      return false;
    }
  } else if (step === 3) {
    const author = document.getElementById('prop-author').value.trim();
    const phone = document.getElementById('prop-phone').value.trim();
    if (!author || !phone) { alert('Please enter your name and WhatsApp contact phone number.'); return false; }
  }
  return true;
}
function selectPace(paceColor) {
  ['Red', 'Orange', 'Yellow', 'Green', 'Blue'].forEach((p) => {
    const el = document.getElementById('pace-opt-' + p);
    if (el) el.classList.remove('selected');
  });
  const chosen = document.getElementById('pace-opt-' + paceColor);
  if (chosen) chosen.classList.add('selected');
  selectedPaceInForm = paceColor;
}
function adjustMinRiders(delta) {
  minRidersInForm = Math.max(1, minRidersInForm + delta);
  document.getElementById('prop-min-riders-display').textContent = minRidersInForm;
}
function populateReviewCard() {
  const spinType = document.querySelector('input[name="spinType"]:checked').value;
  const title = document.getElementById('prop-title').value;
  const distance = document.getElementById('prop-distance').value;
  const date = document.getElementById('prop-date').value;
  const time = document.getElementById('prop-time').value;
  const location = document.getElementById('prop-location').value;
  const weatherPolicy = document.querySelector('input[name="weatherPolicy"]:checked').value;
  const mudguards = document.getElementById('prop-mudguards').checked;
  const author = document.getElementById('prop-author').value;
  const phone = document.getElementById('prop-phone').value;
  const container = document.getElementById('review-card-container');
  container.innerHTML = `
    <div class="flex flex-wrap items-center gap-2">
      <span class="bg-purple-900 text-white text-xs font-bold px-2 py-0.5 rounded">${escapeHtml(spinType)}</span>
      <span class="pace-badge-${selectedPaceInForm} text-xs font-bold px-2 py-0.5 rounded">${selectedPaceInForm} Pace</span>
      <span class="bg-slate-200 text-slate-800 text-xs font-bold px-2 py-0.5 rounded">${escapeHtml(weatherPolicy)}</span>
      ${mudguards ? `<span class="bg-slate-200 text-slate-800 text-xs font-bold px-2 py-0.5 rounded"><i class="fa-solid fa-shield-halved text-clubPurple mr-1"></i> Mudguards Required</span>` : ''}
    </div>
    <h4 class="text-lg font-black text-slate-900 mt-1">${escapeHtml(title)}</h4>
    <div class="text-xs text-slate-600 space-y-1">
      <p><strong>When:</strong> ${escapeHtml(date)} at ${escapeHtml(time)}</p>
      <p><strong>Start:</strong> ${escapeHtml(location)} (${escapeHtml(distance)} km)</p>
      <p><strong>Minimum Riders Required:</strong> ${minRidersInForm} riders</p>
      <p><strong>Proposer Contact:</strong> ${escapeHtml(author)} (${escapeHtml(phone)})</p>
    </div>`;
}
async function submitSpinProposal() {
  const payload = {
    title: document.getElementById('prop-title').value.trim(),
    type: document.querySelector('input[name="spinType"]:checked').value,
    date: document.getElementById('prop-date').value,
    time: document.getElementById('prop-time').value,
    location: document.getElementById('prop-location').value.trim(),
    distance: parseInt(document.getElementById('prop-distance').value, 10),
    mapLink: document.getElementById('prop-map-link').value.trim() || null,
    pace: selectedPaceInForm,
    minRiders: minRidersInForm,
    weatherPolicy: document.querySelector('input[name="weatherPolicy"]:checked').value,
    mudguardsRequired: document.getElementById('prop-mudguards').checked,
    author: document.getElementById('prop-author').value.trim(),
    phone: document.getElementById('prop-phone').value.trim()
  };
  try {
    const res = await fetch('/api/spins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const raw = err.error || `HTTP ${res.status}`;
      const friendly = /522|502|503|504/.test(raw)
        ? 'The club server is temporarily unavailable. Please try again in a minute.' : raw;
      throw new Error(friendly);
    }
    const { spin } = await res.json();
    spinsData.unshift(spin);
    currentUserName = spin.author;
    localStorage.setItem('braycc_user', currentUserName);
    userRSVPs[spin.id] = 'committed';
    document.getElementById('propose-spin-form').reset();
    document.getElementById('prop-min-riders-display').textContent = '3';
    minRidersInForm = 3;
    selectPace('Yellow');
    currentFormStep = 1;
    goToStep(1);
    renderSpins();
    switchTab('upcoming');
    alert('Success! Your spin has been published to the club hub.');
  } catch (err) {
    alert('Failed to publish: ' + err.message);
  }
}

/* ---------- PWA / push ---------- */
function wireNotificationButton() {
  const btn = document.getElementById('enable-notifications');
  if (!btn) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { btn.style.display = 'none'; return; }
  btn.addEventListener('click', enablePush);
}
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      const btn = document.getElementById('enable-notifications');
      if (btn) { btn.innerHTML = '<i class="fa-solid fa-bell"></i><span>Alerts On</span>'; btn.classList.add('opacity-70'); }
    }
  } catch (err) { console.warn('SW registration failed:', err); }
}
async function enablePush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { alert('Push not supported.'); return; }
    const reg = await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { alert('Notifications were blocked.'); return; }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const btn = document.getElementById('enable-notifications');
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-bell"></i><span>Alerts On</span>'; btn.classList.add('opacity-70'); }
    alert('You will now be notified about new club spins!');
  } catch (err) { alert('Could not enable alerts: ' + err.message); }
}
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
/* ---------- Floating WhatsApp contact ---------- */

async function loadWhatsAppNumbers() {
  try {
    const res = await fetch('/whatsapp-numbers.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    whatsAppConfig = await res.json();

    // Reveal the button once we know a config exists
    const btn = document.getElementById('wa-float-btn');
    if (btn && whatsAppConfig && Array.isArray(whatsAppConfig.contacts) && whatsAppConfig.contacts.length > 0) {
      btn.classList.remove('hidden');
    }
  } catch (err) {
    console.warn('WhatsApp config not loaded:', err.message);
    // Button stays hidden — silent failure, no UI noise
  }
}

function openWhatsAppPicker() {
  if (!whatsAppConfig || !Array.isArray(whatsAppConfig.contacts)) {
    alert('No contact numbers configured yet.');
    return;
  }

  // Set heading + intro from config
  document.getElementById('wa-picker-heading').textContent =
    whatsAppConfig.heading || 'Contact the club on WhatsApp';
  document.getElementById('wa-picker-intro').textContent =
    whatsAppConfig.intro || '';

  const defaultMsg = whatsAppConfig.defaultMessage || 'Hi, I have a question about BrayCC.';

  // Render the list of contact rows
  const list = document.getElementById('wa-picker-list');
  list.innerHTML = whatsAppConfig.contacts.map(c => {
    const digits = String(c.phone || '').replace(/[^0-9]/g, '');
    const href = `https://wa.me/${digits}?text=${encodeURIComponent(defaultMsg)}`;
    return `
      <a href="${href}" target="_blank" rel="noopener"
         class="flex items-center justify-between gap-3 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl p-3 transition group">
        <div class="flex items-center gap-3 min-w-0">
          <div class="bg-[#25D366] group-hover:bg-[#1DA851] w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
            <i class="fa-brands fa-whatsapp text-white text-xl"></i>
          </div>
          <div class="min-w-0">
            <div class="text-xs font-black uppercase tracking-wide text-slate-500">${escapeHtml(c.label || 'Contact')}</div>
            <div class="font-extrabold text-slate-900 text-sm truncate">${escapeHtml(c.name || '')}</div>
            ${c.description ? `<div class="text-[11px] text-slate-500 truncate">${escapeHtml(c.description)}</div>` : ''}
          </div>
        </div>
        <i class="fa-solid fa-chevron-right text-slate-400 group-hover:text-emerald-600"></i>
      </a>
    `;
  }).join('');

  document.getElementById('wa-picker-modal').classList.remove('hidden');
}

function closeWhatsAppPicker() {
  document.getElementById('wa-picker-modal').classList.add('hidden');
}

// Close picker when tapping the backdrop
document.addEventListener('click', (e) => {
  const modal = document.getElementById('wa-picker-modal');
  if (!modal || modal.classList.contains('hidden')) return;
  if (e.target === modal) closeWhatsAppPicker();
});

// Escape key closes picker
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('wa-picker-modal');
    if (modal && !modal.classList.contains('hidden')) closeWhatsAppPicker();
  }

  /* ---------- Proposer: WhatsApp group builder ---------- */

async function openWAGroupModal(spinId) {
  const body = document.getElementById('wa-group-body');
  body.innerHTML = `<div class="text-center text-slate-500 py-6"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>`;
  document.getElementById('wa-group-modal').classList.remove('hidden');

  try {
    const res = await fetch(
      `/api/spins?waGroup=1&id=${encodeURIComponent(spinId)}&user=${encodeURIComponent(currentUserName)}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'HTTP ' + res.status);
    }
    const { contacts, suggestedMessage } = await res.json();

    if (!contacts || contacts.length === 0) {
      body.innerHTML = `
        <p class="text-sm text-slate-600">No phone numbers yet — nobody who's RSVP'd has shared a number.</p>
        <p class="text-xs text-slate-500 mt-2">As riders commit or mark interest, their numbers will appear here.</p>`;
      return;
    }

    const numbersOnly = contacts.map(c => c.phone).join(', ');

    body.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs font-black uppercase tracking-wide text-slate-500">
          <span>Riders (${contacts.length})</span>
          <button onclick="copyAllPhoneNumbers()" class="text-[#25D366] hover:text-[#1DA851] flex items-center gap-1">
            <i class="fa-solid fa-copy"></i> Copy all numbers
          </button>
        </div>
        <div id="wa-contacts-list" class="space-y-1.5 max-h-64 overflow-y-auto">
          ${contacts.map(c => `
            <div class="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
              <div class="min-w-0">
                <div class="text-sm font-bold text-slate-900 truncate">${escapeHtml(c.name)}</div>
                <div class="text-[11px] font-mono text-slate-600">${escapeHtml(c.phone)}</div>
              </div>
              <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded ${c.status === 'Committed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">${c.status}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="border-t pt-3">
        <div class="text-xs font-black uppercase tracking-wide text-slate-500 mb-1.5">Suggested group message</div>
        <textarea id="wa-suggested-msg" readonly rows="6" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-mono">${escapeHtml(suggestedMessage)}</textarea>
        <button onclick="copySuggestedMessage()" class="mt-2 w-full px-3 py-2 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1">
          <i class="fa-solid fa-copy"></i> Copy message for group description
        </button>
      </div>

      <details class="text-xs">
        <summary class="cursor-pointer font-bold text-slate-700 hover:text-clubPurple">How to create the WhatsApp group</summary>
        <ol class="list-decimal pl-5 mt-2 space-y-1 text-slate-600">
          <li>Open WhatsApp → New Group</li>
          <li>Add each number above as a participant</li>
          <li>Name the group: <strong>${escapeHtml(contacts.length ? 'BrayCC: ' : '')}${escapeHtml(suggestedMessage.split('\\n')[0].replace('🚴 ', ''))}</strong></li>
          <li>Paste the suggested message as the group description</li>
          <li>Send — everyone's notified</li>
        </ol>
      </details>

      <input type="hidden" id="wa-hidden-numbers" value="${escapeHtml(numbersOnly)}">
    `;
  } catch (err) {
    body.innerHTML = `<p class="text-sm text-red-600">${escapeHtml(err.message)}</p>`;
  }
}

function closeWAGroupModal() {
  document.getElementById('wa-group-modal').classList.add('hidden');
}

function copyAllPhoneNumbers() {
  const el = document.getElementById('wa-hidden-numbers');
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(
    () => alert('Phone numbers copied to clipboard.'),
    () => alert('Copy failed — please copy the numbers manually.')
  );
}

function copySuggestedMessage() {
  const el = document.getElementById('wa-suggested-msg');
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(
    () => alert('Message copied to clipboard.'),
    () => alert('Copy failed — please copy the message manually.')
  );
}
});