// ১. Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAyNkZvxqdPsa2E2SXnYVsZe1wENJF1I7E",
  authDomain: "amar-hishab-pro.firebaseapp.com",
  projectId: "amar-hishab-pro",
  storageBucket: "amar-hishab-pro.firebasestorage.app",
  messagingSenderId: "669695299386",
  appId: "1:669695299386:web:c8e58b6249a57123538a03",
  databaseURL: "https://amar-hishab-pro-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

firebase.initializeApp(firebaseConfig);
const rdb = firebase.database();
let currentUser = localStorage.getItem('activeUserPRO');
let currentFilter = 'home';

// --- ২. Auth Logic ---
function toggleAuth(isReg) {
    document.getElementById('reg-fields').classList.toggle('hidden', !isReg);
    document.getElementById('login-fields').classList.toggle('hidden', isReg);
    document.getElementById('auth-title').innerText = isReg ? "রেজিস্ট্রেশন" : "লগইন";
}

async function handleRegister() {
    const user = document.getElementById('reg-user').value.trim().toLowerCase();
    const pass = document.getElementById('reg-pass1').value;
    if(!user || pass.length < 4) return showError("সঠিক তথ্য দিন");
    const snap = await rdb.ref('users/' + user).once('value');
    if (snap.exists()) return showError("নামটি আগেই নেয়া হয়েছে");
    await rdb.ref('users/' + user).set({ password: pass, joinDate: new Date().toLocaleDateString('bn-BD', {year:'numeric', month:'long'}) });
    login(user);
}

async function handleLogin() {
    const user = document.getElementById('login-user').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value;
    const snap = await rdb.ref('users/' + user).once('value');
    if(snap.exists() && snap.val().password === pass) login(user);
    else showError("ভুল পাসওয়ার্ড বা ইউজারনেম");
}

function login(user) { localStorage.setItem('activeUserPRO', user); location.reload(); }
function showError(m) { const el = document.getElementById('auth-error'); el.innerText = m; el.classList.remove('hidden'); }

// --- ৩. Core Hishab Logic ---
async function save(type) {
    const desc = document.getElementById('desc').value.trim();
    const amt = document.getElementById('amt').value;
    if(!desc || amt <= 0) return;
    await rdb.ref('records/' + currentUser).push({
        desc, amt: Number(amt), type,
        date: new Date().toISOString().split('T')[0],
        ts: Date.now()
    });
    document.getElementById('desc').value = ""; document.getElementById('amt').value = "";
    loadData(currentFilter);
}

async function loadData(filter = 'home') {
    currentFilter = filter;
    const snap = await rdb.ref('records/' + currentUser).once('value');
    const records = snap.val() ? Object.values(snap.val()) : [];
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonth = todayStr.substring(0, 7); // 2026-01
    
    // গত মাসের হিসাব বের করার লজিক
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const lastMonth = d.toISOString().substring(0, 7); // 2025-12

    let filtered = records;
    if (filter === 'today') filtered = records.filter(r => r.date === todayStr);
    else if (filter === 'week') filtered = records.filter(r => r.ts >= (Date.now() - 7 * 86400000));
    else if (filter === 'month') filtered = records.filter(r => r.date.startsWith(currentMonth));
    else if (filter === 'last_month') filtered = records.filter(r => r.date.startsWith(lastMonth));
    else if (filter === 'year') filtered = records.filter(r => r.date.startsWith(todayStr.substring(0, 4)));

    const list = document.getElementById('data-list');
    list.innerHTML = "";
    let iS = 0, eS = 0;

    filtered.sort((a,b) => b.ts - a.ts).forEach(r => {
        if(r.type === 'income') iS += r.amt; else eS += r.amt;
        const color = r.type === 'income' ? 'emerald' : 'rose';
        list.innerHTML += `
            <div class="bg-white p-6 rounded-[2.5rem] shadow-sm flex justify-between items-center animate__animated animate__fadeInUp border border-slate-50">
                <div><p class="font-black text-slate-800 text-sm">${r.desc}</p><p class="text-[9px] text-slate-400 font-bold tracking-widest uppercase">${r.date}</p></div>
                <p class="text-xl font-black text-${color}-500">৳${r.amt}</p>
            </div>`;
    });

    document.getElementById('sum-in').innerText = iS;
    document.getElementById('sum-ex').innerText = eS;
    document.getElementById('total-balance').innerText = iS - eS;
    
    const titles = { home: 'সব সময়', today: 'আজ', week: 'এই সপ্তাহ', month: 'এই মাস', last_month: 'পুরানো মাস', year: 'এই বছর' };
    document.getElementById('view-date').innerText = titles[filter] || filter;
    if(document.getElementById('sidebar').classList.contains('active')) toggleSidebar();
}

// --- ৪. Extra Functions ---
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); document.getElementById('sidebar-overlay').classList.toggle('hidden'); }
function logout() { localStorage.removeItem('activeUserPRO'); location.reload(); }
async function openProfile() {
    const snap = await rdb.ref('users/' + currentUser).once('value');
    document.getElementById('prof-user').innerText = currentUser.toUpperCase();
    document.getElementById('user-avatar').innerText = currentUser[0].toUpperCase();
    document.getElementById('prof-date').innerText = "Joined: " + snap.val().joinDate;
    document.getElementById('profile-modal').classList.remove('hidden');
}
function closeProfile() { document.getElementById('profile-modal').classList.add('hidden'); }
async function undo() {
    const snap = await rdb.ref('records/' + currentUser).limitToLast(1).once('value');
    if(snap.exists() && confirm("সর্বশেষ ডাটাটি মুছবেন?")) {
        await rdb.ref('records/' + currentUser + '/' + Object.keys(snap.val())[0]).remove();
        loadData(currentFilter);
    }
}

window.onload = () => { if(currentUser) { document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('main-app').classList.remove('hidden'); loadData('home'); } }
