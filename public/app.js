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

window.addEventListener('DOMContentLoaded', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('prop-date').value = tomorrow.toISOString().split('T')[0];
  injectProposerModals();
  wireNotificationButton();
  registerServiceWorker();
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
  const proposerBtns = isProposer
    ? `<button onclick="openEditSpinModal('${spin.id}')"
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
    currentUserName = name