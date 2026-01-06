// ১. Firebase Setup (আপনার কনফিগারেশন ব্যবহার করুন)
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

// --- ২. Authentication ---
function toggleAuth(isReg) {
    document.getElementById('reg-fields').classList.toggle('hidden', !isReg);
    document.getElementById('login-fields').classList.toggle('hidden', isReg);
    document.getElementById('auth-title').innerText = isReg ? "রেজিস্ট্রেশন" : "লগইন";
}

async function handleRegister() {
    const user = document.getElementById('reg-user').value.trim().toLowerCase();
    const pass = document.getElementById('reg-pass1').value;
    if(!user || pass.length < 4) return;
    const snap = await rdb.ref('users/' + user).once('value');
    if (snap.exists()) return alert("নামটি আগেই নেয়া হয়েছে");
    await rdb.ref('users/' + user).set({ password: pass, joinDate: new Date().toLocaleDateString('bn-BD', {year:'numeric', month:'long'}) });
    login(user);
}

async function handleLogin() {
    const user = document.getElementById('login-user').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value;
    const snap = await rdb.ref('users/' + user).once('value');
    if(snap.exists() && snap.val().password === pass) login(user);
    else alert("ভুল তথ্য");
}

function login(user) { localStorage.setItem('activeUserPRO', user); location.reload(); }
function logout() { localStorage.removeItem('activeUserPRO'); location.reload(); }

// --- ৩. Main App Core ---
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
    
    let filtered = records;
    if (filter === 'today') filtered = records.filter(r => r.date === todayStr);
    else if (filter === 'week') filtered = records.filter(r => r.ts >= (Date.now() - 7 * 86400000));
    else if (filter === 'month') filtered = records.filter(r => r.date.startsWith(currentMonth));
    else if (filter === 'last_month') {
        const d = new Date(); d.setMonth(d.getMonth() - 1);
        filtered = records.filter(r => r.date.startsWith(d.toISOString().substring(0, 7)));
    } else if (filter === 'year') filtered = records.filter(r => r.date.startsWith(todayStr.substring(0, 4)));

    const list = document.getElementById('data-list');
    list.innerHTML = "";
    let iS = 0, eS = 0;
    filtered.sort((a,b) => b.ts - a.ts).forEach(r => {
        if(r.type === 'income') iS += r.amt; else eS += r.amt;
        const color = r.type === 'income' ? 'emerald' : 'rose';
        list.innerHTML += `<div class="bg-white p-5 rounded-[2rem] shadow-sm flex justify-between items-center border border-slate-50">
            <div><p class="font-black text-slate-800 text-sm">${r.desc}</p><p class="text-[9px] text-slate-400 font-bold uppercase">${r.date}</p></div>
            <p class="text-lg font-black text-${color}-500">৳${r.amt}</p>
        </div>`;
    });
    document.getElementById('sum-in').innerText = iS;
    document.getElementById('sum-ex').innerText = eS;
    document.getElementById('total-balance').innerText = iS - eS;
    if(document.getElementById('sidebar').classList.contains('active')) toggleSidebar();
}

// --- ৪. Manager Logic ---
function openManager() { document.getElementById('manager-screen').classList.remove('hidden'); loadManagerData(); }
function closeManager() { document.getElementById('manager-screen').classList.add('hidden'); }

function mAdd(type) {
    currentMType = type;
    const titles = { money: 'টাকা জমা', expense: 'বাজার খরচ', meal: 'মিল সংখ্যা' };
    document.getElementById('m-modal-title').innerText = titles[type];
    document.getElementById('m-entry-modal').classList.remove('hidden');
    updateSuggestions();
}

function closeMModal() { document.getElementById('m-entry-modal').classList.add('hidden'); }

async function updateSuggestions() {
    const snap = await rdb.ref('manager/' + currentUser + '/money').once('value');
    const suggestions = document.getElementById('name-suggestions');
    suggestions.innerHTML = "";
    if(snap.val()) {
        [...new Set(Object.values(snap.val()).map(x => x.name))].forEach(name => {
            suggestions.innerHTML += `<option value="${name}">`;
        });
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

        list.innerHTML += `<tr class="border-b border-slate-50">
            <td class="py-3 text-indigo-600 font-bold">${n}</td>
            <td>${uMon}</td><td>${uMeal}</td><td>${uCost.toFixed(0)}</td>
            <td class="text-rose-500">${pabe > 0 ? pabe.toFixed(0) : '-'}</td>
            <td class="text-emerald-500">${dibe > 0 ? dibe.toFixed(0) : '-'}</td>
        </tr>`;
    });
}

// --- ৫. UI Control ---
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); document.getElementById('sidebar-overlay').classList.toggle('hidden'); }
function openProfile() { 
    rdb.ref('users/' + currentUser).once('value').then(s => {
        document.getElementById('prof-user').innerText = currentUser;
        document.getElementById('user-avatar').innerText = currentUser[0].toUpperCase();
        document.getElementById('prof-date').innerText = "Joined: " + (s.val().joinDate || "Jan 2026");
        document.getElementById('profile-modal').classList.remove('hidden');
    });
}
function closeProfile() { document.getElementById('profile-modal').classList.add('hidden'); }
async function undo() {
    const snap = await rdb.ref('records/' + currentUser).limitToLast(1).once('value');
    if(snap.exists() && confirm("মুছতে চান?")) {
        await rdb.ref('records/' + currentUser + '/' + Object.keys(snap.val())[0]).remove();
        loadData(currentFilter);
    }
}

window.onload = () => {
    if(currentUser) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        loadData('home');
    }
    setTimeout(() => { document.getElementById('splash-screen').style.opacity = '0'; setTimeout(()=>document.getElementById('splash-screen').style.display='none', 600); }, 2000);
      }
