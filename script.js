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
function togglePass(id, btn) {
    const input = document.getElementById(id);
    const icon = btn.querySelector('i');
    input.type = input.type === "password" ? "text" : "password";
    icon.classList.toggle('fa-eye'); icon.classList.toggle('fa-eye-slash');
}

function toggleAuth(isReg) {
    document.getElementById('reg-fields').classList.toggle('hidden', !isReg);
    document.getElementById('login-fields').classList.toggle('hidden', isReg);
    document.getElementById('auth-title').innerText = isReg ? "রেজিস্ট্রেশন" : "লগইন";
    document.getElementById('auth-error').classList.add('hidden');
}

async function handleRegister() {
    const user = document.getElementById('reg-user').value.trim().toLowerCase();
    const p1 = document.getElementById('reg-pass1').value;
    const p2 = document.getElementById('reg-pass2').value;

    if(!user || user.length < 3) return showError("সঠিক ইউজার নেম দিন");
    if(p1.length < 6) return showError("৬ সংখ্যার পাসওয়ার্ড দিন");
    if(p1 !== p2) return showError("পাসওয়ার্ড মেলেনি");

    const snapshot = await rdb.ref('users/' + user).once('value');
    if (snapshot.exists()) return showError("এই নাম আগে ব্যবহার করা হয়েছে");

    await rdb.ref('users/' + user).set({
        password: p1,
        joinDate: new Date().toLocaleDateString('bn-BD', {year:'numeric', month:'long', day:'numeric'})
    });
    login(user);
}

async function handleLogin() {
    const user = document.getElementById('login-user').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value;
    if(!user || !pass) return showError("সব তথ্য দিন");

    const snapshot = await rdb.ref('users/' + user).once('value');
    if(snapshot.exists() && snapshot.val().password === pass) login(user);
    else showError("ভুল পাসওয়ার্ড বা ইউজার নেম");
}

function login(user) {
    localStorage.setItem('activeUserPRO', user);
    location.reload();
}

function showError(m) {
    const el = document.getElementById('auth-error');
    el.innerText = m; el.classList.remove('hidden');
}

// --- ৩. Core Hishab Logic ---
async function save(type) {
    const desc = document.getElementById('desc').value.trim();
    const amt = document.getElementById('amt').value;
    if(!desc || amt <= 0) return;

    const data = {
        desc, amt: Number(amt), type,
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
    const snap = await rdb.ref('records/' + currentUser).once('value');
    const val = snap.val();
    const records = val ? Object.values(val) : [];
    
    let filtered = [];
    const today = new Date().toISOString().split('T')[0];

    if(filter === 'today') filtered = records.filter(r => r.date === today);
    else if(filter === 'week') filtered = records.filter(r => r.ts >= (Date.now() - 7*86400000));
    else if(filter === 'month') filtered = records.filter(r => r.date.startsWith(today.substring(0,7)));
    else filtered = records;

    const list = document.getElementById('data-list');
    list.innerHTML = "";
    let iS = 0, eS = 0;

    filtered.sort((a,b) => b.ts - a.ts).forEach(r => {
        if(r.type === 'income') iS += r.amt; else eS += r.amt;
        list.innerHTML += `
            <div class="bg-white p-6 rounded-[2.5rem] shadow-sm flex justify-between items-center animate__animated animate__fadeInUp border-l-8 ${r.type==='income'?'border-emerald-500':'border-rose-500'}">
                <div>
                    <p class="font-black text-slate-800 text-sm">${r.desc}</p>
                    <p class="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">${r.date}</p>
                </div>
                <div class="text-right">
                    <p class="text-xl font-black ${r.type==='income'?'text-emerald-500':'text-rose-500'}">৳${r.amt}</p>
                    <p class="text-[8px] font-black uppercase opacity-30">${r.type}</p>
                </div>
            </div>`;
    });

    document.getElementById('sum-in').innerText = iS;
    document.getElementById('sum-ex').innerText = eS;
    document.getElementById('total-balance').innerText = iS - eS;
    
    const titles = { home: 'সব সময়', today: 'আজকের হিসাব', week: 'গত ৭ দিন', month: 'এই মাস' };
    document.getElementById('view-date').innerText = titles[filter] || filter;
    
    if(document.getElementById('sidebar').classList.contains('active')) toggleSidebar();
}

// --- ৪. Utility ---
function toggleSidebar() { 
    document.getElementById('sidebar').classList.toggle('active'); 
    document.getElementById('sidebar-overlay').classList.toggle('hidden'); 
}

function logout() { 
    if(confirm("লগআউট করতে চান?")) {
        localStorage.removeItem('activeUserPRO'); 
        location.reload(); 
    }
}

function closeProfile() { 
    document.getElementById('profile-modal').classList.add('hidden'); 
}

async function openProfile() {
    const snap = await rdb.ref('users/' + currentUser).once('value');
    const userData = snap.val();
    document.getElementById('prof-user').innerText = currentUser.toUpperCase();
    document.getElementById('prof-date').innerText = "সদস্য হয়েছেন: " + (userData.joinDate || "অজানা");
    document.getElementById('profile-modal').classList.remove('hidden');
}

async function undo() {
    const snap = await rdb.ref('records/' + currentUser).limitToLast(1).once('value');
    if(snap.exists()) {
        const key = Object.keys(snap.val())[0];
        if(confirm("সর্বশেষ লেনদেনটি মুছে ফেলতে চান?")) {
            await rdb.ref('records/' + currentUser + '/' + key).remove();
            loadData(currentFilter);
        }
    }
}

window.onload = () => {
    if(currentUser) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        loadData('home');
    }
    if ('serviceWorker' in navigator) { 
        navigator.serviceWorker.register('sw.js').catch(err => console.log("SW Error", err)); 
    }
                                       }
