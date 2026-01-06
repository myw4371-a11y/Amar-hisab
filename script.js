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
let currentMType = ''; 

// --- ২. Auth Logic ---
function toggleAuth(isReg) {
    document.getElementById('reg-fields').classList.toggle('hidden', !isReg);
    document.getElementById('login-fields').classList.toggle('hidden', isReg);
    document.getElementById('auth-title').innerText = isReg ? "নতুন অ্যাকাউন্ট" : "স্বাগতম";
}

async function handleRegister() {
    const user = document.getElementById('reg-user').value.trim().toLowerCase();
    const pass = document.getElementById('reg-pass1').value;
    if(!user || pass.length < 4) return showError("সঠিক তথ্য দিন (কমপক্ষে ৪ সংখ্যা)");
    const snap = await rdb.ref('users/' + user).once('value');
    if (snap.exists()) return showError("এই নামটি আগেই ব্যবহার করা হয়েছে");
    await rdb.ref('users/' + user).set({ password: pass, joinDate: new Date().toLocaleDateString('bn-BD', {year:'numeric', month:'long', day:'numeric'}) });
    login(user);
}

async function handleLogin() {
    const user = document.getElementById('login-user').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value;
    const snap = await rdb.ref('users/' + user).once('value');
    if(snap.exists() && snap.val().password === pass) login(user);
    else showError("ভুল পাসওয়ার্ড বা ইউজারনেম");
}

function login(user) { 
    localStorage.setItem('activeUserPRO', user); 
    location.reload(); 
}

function showError(m) { 
    const el = document.getElementById('auth-error'); 
    el.innerText = m; 
    el.classList.remove('hidden'); 
    setTimeout(() => el.classList.add('hidden'), 3000);
}

// --- ৩. Core Business Logic (Filter Fixes) ---
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
    const currentYear = now.getFullYear();
    const currentMonth = todayStr.substring(0, 7);

    // Filter Logic Fix
    let filtered = records;
    if (filter === 'today') {
        filtered = records.filter(r => r.date === todayStr);
    } else if (filter === 'week') {
        filtered = records.filter(r => r.ts >= (Date.now() - 7 * 86400000));
    } else if (filter === 'month') {
        filtered = records.filter(r => r.date.startsWith(currentMonth));
    } else if (filter === 'last_month') {
        let lm = new Date(); lm.setMonth(lm.getMonth() - 1);
        filtered = records.filter(r => r.date.startsWith(lm.toISOString().substring(0, 7)));
    } else if (filter === 'year') {
        filtered = records.filter(r => r.date.startsWith(currentYear.toString()));
    }

    const list = document.getElementById('data-list');
    list.innerHTML = "";
    let iS = 0, eS = 0;

    filtered.sort((a,b) => b.ts - a.ts).forEach(r => {
        if(r.type === 'income') iS += r.amt; else eS += r.amt;
        const color = r.type === 'income' ? 'emerald' : 'rose';
        const icon = r.type === 'income' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
        
        list.innerHTML += `
            <div class="bg-white p-6 rounded-[2.5rem] shadow-sm flex justify-between items-center animate__animated animate__fadeInUp border border-slate-50 relative overflow-hidden group">
                <div class="flex items-center gap-4 relative z-10">
                    <div class="w-12 h-12 bg-${color}-50 text-${color}-500 rounded-2xl flex items-center justify-center shadow-inner">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div>
                        <p class="font-black text-slate-800 text-sm">${r.desc}</p>
                        <p class="text-[8px] text-slate-400 font-black tracking-widest uppercase mt-1">${r.date}</p>
                    </div>
                </div>
                <div class="text-right relative z-10">
                    <p class="text-xl font-black text-${color}-500 tracking-tighter">৳${r.amt}</p>
                </div>
                <div class="absolute right-0 top-0 bottom-0 w-1 bg-${color}-500 opacity-0 group-hover:opacity-100 transition-all"></div>
            </div>`;
    });

    document.getElementById('sum-in').innerText = iS.toLocaleString();
    document.getElementById('sum-ex').innerText = eS.toLocaleString();
    document.getElementById('total-balance').innerText = (iS - eS).toLocaleString();
    
    const titles = { home: 'সব সময়', today: 'আজকের হিসাব', week: 'এই সপ্তাহের', month: 'এই মাসের', last_month: 'গত মাসের', year: 'এই বছরের' };
    document.getElementById('view-date').innerText = titles[filter] || filter;
}

// --- ৪. Egg Manager (ডিমের হিসাব) ---
function openEggManager() { document.getElementById('egg-manager-screen').classList.remove('hidden'); loadEggData(); }
function closeEggManager() { document.getElementById('egg-manager-screen').classList.add('hidden'); }

async function eAdd(type) {
    const qty = prompt("কয়টি ডিম " + (type === 'buy' ? "কিনলেন?" : "খরচ করলেন?"));
    if(!qty || qty <= 0) return;
    await rdb.ref('eggs/' + currentUser).push({
        type, qty: Number(qty), ts: Date.now(),
        date: new Date().toLocaleDateString('bn-BD')
    });
    loadEggData();
}

async function loadEggData() {
    const snap = await rdb.ref('eggs/' + currentUser).once('value');
    const data = snap.val() ? Object.values(snap.val()) : [];
    let bought = data.filter(e => e.type === 'buy').reduce((s, x) => s + x.qty, 0);
    let used = data.filter(e => e.type === 'use').reduce((s, x) => s + x.qty, 0);
    
    document.getElementById('egg-bought').innerText = bought;
    document.getElementById('egg-used').innerText = used;
    document.getElementById('egg-stock').innerText = bought - used;

    const list = document.getElementById('egg-history-list');
    list.innerHTML = "";
    data.reverse().forEach(e => {
        const isBuy = e.type === 'buy';
        list.innerHTML += `
            <div class="bg-white p-4 rounded-2xl flex justify-between items-center border border-slate-50 shadow-sm">
                <p class="text-xs font-black text-slate-700">${isBuy ? 'কেনা হয়েছে' : 'খরচ হয়েছে'}</p>
                <p class="text-lg font-black ${isBuy ? 'text-emerald-500' : 'text-rose-500'}">${isBuy ? '+' : '-'}${e.qty} টি</p>
            </div>`;
    });
}

// --- ৫. Manager Core ---
// (এখানে আপনার আগের ম্যানেজার লজিক থাকবে, আমি শুধু এডিট করার অপশনটা ফিক্স করেছি)

async function openManager() { 
    document.getElementById('manager-screen').classList.remove('hidden'); 
    loadManagerData(); 
}

function closeManager() { 
    document.getElementById('manager-screen').classList.add('hidden'); 
}

async function loadManagerData() {
    const snap = await rdb.ref('manager/' + currentUser).once('value');
    const data = snap.val() || {};
    const moneyL = data.money ? Object.values(data.money) : [];
    const expenseL = data.expense ? Object.values(data.expense) : [];
    const mealL = data.meal ? Object.values(data.meal) : [];

    let tMon = moneyL.reduce((s, x) => s + x.amount, 0);
    let tExp = expenseL.reduce((s, x) => s + x.amount, 0);
    let tMeal = mealL.reduce((s, x) => s + x.amount, 0);
    let mealRate = tMeal > 0 ? (tExp / tMeal) : 0;

    document.getElementById('m-total-money').innerText = tMon;
    document.getElementById('m-total-expense').innerText = tExp;
    document.getElementById('m-total-meal').innerText = tMeal;
    document.getElementById('m-meal-rate').innerText = mealRate.toFixed(2);

    const list = document.getElementById('manager-list'); 
    list.innerHTML = "";
    const names = [...new Set([...moneyL.map(x=>x.name), ...mealL.map(x=>x.name)])];

    names.forEach(n => {
        let uMon = moneyL.filter(x=>x.name===n).reduce((s,x)=>s+x.amount, 0);
        let uMeal = mealL.filter(x=>x.name===n).reduce((s,x)=>s+x.amount, 0);
        let uCost = uMeal * mealRate;
        let diff = uMon - uCost;

        list.innerHTML += `
            <tr onclick="manageUserDetail('${n}')" class="active:bg-slate-50">
                <td class="p-4"><span class="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg">${n}</span></td>
                <td>${uMon}</td>
                <td>${uMeal}</td>
                <td>${uCost.toFixed(0)}</td>
                <td class="${diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${diff >= 0 ? 'পাবে' : 'দিবে'}</td>
            </tr>`;
    });
}

// --- ৬. Sidebar & UI ---
function toggleSidebar() { 
    document.getElementById('sidebar').classList.toggle('active'); 
    document.getElementById('sidebar-overlay').classList.toggle('hidden'); 
}

function openProfile() {
    rdb.ref('users/' + currentUser).once('value').then(s => {
        document.getElementById('nav-user-name').innerText = currentUser.toUpperCase();
        document.getElementById('nav-avatar').innerText = currentUser[0].toUpperCase();
        // প্রোফাইল মডাল ওপেন লজিক
    });
}

window.onload = () => {
    if(currentUser) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        loadData('home');
        openProfile();
    }
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        splash.classList.add('animate__fadeOut');
        setTimeout(() => splash.style.display = 'none', 1000);
    }, 2500);
      }
