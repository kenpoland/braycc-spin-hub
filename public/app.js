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
let pendingRSVP = null;
let whatsAppConfig = null;
let rwgpsEnabled = false;
window.addEventListener('DOMContentLoaded', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('prop-date').value = tomorrow.toISOString().split('T')[0];
  injectProposerModals();
  wireNotificationButton();
  registerServiceWorker();
  loadWhatsAppNumbers();
  loadRwgpsJoinLink();         // ← NEW
  loadRwgpsConfig();          // ← NEW
  loadSpins();
});

/* ---------- Proposer edit + cancel modals injected into DOM ---------- */
function injectProposerModals() {
  const container = document.createElement('div');
  container.innerHTML = `
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
  const challengesBtn = document.getElementById('tab-challenges-btn');
  const proposeBtn = document.getElementById('tab-propose-btn');
  const upcomingView = document.getElementById('view-upcoming');
  const challengesView = document.getElementById('view-challenges');
  const detailView = document.getElementById('view-challenge-detail');
  const proposeView = document.getElementById('view-propose');

  // Reset all buttons
  [upcomingBtn, challengesBtn, proposeBtn].forEach(btn => {
    if (btn) {
      btn.classList.remove('active');
      btn.classList.add('text-purple-200');
    }
  });

  // Hide all views
  [upcomingView, challengesView, detailView, proposeView].forEach(v => {
    if (v) v.classList.add('hidden');
  });

  // Activate selected
  if (tabName === 'upcoming' && upcomingBtn && upcomingView) {
    upcomingBtn.classList.add('active');
    upcomingBtn.classList.remove('text-purple-200');
    upcomingView.classList.remove('hidden');
  } else if (tabName === 'challenges' && challengesBtn && challengesView) {
    challengesBtn.classList.add('active');
    challengesBtn.classList.remove('text-purple-200');
    challengesView.classList.remove('hidden');
    loadChallenges();
  } else if (tabName === 'propose' && proposeBtn && proposeView) {
    proposeBtn.classList.add('active');
    proposeBtn.classList.remove('text-purple-200');
    proposeView.classList.remove('hidden');
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
      const interestedNames = (s.interested || []).map(i => typeof i === 'string' ? i : i.name);
      if (currentUserName && committedNames.includes(currentUserName)) userRSVPs[s.id] = 'committed';
      else if (currentUserName && interestedNames.includes(currentUserName)) userRSVPs[s.id] = 'interested';
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
  handleDeepLink();
}


function renderSpinCard(spin) {
  const isCommitted = userRSVPs[spin.id] === 'committed';
  const isInterested = userRSVPs[spin.id] === 'interested';
  const committedArr = (spin.committed || []).map(c => typeof c === 'string' ? { name: c } : c);
  const interestedArr = (spin.interested || []).map(i => typeof i === 'string' ? { name: i } : i);
  const totalCommitted = committedArr.length;
  const totalInterested = interestedArr.length;
  const quorumMet = totalCommitted >= spin.minRiders;
  const dateObj = new Date(spin.date + 'T' + spin.time);
  const formattedDate = dateObj.toLocaleDateString('en-IE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });
  const mapBtn = spin.mapLink
    ? `<a href="${spin.mapLink}" target="_blank" rel="noopener" class="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 transition">
         <i class="fa-solid fa-map-location-dot text-clubBlue mr-1.5"></i> Route Map</a>` : '';
      const shareBtn = `
    <button onclick="shareSpin('${spin.id}')" type="button" title="Share this spin"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-full text-xs font-bold shadow-sm transition flex-shrink-0">
      <i class="fa-solid fa-share-nodes text-xs"></i>
      <span>Share</span>
    </button>`;
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
    : `<span class="bg-red-100 text-red-800 text-xs font-black px-2 py-0.5 rounded-full border border-red-300"><i class="fa-solid fa-circle-exclamation mr-1"></i> Needs ${Math.max(0, spin.minRiders - totalCommitted)} more rider(s)</span>`;
    const phoneDigits = String(spin.phone || '').replace(/[^0-9]/g, '');
    const waHref = `https://wa.me/${phoneDigits}?text=${encodeURIComponent("Hi " + spin.author + ", I'm asking about the BrayCC spin: " + spin.title)}`;
  const hasAnyICE = committedArr.some(c => c.hasICE);
  const isProposer = currentUserName && currentUserName.toLowerCase() === String(spin.author).toLowerCase();
  const iceBtn = (isProposer && hasAnyICE)
    ? `<button onclick="viewICEContacts('${spin.id}')"
               class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-1">
         <i class="fa-solid fa-heart-pulse"></i><span>ICE Contacts</span></button>` : '';
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
    <div data-spin-id="${spin.id}" class="bg-white rounded-xl border border-slate-200 shadow-md hover:shadow-lg transition overflow-hidden ${isProposer ? 'ring-2 ring-clubPurple/20' : ''}">
            <div class="bg-slate-100 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center space-x-2 flex-wrap">
          <span class="bg-purple-900 text-white text-xs font-bold px-2.5 py-1 rounded-md flex items-center">
            <i class="${getSpinTypeIcon(spin.type)} mr-1.5"></i> ${escapeHtml(spin.type)}</span>
          <span class="pace-badge-${spin.pace} text-xs font-bold px-2.5 py-1 rounded-md">${spin.pace} Pace</span>
          ${isProposer ? `<span class="bg-purple-100 text-clubPurple text-[10px] font-black uppercase px-2 py-1 rounded border border-purple-300"><i class="fa-solid fa-star mr-1"></i>Yours</span>` : ''}
        </div>
        <div class="flex items-center gap-2">
          ${mudguardBadge}${weatherBadge}${shareBtn}
        </div>
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

        <div class="mt-4 pt-4 border-t border-slate-100">
          <div class="text-xs font-extrabold text-slate-700 uppercase mb-3 flex items-center">
            <i class="fa-solid fa-hand-pointer text-clubPurple mr-2"></i> Your Attendance
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onclick="toggleRSVP('${spin.id}', 'committed')" type="button"
                    class="text-left px-4 py-3 rounded-xl font-bold transition-all flex items-start gap-3 ${isCommitted ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-700' : 'bg-white border-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-500'}">
              <div class="flex-shrink-0 mt-0.5">
                <i class="fa-solid fa-circle-check text-2xl"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-extrabold text-sm">${isCommitted ? 'Committed ✓ (tap to undo)' : 'Commit to this spin'}</div>
                <div class="text-[11px] font-normal mt-1 leading-snug ${isCommitted ? 'text-emerald-100' : 'text-emerald-700/80'}">
                  I'm definitely turning up. Adds me to the WhatsApp group and collects my emergency contact.
                </div>
              </div>
            </button>
            <button onclick="toggleRSVP('${spin.id}', 'interested')" type="button"
                    class="text-left px-4 py-3 rounded-xl font-bold transition-all flex items-start gap-3 ${isInterested ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-600' : 'bg-white border-2 border-amber-300 text-amber-800 hover:bg-amber-50 hover:border-amber-500'}">
              <div class="flex-shrink-0 mt-0.5">
                <i class="fa-solid fa-star text-2xl"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-extrabold text-sm">${isInterested ? 'Interested ★ (tap to undo)' : 'Mark as interested'}</div>
                <div class="text-[11px] font-normal mt-1 leading-snug ${isInterested ? 'text-amber-100' : 'text-amber-700/80'}">
                  I might join — keep me posted on updates. Adds my phone for the group.
                </div>
              </div>
            </button>
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
  // Toggle OFF if already in this state
  if (userRSVPs[spinId] === rsvpType) {
    try {
      const res = await fetch('/api/spins?id=' + encodeURIComponent(spinId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'none', user: currentUserName })
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
  // Open modal for phone (+ ICE if committing)
  openRSVPModal(spinId, rsvpType);
}

/* ---------- RSVP modal ---------- */
function openRSVPModal(spinId, rsvpType) {
  const spin = spinsData.find(s => s.id === spinId);
  if (!spin) return;
  pendingRSVP = { spinId, rsvpType };

  const form = document.getElementById('ice-form');
  form.reset();

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

  const savedPhone = localStorage.getItem('braycc_user_phone') || '';
  document.getElementById('rsvp-user-phone').value = savedPhone;

  document.getElementById('ice-modal').classList.remove('hidden');
}

function closeICEModal() {
  pendingRSVP = null;
  document.getElementById('ice-modal').classList.add('hidden');
}

async function submitRSVPWithDetails() {
  if (!pendingRSVP) return;
  const { spinId, rsvpType } = pendingRSVP;

  const phone = document.getElementById('rsvp-user-phone').value.trim();
  if (!phone) { alert('Please enter your phone number.'); return; }
  localStorage.setItem('braycc_user_phone', phone);

  const payload = { action: rsvpType, user: currentUserName, phone };

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

/* ---------- View ICE ---------- */
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

/* ---------- Proposer: WhatsApp group builder ---------- */
async function openWAGroupModal(spinId) {
  const body = document.getElementById('wa-group-body');
  if (!body) { alert('Modal missing — please refresh the page.'); return; }
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
        <div class="space-y-1.5 max-h-64 overflow-y-auto">
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
        <textarea id="wa-suggested-msg" readonly rows="6" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs font-mono">${escapeHtml(suggestedMessage || '')}</textarea>
        <button onclick="copySuggestedMessage()" class="mt-2 w-full px-3 py-2 bg-[#25D366] hover:bg-[#1DA851] text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1">
          <i class="fa-solid fa-copy"></i> Copy message for group description
        </button>
      </div>

      <details class="text-xs">
        <summary class="cursor-pointer font-bold text-slate-700 hover:text-clubPurple">How to create the WhatsApp group</summary>
        <ol class="list-decimal pl-5 mt-2 space-y-1 text-slate-600">
          <li>Open WhatsApp → New Group</li>
          <li>Add each number above as a participant</li>
          <li>Name the group: <strong>BrayCC Spin</strong></li>
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
  const m = document.getElementById('wa-group-modal');
  if (m) m.classList.add('hidden');
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

/* ---------- Floating WhatsApp contact ---------- */
async function loadWhatsAppNumbers() {
  try {
    const res = await fetch('/whatsapp-numbers.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    whatsAppConfig = await res.json();
    const btn = document.getElementById('wa-float-btn');
    if (btn && whatsAppConfig && Array.isArray(whatsAppConfig.contacts) && whatsAppConfig.contacts.length > 0) {
      btn.classList.remove('hidden');
    }
  } catch (err) {
    console.warn('WhatsApp config not loaded:', err.message);
  }
}
function openWhatsAppPicker() {
  if (!whatsAppConfig || !Array.isArray(whatsAppConfig.contacts)) { alert('No contact numbers configured yet.'); return; }
  document.getElementById('wa-picker-heading').textContent = whatsAppConfig.heading || 'Contact the club on WhatsApp';
  document.getElementById('wa-picker-intro').textContent = whatsAppConfig.intro || '';
  const defaultMsg = whatsAppConfig.defaultMessage || 'Hi, I have a question about BrayCC.';
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
      </a>`;
  }).join('');
  document.getElementById('wa-picker-modal').classList.remove('hidden');
}
function closeWhatsAppPicker() {
  document.getElementById('wa-picker-modal').classList.add('hidden');
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
    const reg = await navigator.serviceWorker.register('/sw.js?v=3');
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

/* ---------- Backdrop close for picker ---------- */
document.addEventListener('click', (e) => {
  const modal = document.getElementById('wa-picker-modal');
  if (!modal || modal.classList.contains('hidden')) return;
  if (e.target === modal) closeWhatsAppPicker();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('wa-picker-modal');
    if (modal && !modal.classList.contains('hidden')) closeWhatsAppPicker();
    const waModal = document.getElementById('wa-group-modal');
    if (waModal && !waModal.classList.contains('hidden')) closeWAGroupModal();
  }
});
/* =========================================================
   CHALLENGES — Part A (list + detail view)
   ========================================================= */

let challengesData = [];
let currentChallengeDetail = null;

async function loadChallenges() {
  const loading = document.getElementById('challenges-loading');
  const list = document.getElementById('challenges-list');
  const empty = document.getElementById('challenges-empty');

  if (loading) loading.classList.remove('hidden');
  if (list) list.innerHTML = '';
  if (empty) empty.classList.add('hidden');

  try {
    const res = await fetch('/api/challenges');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    challengesData = data.challenges || [];
    renderChallenges();
  } catch (err) {
    if (list) {
      list.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-xl p-5 text-center text-red-800 md:col-span-2">
          <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
          <p class="font-bold">Could not load challenges</p>
          <p class="text-xs mt-1">${escapeHtml(err.message)}</p>
        </div>`;
    }
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

function renderChallenges() {
  const list = document.getElementById('challenges-list');
  const empty = document.getElementById('challenges-empty');

  if (!challengesData || challengesData.length === 0) {
    if (list) list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  list.innerHTML = challengesData.map(renderChallengeCard).join('');
}

function renderChallengeCard(c) {
  const headerClass = {
    red:    'bg-red-600',
    purple: 'bg-purple-700',
    blue:   'bg-blue-600',
    green:  'bg-emerald-600',
    amber:  'bg-amber-500'
  }[c.badgeColor] || 'bg-clubPurple';

  const typeIcon = {
    distance: 'fa-bullseye',
    monthly: 'fa-bicycle',
    series: 'fa-clover',
    custom: 'fa-star'
  }[c.type] || 'fa-trophy';

  const typeLabel = {
    distance: 'Distance',
    monthly: 'Monthly',
    series: 'Series',
    custom: 'Custom'
  }[c.type] || c.type;

  let targetLine = '';
  let targetIcon = 'fa-bullseye';
  if (c.type === 'distance' && c.targetKm) {
    targetLine = `${c.targetKm} km`;
  } else if (c.type === 'monthly' && c.ridesRequired && c.minDistancePerRide) {
    targetLine = `${c.minDistancePerRide} km per month`;
  } else if (c.type === 'series') {
    targetLine = 'Complete the full series';
    targetIcon = 'fa-flag-checkered';
  } else {
    targetLine = 'See description';
  }

  let datesLine = '';
  if (c.windowStart && c.windowEnd) {
    const fmt = (d) => {
      const dt = new Date(d + 'T12:00:00');
      if (isNaN(dt.getTime())) return d;
      return dt.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    datesLine = `${fmt(c.windowStart)} – ${fmt(c.windowEnd)}`;
  } else {
    datesLine = 'Rolling — no end date';
  }

  const pendingBadge = c.pending
    ? `<span class="bg-white/25 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">Pending Review</span>`
    : '';

  return `
    <div class="bg-white rounded-xl border border-slate-200 shadow-md hover:shadow-lg transition overflow-hidden cursor-pointer"
         onclick="openChallengeDetail('${c.id}')">
      <div class="${headerClass} px-4 py-3 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <i class="fa-solid ${typeIcon} text-white text-lg flex-shrink-0"></i>
          <h3 class="font-black text-white text-base leading-tight truncate">${escapeHtml(c.title)}</h3>
          ${pendingBadge}
        </div>
        <button onclick="event.stopPropagation(); shareChallenge('${c.id}');" type="button" title="Share this challenge"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-full text-xs font-bold shadow-sm transition flex-shrink-0">
          <i class="fa-solid fa-share-nodes text-xs"></i>
          <span class="hidden sm:inline">Share</span>
        </button>
      </div>
      <div class="p-4 space-y-3">
        ${c.org ? `<div class="text-sm text-slate-700"><span class="text-slate-500">Organiser:</span> <strong>${escapeHtml(c.org)}</strong></div>` : ''}
        <p class="text-sm text-slate-700 leading-snug">${escapeHtml(c.description || '')}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
          <div class="flex items-center gap-2 text-slate-700">
            <i class="fa-solid ${targetIcon} text-red-500"></i>
            <span><strong>Target:</strong> ${escapeHtml(targetLine)}</span>
          </div>
          <div class="flex items-center gap-2 text-slate-700">
            <i class="fa-regular fa-calendar text-slate-500"></i>
            <span><strong>Dates:</strong> ${escapeHtml(datesLine)}</span>
          </div>
        </div>
      </div>
    </div>`;
}


async function openChallengeDetail(challengeId) {
  await loadRwgpsConfig();   // ← NEW
  // Switch views
  document.getElementById('view-challenges').classList.add('hidden');
  document.getElementById('view-challenge-detail').classList.remove('hidden');

  const header = document.getElementById('challenge-detail-header');
  const rulesList = document.getElementById('challenge-rules-list');
  const linkContainer = document.getElementById('challenge-link-container');
  const yourProgress = document.getElementById('challenge-your-progress');
  const leaderboard = document.getElementById('challenge-leaderboard');

  header.innerHTML = `<div class="p-5 text-center text-slate-500"><i class="fa-solid fa-spinner fa-spin text-3xl"></i></div>`;
  rulesList.innerHTML = '';
  linkContainer.innerHTML = '';
  yourProgress.innerHTML = '';
  leaderboard.innerHTML = '';

  try {
    const res = await fetch('/api/challenges?id=' + encodeURIComponent(challengeId));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { challenge, entries } = await res.json();
    currentChallengeDetail = { challenge, entries };
    renderChallengeDetailHeader(challenge);
    renderChallengeRules(challenge);
    renderChallengeYourProgress(challenge, entries);
    renderChallengeLeaderboard(challenge, entries);
  } catch (err) {
    header.innerHTML = `
      <div class="bg-red-50 p-5 text-red-800">
        <p class="font-bold">Could not load challenge</p>
        <p class="text-xs mt-1">${escapeHtml(err.message)}</p>
      </div>`;
  }
}

function renderChallengeDetailHeader(c) {
  const colorClass = {
    red:    'from-red-500 to-red-600',
    purple: 'from-purple-600 to-purple-700',
    blue:   'from-blue-500 to-blue-600',
    green:  'from-emerald-500 to-emerald-600',
    amber:  'from-amber-500 to-amber-600'
  }[c.badgeColor] || 'from-clubPurple to-clubBlue';

  const typeLabel = { distance: 'Distance', monthly: 'Monthly', series: 'Series', custom: 'Custom' }[c.type] || c.type;

  let target = '';
  if (c.type === 'distance' && c.targetKm) target = `🎯 Target: ${c.targetKm} km`;
  else if (c.type === 'monthly' && c.ridesRequired) target = `🎯 ${c.ridesRequired} qualifying rides of ${c.minDistancePerRide} km`;
  else if (c.type === 'series') target = '🎯 Complete the full series';

  const header = document.getElementById('challenge-detail-header');
  header.innerHTML = `
    <div class="bg-gradient-to-r ${colorClass} p-6 text-white">
      <div class="flex items-center gap-2 mb-2">
        <span class="bg-white/20 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">${typeLabel}</span>
        ${c.org ? `<span class="text-xs text-white/90">${escapeHtml(c.org)}</span>` : ''}
      </div>
      <h1 class="text-2xl md:text-3xl font-black">${escapeHtml(c.title)}</h1>
      <p class="text-sm text-white/90 mt-2">${escapeHtml(c.description || '')}</p>
      ${target ? `<div class="mt-3 inline-block bg-white/20 rounded-lg px-3 py-1.5 text-sm font-bold">${target}</div>` : ''}
    </div>`;
}

function renderChallengeRules(c) {
  const rulesList = document.getElementById('challenge-rules-list');
  const rules = Array.isArray(c.rules) && c.rules.length
    ? c.rules
    : ['No specific rules — see description above.'];
  rulesList.innerHTML = rules.map(r =>
    `<li class="flex items-start gap-2">
       <i class="fa-solid fa-check-circle text-emerald-500 mt-0.5 flex-shrink-0"></i>
       <span>${escapeHtml(r)}</span>
     </li>`
  ).join('');

  const linkContainer = document.getElementById('challenge-link-container');
  linkContainer.innerHTML = c.link
    ? `<a href="${c.link}" target="_blank" rel="noopener"
           class="inline-flex items-center px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-sm font-bold border border-slate-300 transition">
         <i class="fa-solid fa-arrow-up-right-from-square mr-2 text-clubBlue"></i>
         Official rules &amp; info
       </a>`
    : '';
}

function renderChallengeYourProgress(challenge, entries) {
  const box = document.getElementById('challenge-your-progress');
  renderRwgpsConnectBlock(challenge.id);

  const myEntry = currentUserName
    ? entries.find(e => String(e.memberName).toLowerCase() === currentUserName.toLowerCase())
    : null;

  if (!currentUserName) {
    box.innerHTML = `
      <p class="text-sm text-slate-600 mb-3">Set your name to start tracking this challenge.</p>
      <button onclick="promptForName()" class="w-full px-4 py-2 bg-clubPurple hover:bg-clubPurpleDark text-white font-bold rounded-lg text-sm">
        <i class="fa-solid fa-user mr-1"></i> Set My Name
      </button>`;
    return;
  }

  if (!myEntry) {
    box.innerHTML = `
      <p class="text-sm text-slate-600 mb-3">You haven't joined this challenge yet.</p>
      <button onclick="joinChallenge('${challenge.id}')" class="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm">
        <i class="fa-solid fa-plus mr-1"></i> Join Challenge
      </button>`;
    return;
  }

  const progressHtml = getProgressHtml(challenge, myEntry);
  box.innerHTML = `
    ${progressHtml}
    <div class="mt-4 pt-4 border-t border-slate-100 space-y-2">
      <button onclick="openLogProgressModal('${challenge.id}')" class="w-full px-4 py-2 bg-clubPurple hover:bg-clubPurpleDark text-white font-bold rounded-lg text-sm">
        <i class="fa-solid fa-plus-circle mr-1"></i> Log Progress
      </button>
      <button onclick="leaveChallenge('${challenge.id}')" class="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm text-xs">
        <i class="fa-solid fa-right-from-bracket mr-1"></i> Leave challenge
      </button>
    </div>`;
}

function getProgressHtml(challenge, entry) {
  if (challenge.type === 'distance') {
    const pct = challenge.targetKm ? Math.min(100, Math.round((entry.totalKm / challenge.targetKm) * 100)) : 0;
    return `
      <div class="text-center mb-3">
        <div class="text-3xl font-black text-clubPurple">${entry.totalKm || 0}</div>
        <div class="text-xs font-bold text-slate-500 uppercase">of ${challenge.targetKm} km</div>
      </div>
      <div class="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
        <div class="bg-gradient-to-r from-clubPurple to-clubBlue h-3 rounded-full transition-all" style="width:${pct}%"></div>
      </div>
      <div class="text-center text-xs font-bold text-slate-600">${pct}% complete</div>`;
  }

  if (challenge.type === 'monthly') {
    const ridesCount = (entry.rides || []).length;
    const pct = challenge.ridesRequired ? Math.min(100, Math.round((ridesCount / challenge.ridesRequired) * 100)) : 0;
    return `
      <div class="text-center mb-3">
        <div class="text-3xl font-black text-clubPurple">${ridesCount}</div>
        <div class="text-xs font-bold text-slate-500 uppercase">of ${challenge.ridesRequired} months</div>
      </div>
      <div class="w-full bg-slate-100 rounded-full h-3 mb-2 overflow-hidden">
        <div class="bg-gradient-to-r from-clubPurple to-clubBlue h-3 rounded-full transition-all" style="width:${pct}%"></div>
      </div>
      <div class="text-center text-xs font-bold text-slate-600">${pct}% complete</div>`;
  }

  if (challenge.type === 'series') {
    const ridesCount = (entry.seriesRides || []).length;
    return `
      <div class="text-center">
        <div class="text-3xl font-black text-clubPurple">${ridesCount}</div>
        <div class="text-xs font-bold text-slate-500 uppercase">Rides logged</div>
      </div>`;
  }

  return `<p class="text-sm text-slate-600">Progress tracking available.</p>`;
}

async function renderChallengeLeaderboard(challenge, entries) {
  const lb = document.getElementById('challenge-leaderboard');
  lb.innerHTML = `<p class="text-sm text-slate-500 text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i> Loading leaderboard...</p>`;

  const start = challenge.windowStart || '1900-01-01';
  const end = challenge.windowEnd || '2100-12-31';

  let rwgpsMembers = [];
  if (rwgpsEnabled) {
    try {
      const r = await fetch(`/api/rwgps-rides?start=${start}&end=${end}`);
      if (r.ok) {
        const d = await r.json();
        rwgpsMembers = d.members || [];
      }
    } catch (e) { /* ignore */ }
  }

  const combined = {};
  entries.forEach(e => {
    combined[e.memberName] = {
      name: e.memberName,
      manual: scoreEntryValue(challenge, e),
      rwgps: 0
    };
  });
  rwgpsMembers.forEach(m => {
    if (!combined[m.memberName]) combined[m.memberName] = { name: m.memberName, manual: 0, rwgps: 0 };
    combined[m.memberName].rwgps = m.totalKm;
  });

  const scored = Object.values(combined).map(c => {
    const value = Math.max(c.manual, c.rwgps);
    return { name: c.name, value, source: c.rwgps > c.manual ? 'rwgps' : 'manual' };
  }).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

  if (scored.length === 0) {
    lb.innerHTML = `<p class="text-sm text-slate-500 text-center py-4">No entries yet — be the first!</p>`;
    return;
  }

  lb.innerHTML = scored.map((s, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
    const isMe = currentUserName && s.name.toLowerCase() === currentUserName.toLowerCase();
    return `
      <div class="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 ${isMe ? 'bg-purple-50 -mx-2 px-2 rounded' : ''}">
        <div class="flex items-center gap-3">
          <span class="text-lg font-black text-slate-400 w-8 text-center">${medal}</span>
          <span class="font-bold text-slate-800 ${isMe ? 'text-clubPurple' : ''}">${escapeHtml(s.name)}${isMe ? ' (you)' : ''}</span>
          ${s.source === 'rwgps' ? `<span class="text-[9px] bg-orange-100 text-orange-800 font-black uppercase px-1.5 py-0.5 rounded">RWGPS</span>` : ''}
        </div>
        <span class="font-black text-slate-700">${Math.round(s.value * 10) / 10} km</span>
      </div>`;
  }).join('');
}

function backToChallenges() {
  document.getElementById('view-challenge-detail').classList.add('hidden');
  document.getElementById('view-challenges').classList.remove('hidden');
  loadChallenges();
}

function promptForName() {
  const name = prompt('Enter your name:');
  if (!name || !name.trim()) return;
  currentUserName = name.trim();
  localStorage.setItem('braycc_user', currentUserName);
  if (currentChallengeDetail) {
    openChallengeDetail(currentChallengeDetail.challenge.id);
  }
}

/* =========================================================
   CHALLENGES — Part B (join, log, leave, propose)
   ========================================================= */

async function joinChallenge(challengeId) {
  if (!currentUserName) {
    const name = prompt('Enter your name to join this challenge:');
    if (!name || !name.trim()) return;
    currentUserName = name.trim();
    localStorage.setItem('braycc_user', currentUserName);
  }
  try {
    const res = await fetch('/api/challenges?action=join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, memberName: currentUserName })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'HTTP ' + res.status);
    }
    // Reload the detail view to show "Your Progress"
    openChallengeDetail(challengeId);
  } catch (err) {
    alert('Could not join: ' + err.message);
  }
}

async function leaveChallenge(challengeId) {
  if (!currentUserName) return;
  if (!confirm('Leave this challenge? Your progress will be removed.')) return;
  try {
    const res = await fetch(
      '/api/challenges?challengeId=' + encodeURIComponent(challengeId) +
      '&memberName=' + encodeURIComponent(currentUserName),
      { method: 'DELETE' }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'HTTP ' + res.status);
    }
    openChallengeDetail(challengeId);
  } catch (err) {
    alert('Could not leave: ' + err.message);
  }
}

/* ---------- Log progress modal ---------- */
function openLogProgressModal(challengeId) {
  const challenge = currentChallengeDetail && currentChallengeDetail.challenge;
  if (!challenge) return;
  document.getElementById('log-challenge-id').value = challengeId;
  document.getElementById('log-fields-container').innerHTML = buildLogFields(challenge);
  document.getElementById('log-progress-modal').classList.remove('hidden');
}

function closeLogProgressModal() {
  document.getElementById('log-progress-modal').classList.add('hidden');
}

function buildLogFields(challenge) {
  const today = new Date().toISOString().slice(0, 10);

  if (challenge.type === 'distance') {
    return `
          ${challenge.windowStart && challenge.windowEnd ? `
        <div class="bg-amber-50 border-l-4 border-amber-500 p-3 rounded text-xs text-slate-700 mb-3">
          <i class="fa-solid fa-calendar text-amber-600 mr-1"></i>
          <strong>This challenge only accepts rides between ${challenge.windowStart} and ${challenge.windowEnd}.</strong>
        </div>
      ` : ''}
      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Date</label>
        <input type="date" id="log-date" value="${today}" required class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm">
      </div>
      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Distance (km) <span class="text-red-500">*</span></label>
        <input type="number" id="log-km" step="0.1" min="0.1" required placeholder="e.g., 42" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm">
      </div>
      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Note (optional)</label>
        <input type="text" id="log-note" placeholder="e.g., Sunday club spin" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm">
      </div>`;
  }

  if (challenge.type === 'monthly') {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `
      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Month <span class="text-red-500">*</span></label>
        <input type="month" id="log-month" value="${thisMonth}" required class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm">
        <p class="text-[11px] text-slate-500 mt-1">The month in which you rode the qualifying brevet.</p>
      </div>
      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Distance (km) <span class="text-red-500">*</span></label>
        <input type="number" id="log-distance" min="${challenge.minDistancePerRide || 100}" required placeholder="e.g., ${challenge.minDistancePerRide || 100}" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm">
        <p class="text-[11px] text-slate-500 mt-1">Minimum ${challenge.minDistancePerRide || 100} km for this challenge.</p>
      </div>
      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Note (optional)</label>
        <input type="text" id="log-note" placeholder="e.g., Wicklow 200 Permanent" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm">
      </div>`;
  }

  if (challenge.type === 'series') {
    return `
      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Ride Name <span class="text-red-500">*</span></label>
        <input type="text" id="log-ride-name" required placeholder="e.g., 200km Brevet — Wicklow" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Date</label>
          <input type="date" id="log-date" value="${today}" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Distance (km)</label>
          <input type="number" id="log-distance" min="0" placeholder="e.g., 200" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm">
        </div>
      </div>
      <div>
        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Note (optional)</label>
        <input type="text" id="log-note" placeholder="e.g., Finished in 11h 20m" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm">
      </div>`;
  }

  return `
    <div>
      <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Note <span class="text-red-500">*</span></label>
      <input type="text" id="log-note" required placeholder="Describe what you did" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm">
    </div>`;
}

async function saveLogProgress() {
  if (!currentUserName) { alert('Set your name first.'); return; }
  const challengeId = document.getElementById('log-challenge-id').value;
  const challenge = currentChallengeDetail && currentChallengeDetail.challenge;
  if (!challenge) return;

  try {
    let url = '/api/challenges?action=';
    let payload = { challengeId, memberName: currentUserName };

    if (challenge.type === 'distance') {
      const km = parseFloat(document.getElementById('log-km').value);
      if (!km || km <= 0) { alert('Enter a distance.'); return; }
      payload.km = km;
      payload.date = document.getElementById('log-date').value;
      payload.note = (document.getElementById('log-note').value || '').trim();
      url += 'log-distance';
    } else if (challenge.type === 'monthly') {
      const month = document.getElementById('log-month').value;
      const distance = parseFloat(document.getElementById('log-distance').value);
      if (!month || !distance) { alert('Enter month and distance.'); return; }
      if (distance < (challenge.minDistancePerRide || 0)) {
        alert(`Distance must be at least ${challenge.minDistancePerRide} km.`);
        return;
      }
      payload.month = month;
      payload.distance = distance;
      payload.note = (document.getElementById('log-note').value || '').trim();
      url += 'log-ride';
    } else if (challenge.type === 'series') {
      const rideName = (document.getElementById('log-ride-name').value || '').trim();
      if (!rideName) { alert('Enter the ride name.'); return; }
      payload.rideName = rideName;
      payload.date = document.getElementById('log-date').value;
      payload.distance = parseFloat(document.getElementById('log-distance').value) || null;
      payload.note = (document.getElementById('log-note').value || '').trim();
      url += 'log-series-ride';
    } else {
      payload.note = document.getElementById('log-note').value;
      alert('Custom challenge logging not yet supported.');
      return;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'HTTP ' + res.status);
    }
    closeLogProgressModal();
    openChallengeDetail(challengeId);
  } catch (err) {
    alert('Could not save: ' + err.message);
  }
}

/* ---------- Propose a challenge ---------- */
function openProposeChallengeModal() {
  document.getElementById('propose-challenge-form').reset();
  document.getElementById('pc-author').value = currentUserName || '';
  document.getElementById('pc-phone').value = localStorage.getItem('braycc_user_phone') || '';
  document.getElementById('propose-challenge-modal').classList.remove('hidden');
}

function closeProposeChallengeModal() {
  document.getElementById('propose-challenge-modal').classList.add('hidden');
}

async function submitChallengeProposal() {
  const title = document.getElementById('pc-title').value.trim();
  const org = document.getElementById('pc-org').value.trim();
  const type = document.getElementById('pc-type').value;
  const description = document.getElementById('pc-description').value.trim();
  const rulesText = document.getElementById('pc-rules').value.trim();
  const windowStart = document.getElementById('pc-window-start').value || null;
  const windowEnd = document.getElementById('pc-window-end').value || null;
  const link = document.getElementById('pc-link').value.trim() || null;
  const proposedBy = document.getElementById('pc-author').value.trim();
  const proposedByPhone = document.getElementById('pc-phone').value.trim();

  if (!title || !description || !proposedBy) {
    alert('Please fill in title, description, and your name.');
    return;
  }
  const rules = rulesText
    ? rulesText.split('\n').map(r => r.trim()).filter(Boolean)
    : [];

  try {
    const res = await fetch('/api/challenges?action=propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, org, type, description, link, rules,
        windowStart, windowEnd, proposedBy, proposedByPhone
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'HTTP ' + res.status);
    }
    closeProposeChallengeModal();
    alert('Thanks! Your challenge has been sent to the club admin for review. It will appear here once approved.');
    currentUserName = proposedBy;
    localStorage.setItem('braycc_user', currentUserName);
    if (proposedByPhone) localStorage.setItem('braycc_user_phone', proposedByPhone);
  } catch (err) {
    alert('Could not submit: ' + err.message);
  }
}

/* ---------- Backdrop / ESC close for challenge modals ---------- */
document.addEventListener('click', (e) => {
  const logModal = document.getElementById('log-progress-modal');
  if (logModal && !logModal.classList.contains('hidden') && e.target === logModal) {
    closeLogProgressModal();
  }
  const proposeModal = document.getElementById('propose-challenge-modal');
  if (proposeModal && !proposeModal.classList.contains('hidden') && e.target === proposeModal) {
    closeProposeChallengeModal();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const logModal = document.getElementById('log-progress-modal');
  if (logModal && !logModal.classList.contains('hidden')) closeLogProgressModal();
  const proposeModal = document.getElementById('propose-challenge-modal');
  if (proposeModal && !proposeModal.classList.contains('hidden')) closeProposeChallengeModal();
});
/* ---------- Ride with GPS join link ---------- */
async function loadRwgpsJoinLink() {
  try {
    const res = await fetch('/whatsapp-numbers.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const config = await res.json();
    const rwgps = config.rwgps;
    if (!rwgps || !rwgps.joinUrl) return;

    const btn = document.getElementById('rwgps-join-btn');
    if (btn) {
      btn.href = rwgps.joinUrl;
      btn.classList.remove('hidden');
      if (rwgps.buttonLabel) {
        btn.innerHTML = `<i class="fa-solid fa-person-biking"></i><span>${escapeHtml(rwgps.buttonLabel)}</span>`;
      }
    }

    const footerLink = document.getElementById('rwgps-footer-link');
    if (footerLink) {
      footerLink.href = rwgps.joinUrl;
      footerLink.classList.remove('hidden');
    }
  } catch (e) {
    console.warn('RWGPS join link not configured:', e.message);
  }
}

/* =========================================================
   RIDE WITH GPS — config loader, connect block, helpers
   ========================================================= */

async function loadRwgpsConfig() {
  try {
    const res = await fetch('/api/rwgps-config', { cache: 'no-store' });
    if (!res.ok) { rwgpsEnabled = false; return; }
    const data = await res.json();
    rwgpsEnabled = !!data.enabled;
  } catch (e) {
    rwgpsEnabled = false;
  }
}

function renderRwgpsConnectBlock(challengeId) {
  const box = document.getElementById('rwgps-connect-block');
  if (!box) return;

  if (!rwgpsEnabled) { box.innerHTML = ''; return; }
  if (!currentUserName) { box.innerHTML = ''; return; }

  box.innerHTML = `
    <button onclick="openRwgpsLoginModal()"
            class="w-full mb-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-sm flex items-center justify-center space-x-1">
      <i class="fa-solid fa-link"></i>
      <span>Connect Ride with GPS</span>
    </button>
    <p class="text-[11px] text-slate-500 mb-2">Auto-sync your rides to this challenge. We only read distance, date, and elevation.</p>`;
}

function openRwgpsLoginModal() {
  if (!rwgpsEnabled) { alert('Ride with GPS integration is currently disabled.'); return; }
  const email = prompt('Ride with GPS email:');
  if (!email) return;
  const password = prompt('Ride with GPS password:');
  if (!password) return;

  fetch('/api/rwgps-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, memberName: currentUserName })
  })
  .then(r => r.json().then(j => ({ ok: r.ok, status: r.status, data: j })))
  .then(({ ok, status, data }) => {
    if (!ok) throw new Error(data.error || 'HTTP ' + status);
    alert('Connected! Your Ride with GPS rides will now appear on the leaderboard.');
    if (currentChallengeDetail) openChallengeDetail(currentChallengeDetail.challenge.id);
  })
  .catch(err => alert('Could not connect: ' + err.message));
}

function scoreEntryValue(challenge, entry) {
  if (challenge.type === 'distance') return entry.totalKm || 0;
  if (challenge.type === 'monthly') return (entry.rides || []).length * (challenge.minDistancePerRide || 0);
  if (challenge.type === 'series') return (entry.seriesRides || []).length * 100;
  return 0;
}

/* =========================================================
   SPIN SHARING + DEEP LINKS
   ========================================================= */

async function shareSpin(spinId) {
  const spin = spinsData.find(s => s.id === spinId);
  if (!spin) return;

  const dateObj = new Date(spin.date + 'T' + spin.time);
  const dateStr = dateObj.toLocaleDateString('en-IE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const deepLink = `${window.location.origin}/?spin=${encodeURIComponent(spin.id)}`;

  const message =
`🚴 BrayCC Spin: ${spin.title}
📅 ${dateStr} at ${spin.time}
📍 ${spin.location}
🏁 ${spin.distance} km · ${spin.pace} pace${spin.mudguardsRequired ? '\n🛡️ Mudguards required' : ''}${spin.weatherPolicy === 'All-Weather' ? '\n🌧️ All-weather spin' : ''}${spin.mapLink ? '\n🗺️ Route: ' + spin.mapLink : ''}

RSVP or see full details:
${deepLink}`;

  // Native share sheet (mobile, modern desktop)
  if (navigator.share) {
    try {
      await navigator.share({
        title: `BrayCC Spin: ${spin.title}`,
        text: message
      });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      // fall through to clipboard
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(message);
    alert('Spin details copied to clipboard.\n\nPaste into WhatsApp, email, or anywhere you like.');
  } catch (err) {
    // Last resort: prompt with text
    window.prompt('Copy this text to share:', message);
  }
}

let deepLinkHandled = false;

function handleDeepLink() {
  if (deepLinkHandled) return;
  const params = new URLSearchParams(window.location.search);
  const spinId = params.get('spin');
  if (!spinId) return;

  const card = document.querySelector(`[data-spin-id="${spinId}"]`);
  if (!card) return;

  deepLinkHandled = true;

  setTimeout(() => {
    try {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      card.scrollIntoView();
    }
    card.classList.add('ring-4', 'ring-amber-400', 'ring-offset-2');
    setTimeout(() => {
      card.classList.remove('ring-4', 'ring-amber-400', 'ring-offset-2');
    }, 5000);
  }, 400);
}

/* =========================================================
   COLLAPSIBLE POLICY BANNER
   ========================================================= */

function togglePolicyBanner() {
  const body = document.getElementById('policy-body');
  const chevron = document.getElementById('policy-chevron');
  if (!body) return;
  body.classList.toggle('hidden');
  if (chevron) {
    if (body.classList.contains('hidden')) {
      chevron.classList.remove('rotate-180');
    } else {
      chevron.classList.add('rotate-180');
    }
  }
}

/* =========================================================
   CHALLENGE SHARING
   ========================================================= */

async function shareChallenge(challengeId) {
  const challenge = challengesData.find(c => c.id === challengeId);
  if (!challenge) return;

  const deepLink = `${window.location.origin}/?challenge=${encodeURIComponent(challenge.id)}`;

  const typeLabel = {
    distance: 'Distance',
    monthly: 'Monthly',
    series: 'Series',
    custom: 'Custom'
  }[challenge.type] || 'Challenge';

  let targetLine = '';
  if (challenge.type === 'distance' && challenge.targetKm) {
    targetLine = `\n🎯 Target: ${challenge.targetKm} km`;
  } else if (challenge.type === 'monthly' && challenge.ridesRequired && challenge.minDistancePerRide) {
    targetLine = `\n🎯 ${challenge.ridesRequired} qualifying rides of ${challenge.minDistancePerRide} km`;
  }

  const message =
`🏆 BrayCC Challenge: ${challenge.title}
${challenge.org ? `Organised by ${challenge.org}\n` : ''}${typeLabel}${targetLine}

${challenge.description || ''}

Join in on the club app:
${deepLink}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: `BrayCC Challenge: ${challenge.title}`,
        text: message
      });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(message);
    alert('Challenge details copied to clipboard.');
  } catch (err) {
    window.prompt('Copy this text to share:', message);
  }
}

/* ---------- PWA indicator badge ---------- */
(function showPwaBadge() {
  try {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                      || window.navigator.standalone === true;
    const badge = document.getElementById('pwa-badge');
    if (badge && isStandalone) {
      badge.classList.remove('hidden');
      badge.classList.add('flex');
    }
  } catch (e) { /* silent */ }
})();