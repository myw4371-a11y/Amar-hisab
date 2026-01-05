// ১. Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAyNkZvxqdPsa2E2SXnYVsZe1wENJF1I7E",
  authDomain: "amar-hishab-pro.firebaseapp.com",
  projectId: "amar-hishab-pro",
  storageBucket: "amar-hishab-pro.firebasestorage.app",
  messagingSenderId: "669695299386",
  appId: "1:669695299386:web:c8e58b6249a57123538a03",
  databaseURL: "https://amar-hishab-pro-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// ২. Initialize
firebase.initializeApp(firebaseConfig);
const rdb = firebase.database();
let currentUser = localStorage.getItem('activeUserPRO');
let currentFilter = 'home';

// --- Auth Functions ---
function togglePass(id, btn) {
    const input = document.getElementById(id);
    const icon = btn.querySelector('i');
    input.type = input.type === "password" ? "text" : "password";
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
}

function toggleAuth(isReg) {
    document.getElementById('reg-fields').classList.toggle('hidden', !isReg);
    document.getElementById('login-fields').classList.toggle('hidden', isReg);
    document.getElementById('auth-title').innerText = isReg ? "রেজিস্ট্রেশন" : "লগইন";
    document.getElementById('auth-error').classList.add('hidden');
}

async function handleRegister() {
    const user = document.getElementById('reg-user').value.trim();
    const p1 = document.getElementById('reg-pass1').value;
    const p2 = document.getElementById('reg-pass2').value;

    if(!user) return showError("ইউজার নেম দিন");
    if(p1.length < 6) return showError("৬ সংখ্যার পাসওয়ার্ড দিন");
    if(p1 !== p2) return showError("সঠিক পাসওয়ার্ড দিন (মেলেনি)");

    const snapshot = await rdb.ref('users/' + user).once('value');
    if (snapshot.exists()) return showError("এই ইউজার নেমটি আগেই নেয়া হয়েছে!");

    await rdb.ref('users/' + user).set({
        password: p1,
        joinDate: new Date().toLocaleDateString('bn-BD')
    });
    
    login(user);
}

async function handleLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;

    if(!user || !pass) return showError("সব তথ্য দিন");

    const snapshot = await rdb.ref('users/' + user).once('value');
    if(snapshot.exists() && snapshot.val().password === pass) {
        login(user);
    } else {
        showError("সঠিক পাসওয়ার্ড দিন অথবা ইউজার নেম চেক করুন");
    }
}

function login(user) {
    localStorage.setItem('activeUserPRO', user);
    location.reload();
}

function showError(m) {
    const el = document.getElementById('auth-error');
    el.innerText = m;
    el.classList.remove('hidden');
}

// --- Data Functions ---
async function save(type) {
    const desc = document.getElementById('desc').value.trim();
    const amt = document.getElementById('amt').value;
    if(!desc || amt <= 0) return;

    const data = {
        desc,
        amt: Number(amt),
        type,
        date: new Date().toISOString().split('T')[0],
        ts: Date.now()
    };

    await rdb.ref('records/' + currentUser).push(data);
    document.getElementById('desc').value = "";
    document.getElementById('amt').value = "";
    loadData(currentFilter);
}

async function loadData(filter = 'home') {
    currentFilter = filter;
    const list = document.getElementById('data-list');
    const snap = await rdb.ref('records/' + currentUser).once('value');
    const val = snap.val();
    const records = val ? Object.values(val) : [];
    
    let filtered = [];
    const today = new Date().toISOString().split('T')[0];

    // Filter Logic
    if(filter === 'today') filtered = records.filter(r => r.date === today);
    else if(filter === 'week') filtered = records.filter(r => r.ts >= (Date.now() - 7*86400000));
    else if(filter === 'month') filtered = records.filter(r => r.date.startsWith(today.substring(0,7)));
    else if(filter === 'lastMonth') {
        let lm = new Date(); lm.setMonth(lm.getMonth()-1);
        filtered = records.filter(r => r.date.startsWith(lm.toISOString().substring(0,7)));
    } else filtered = records;

    // Render UI
    list.innerHTML = "";
    let iSum = 0, eSum = 0;

    filtered.sort((a,b) => b.ts - a.ts).forEach(r => {
        if(r.type === 'income') iSum += r.amt; else eSum += r.amt;
        list.innerHTML += `
            <div class="bg-white p-5 rounded-[2rem] shadow-sm flex justify-between items-center animate__animated animate__fadeInUp border-l-4 ${r.type==='income'?'border-emerald-500':'border-rose-500'}">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-2xl flex items-center justify-center ${r.type==='income'?'bg-emerald-50 text-emerald-500':'bg-rose-50 text-rose-500'}">
                        <i class="fa-solid ${r.type==='income'?'fa-plus':'fa-minus'} text-xs"></i>
                    </div>
                    <div>
                        <p class="font-bold text-slate-800 text-sm">${r.desc}</p>
                        <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">${r.date}</p>
                    </div>
                </div>
                <p class="text-lg font-black ${r.type==='income'?'text-emerald-500':'text-rose-500'}">৳${r.amt}</p>
            </div>`;
    });

    document.getElementById('sum-in').innerText = iSum.toLocaleString('bn-BD');
    document.getElementById('sum-ex').innerText = eSum.toLocaleString('bn-BD');
    document.getElementById('total-balance').innerText = (iSum - eSum).toLocaleString('bn-BD');
    document.getElementById('view-date').innerText = filter === 'home' ? "সব সময়" : filter;
    if(document.getElementById('sidebar').classList.contains('active')) toggleSidebar();
}

// --- UI Helpers ---
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('sidebar-overlay').classList.toggle('hidden');
}

async function openProfile() {
    const snap = await rdb.ref('users/' + currentUser).once('value');
    const u = snap.val();
    document.getElementById('prof-user').innerText = currentUser;
    document.getElementById('prof-date').innerText = "Joined: " + u.joinDate;
    document.getElementById('profile-modal').classList.remove('hidden');
}

function closeProfile() { document.getElementById('profile-modal').classList.add('hidden'); }

function logout() { localStorage.removeItem('activeUserPRO'); location.reload(); }

async function undo() {
    const snap = await rdb.ref('records/' + currentUser).limitToLast(1).once('value');
    if(snap.exists()) {
        const key = Object.keys(snap.val())[0];
        if(confirm("শেষ লেনদেনটি ডিলিট করতে চান?")) {
            await rdb.ref('records/' + currentUser + '/' + key).remove();
            loadData(currentFilter);
        }
    }
}

// Initial Load
window.onload = () => {
    if(currentUser) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('side-username').innerText = currentUser;
        document.getElementById('side-user-icon').innerText = currentUser[0].toUpperCase();
        loadData('home');
    }
        }
