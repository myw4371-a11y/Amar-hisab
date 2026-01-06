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
let currentMType = ''; // money, expense, meal

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
    const currentMonth = todayStr.substring(0, 7);
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    const lastMonth = d.toISOString().substring(0, 7);

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
        list.innerHTML += `<div class="bg-white p-6 rounded-[2.5rem] shadow-sm flex justify-between items-center animate__animated animate__fadeInUp border border-slate-50">
            <div><p class="font-black text-slate-800 text-sm">${r.desc}</p><p class="text-[9px] text-slate-400 font-bold tracking-widest uppercase">${r.date}</p></div>
            <p class="text-xl font-black text-${color}-500">৳${r.amt}</p>
        </div>`;
    });
    document.getElementById('sum-in').innerText = iS;
    document.getElementById('sum-ex').innerText = eS;
    document.getElementById('total-balance').innerText = iS - eS;
    const titles = { home: 'সব সময়', today: 'আজ', week: 'এই সপ্তাহ', month: 'এই মাস', last_month: 'পুরানো মাস', year: 'এই বছর' };
    document.getElementById('view-date').innerText = titles[filter] || filter;
}

// --- ৪. Manager Logic (New) ---
function openManager() { document.getElementById('manager-screen').classList.remove('hidden'); loadManagerData(); }
function closeManager() { document.getElementById('manager-screen').classList.add('hidden'); }

function mAdd(type) {
    currentMType = type;
    const titles = { money: 'টাকা জমা', expense: 'বাজার খরচ', meal: 'মিল সংখ্যা' };
    document.getElementById('m-modal-title').innerText = titles[type];
    document.getElementById('m-entry-modal').classList.remove('hidden');
    updateMSuggestions();
}

function closeMModal() { document.getElementById('m-entry-modal').classList.add('hidden'); }

async function updateMSuggestions() {
    const snap = await rdb.ref('manager/' + currentUser + '/money').once('value');
    const suggestions = document.getElementById('name-suggestions');
    suggestions.innerHTML = "";
    if(snap.exists()){
        const names = [...new Set(Object.values(snap.val()).map(x => x.name))];
        names.forEach(n => { suggestions.innerHTML += `<option value="${n}">`; });
    }
}

async function saveMEntry() {
    const name = document.getElementById('m-name').value.trim();
    const amount = Number(document.getElementById('m-amount').value);
    if(!name || amount <= 0) return;
    await rdb.ref('manager/' + currentUser + '/' + currentMType).push({ name, amount, ts: Date.now() });
    document.getElementById('m-name').value = ''; document.getElementById('m-amount').value = '';
    closeMModal(); loadManagerData();
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

    const list = document.getElementById('manager-list'); list.innerHTML = "";
    const names = [...new Set([...moneyL.map(x=>x.name), ...mealL.map(x=>x.name)])];

    names.forEach(n => {
        let uMon = moneyL.filter(x=>x.name===n).reduce((s,x)=>s+x.amount, 0);
        let uMeal = mealL.filter(x=>x.name===n).reduce((s,x)=>s+x.amount, 0);
        let uCost = uMeal * mealRate;
        let pabe = uCost > uMon ? uCost - uMon : 0;
        let dibe = uMon > uCost ? uMon - uCost : 0;

        list.innerHTML += `<tr onclick="openMDetail('${n}')" class="border-b border-slate-50 active:bg-slate-100 transition-colors">
            <td class="p-4 text-indigo-600 font-bold">${n}</td>
            <td>${uMon}</td><td>${uMeal}</td><td>${uCost.toFixed(0)}</td>
            <td class="text-rose-500">${pabe > 0 ? pabe.toFixed(0) : '-'}</td>
            <td class="text-emerald-500">${dibe > 0 ? dibe.toFixed(0) : '-'}</td>
        </tr>`;
    });
}

// --- ৫. Manager Detail, Edit & Reset ---
let currentDetailName = '';
async function openMDetail(name) {
    currentDetailName = name;
    document.getElementById('m-detail-title').innerText = name + " - বিস্তারিত";
    document.getElementById('m-detail-screen').classList.remove('hidden');
    
    const snap = await rdb.ref('manager/' + currentUser).once('value');
    const data = snap.val() || {};
    const content = document.getElementById('m-detail-content');
    content.innerHTML = "";

    ['money', 'meal'].forEach(type => {
        if(data[type]) {
            Object.entries(data[type]).filter(([id, val])=> val.name === name).forEach(([id, val]) => {
                const label = type === 'money' ? '৳ জমা' : 'টি মিল';
                content.innerHTML += `<div class="bg-white p-5 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100 animate__animated animate__fadeIn">
                    <p class="font-bold text-slate-600">${label}: <span class="text-indigo-600 text-lg ml-2">${val.amount}</span></p>
                    <button onclick="deleteMEntry('${type}', '${id}')" class="text-rose-400 p-2"><i class="fa-solid fa-trash-can"></i></button>
                </div>`;
            });
        }
    });
}

function closeMDetail() { document.getElementById('m-detail-screen').classList.add('hidden'); }

async function deleteMEntry(type, id) {
    if(confirm("এই এন্ট্রিটি মুছে ফেলবেন?")) {
        await rdb.ref(`manager/${currentUser}/${type}/${id}`).remove();
        openMDetail(currentDetailName); loadManagerData();
    }
}

async function undoMEntry() {
    alert("লিস্টের ডিলিট বাটন ব্যবহার করে এডিট করুন।");
}

async function resetManager() {
    if(confirm("সাবধান! ম্যানেজারি হিসাবের সব ডাটা মুছে যাবে। আপনি কি নিশ্চিত?")) {
        await rdb.ref('manager/' + currentUser).remove();
        loadManagerData();
    }
}

// --- ৬. Sidebar & Profile ---
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); document.getElementById('sidebar-overlay').classList.toggle('hidden'); }
function logout() { localStorage.removeItem('activeUserPRO'); location.reload(); }
async function openProfile() {
    const snap = await rdb.ref('users/' + currentUser).once('value');
    document.getElementById('prof-user').innerText = currentUser.toUpperCase();
    document.getElementById('user-avatar').innerText = currentUser[0].toUpperCase();
    document.getElementById('prof-date').innerText = "Joined: " + (snap.val().joinDate || "Jan 2026");
    document.getElementById('profile-modal').classList.remove('hidden');
}
function closeProfile() { document.getElementById('profile-modal').classList.add('hidden'); }
async function undo() {
    const snap = await rdb.ref('records/' + currentUser).limitToLast(1).once('value');
    if(snap.exists() && confirm("সর্বশেষ লেনদেনটি মুছবেন?")) {
        await rdb.ref('records/' + currentUser + '/' + Object.keys(snap.val())[0]).remove();
        loadData(currentFilter);
    }
}

window.onload = () => { if(currentUser) { document.getElementById('auth-screen').classList.add('hidden'); document.getElementById('main-app').classList.remove('hidden'); loadData('home'); } }
