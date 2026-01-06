// ১. Firebase Setup (আপনার লিঙ্কগুলো ঠিক আছে)
const firebaseConfig = {
  apiKey: "AIzaSyAyNkZvxqdPsa2E2SXnYVsZe1wENJF1I7E",
  authDomain: "amar-hishab-pro.firebaseapp.com",
  projectId: "amar-hishab-pro",
  databaseURL: "https://amar-hishab-pro-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

firebase.initializeApp(firebaseConfig);
const rdb = firebase.database();
let currentUser = localStorage.getItem('activeUserPRO');
let currentFilter = 'home';
let managerType = '';

// --- ২. Auth Logic ---
function toggleAuth(isReg) {
    document.getElementById('reg-box').classList.toggle('hidden', !isReg);
    document.getElementById('login-box').classList.toggle('hidden', isReg);
    document.getElementById('auth-title').innerText = isReg ? "রেজিস্ট্রেশন" : "লগইন";
}

async function handleRegister() {
    const user = document.getElementById('r-user').value.trim().toLowerCase();
    const pass = document.getElementById('r-pass').value;
    if(!user || pass.length < 4) return msg("সঠিক তথ্য দিন");
    const s = await rdb.ref('users/' + user).once('value');
    if(s.exists()) return msg("ইউজার আছে");
    await rdb.ref('users/' + user).set({ pass, date: new Date().toLocaleDateString('bn-BD') });
    login(user);
}

async function handleLogin() {
    const user = document.getElementById('l-user').value.trim().toLowerCase();
    const pass = document.getElementById('l-pass').value;
    const s = await rdb.ref('users/' + user).once('value');
    if(s.exists() && s.val().pass === pass) login(user);
    else msg("ভুল তথ্য");
}

function login(u) { localStorage.setItem('activeUserPRO', u); location.reload(); }
function msg(m) { const e = document.getElementById('error-msg'); e.innerText = m; e.classList.remove('hidden'); }

// --- ৩. Core Hishab Logic (Filter Perfect Fix) ---
async function saveRec(type) {
    const desc = document.getElementById('desc').value;
    const amt = document.getElementById('amt').value;
    if(!desc || !amt) return;
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
    const data = snap.val() ? Object.values(snap.val()) : [];
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const month = today.substring(0, 7);
    const year = today.substring(0, 4);

    let filtered = data;
    if(filter === 'today') filtered = data.filter(r => r.date === today);
    else if(filter === 'week') filtered = data.filter(r => r.ts >= (Date.now() - 7*86400000));
    else if(filter === 'month') filtered = data.filter(r => r.date.startsWith(month));
    else if(filter === 'year') filtered = data.filter(r => r.date.startsWith(year));
    else if(filter === 'last_month') {
        let lm = new Date(); lm.setMonth(lm.getMonth()-1);
        filtered = data.filter(r => r.date.startsWith(lm.toISOString().substring(0, 7)));
    }

    const list = document.getElementById('data-list'); list.innerHTML = "";
    let inS = 0, exS = 0;

    filtered.sort((a,b) => b.ts - a.ts).forEach(r => {
        const color = r.type === 'income' ? 'emerald' : 'rose';
        if(r.type === 'income') inS += r.amt; else exS += r.amt;
        list.innerHTML += `
            <div class="bg-white p-5 rounded-[2rem] shadow-sm flex justify-between items-center border border-slate-50">
                <div><p class="font-bold text-slate-800 text-sm">${r.desc}</p><p class="text-[8px] text-slate-400 font-black">${r.date}</p></div>
                <p class="font-black text-${color}-500">৳${r.amt}</p>
            </div>`;
    });

    document.getElementById('in-sum').innerText = inS;
    document.getElementById('ex-sum').innerText = exS;
    document.getElementById('bal').innerText = inS - exS;
    document.getElementById('filter-text').innerText = filter.toUpperCase();
    toggleSidebar(false);
}

// --- ৪. Manager Logic ---
function openManager() { document.getElementById('manager-screen').classList.remove('hidden'); loadManager(); }
function closeManager() { document.getElementById('manager-screen').classList.add('hidden'); }

function mAdd(type) {
    managerType = type;
    document.getElementById('m-modal-title').innerText = type === 'money' ? 'টাকা জমা' : type === 'exp' ? 'বাজার খরচ' : 'মিল সংখ্যা';
    document.getElementById('m-modal').classList.remove('hidden');
}

async function saveMEntry() {
    const name = document.getElementById('m-name').value.trim();
    const amt = Number(document.getElementById('m-amt').value);
    if(!name || !amt) return;
    await rdb.ref('manager/'+currentUser+'/'+managerType).push({ name, amt, ts: Date.now() });
    document.getElementById('m-amt').value = ""; document.getElementById('m-modal').classList.add('hidden');
    loadManager();
}

async function loadManager() {
    const snap = await rdb.ref('manager/'+currentUser).once('value');
    const d = snap.val() || {};
    const monL = d.money ? Object.values(d.money) : [];
    const expL = d.exp ? Object.values(d.exp) : [];
    const melL = d.meal ? Object.values(d.meal) : [];

    let tMon = monL.reduce((s,x)=>s+x.amt, 0);
    let tExp = expL.reduce((s,x)=>s+x.amt, 0);
    let tMel = melL.reduce((s,x)=>s+x.amt, 0);
    let rate = tMel > 0 ? tExp / tMel : 0;

    document.getElementById('m-total-cash').innerText = tMon;
    document.getElementById('m-total-exp').innerText = tExp;
    document.getElementById('m-total-meal').innerText = tMel;
    document.getElementById('m-rate').innerText = rate.toFixed(2);

    const list = document.getElementById('m-list'); list.innerHTML = "";
    const names = [...new Set([...monL.map(x=>x.name), ...melL.map(x=>x.name)])];

    names.forEach(n => {
        let uMon = monL.filter(x=>x.name===n).reduce((s,x)=>s+x.amt, 0);
        let uMel = melL.filter(x=>x.name===n).reduce((s,x)=>s+x.amt, 0);
        let uCost = uMel * rate;
        let diff = uMon - uCost;
        list.innerHTML += `<tr class="border-b">
            <td class="p-4 text-indigo-600">${n}</td>
            <td>${uMon}</td><td>${uMel}</td><td>${uCost.toFixed(0)}</td>
            <td class="${diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}">${diff >= 0 ? 'পাবে' : 'দিবে'}</td>
        </tr>`;
    });
}

// --- ৫. Extra Functions ---
function toggleSidebar(show) { 
    document.getElementById('sidebar').classList.toggle('active', show); 
    document.getElementById('sidebar-overlay').classList.toggle('hidden', !show); 
}
function logout() { localStorage.removeItem('activeUserPRO'); location.reload(); }

async function resetManager() {
    if(confirm("সব ম্যানেজারি ডাটা মুছে যাবে! নিশ্চিত?")) {
        await rdb.ref('manager/'+currentUser).remove(); loadManager();
    }
}

function openProfile() { alert("ইউজার: " + currentUser.toUpperCase()); }

// --- ৬. Initialization ---
window.onload = () => {
    setTimeout(() => {
        document.getElementById('splash').style.display = 'none';
        if(currentUser) {
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            document.getElementById('u-initial').innerText = currentUser[0].toUpperCase();
            loadData('home');
        }
    }, 2000);
                               }
