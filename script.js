// ১. ফায়ারবেস সেটআপ
const firebaseConfig = {
    apiKey: "AIzaSyAyNkZvxqdPsa2E2SXnYVsZe1wENJF1I7E",
    authDomain: "amar-hishab-pro.firebaseapp.com",
    projectId: "amar-hishab-pro",
    databaseURL: "https://amar-hishab-pro-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

firebase.initializeApp(firebaseConfig);
const rdb = firebase.database();
let currentUser = localStorage.getItem('activeUserPRO');
let telegramJoined = localStorage.getItem('tgJoin_V3') === 'true';
let currentFilter = 'today';

// --- ২. স্প্ল্যাশ ও টেলিগ্রাম সিকিউরিটি ---
window.onload = () => {
    setTimeout(() => {
        document.getElementById('splash').style.display = 'none';
        if (!telegramJoined) {
            document.getElementById('telegram-lock').classList.remove('hidden');
        } else if (currentUser) {
            startApp();
        } else {
            document.getElementById('auth-screen').classList.remove('hidden');
        }
    }, 2500);
}

function verifyTelegramJoin() {
    localStorage.setItem('tgJoin_V3', 'true');
    location.reload();
}

// --- ৩. অথেন্টিকেশন লজিক (বড় হাতের অক্ষর সাপোর্ট সহ) ---

async function handleRegister() {
    // .toLowerCase() সরিয়ে দেওয়া হয়েছে, তাই বড় হাতের অক্ষরেই জমা হবে
    const user = document.getElementById('reg-user').value.trim();
    const pass = document.getElementById('reg-pass').value;

    if(!user || pass.length < 4) return alert("সঠিক ইউজার নেম ও পাসওয়ার্ড দিন");

    const snap = await rdb.ref('users/' + user).once('value');
    if (snap.exists()) return alert("এই ইউজার আছে!");

    await rdb.ref('users/' + user).set({ 
        pass: pass, 
        joinDate: new Date().toLocaleDateString('bn-BD') 
    });

    alert("রেজিস্ট্রেশন সফল!");
    loginUser(user);
}

async function handleLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;

    if(!user || !pass) return alert("ঘরগুলো পূরণ করুন");

    const snap = await rdb.ref('users/' + user).once('value');
    if(snap.exists()){
        const userData = snap.val();
        if(userData.pass === pass) {
            loginUser(user);
        } else {
            alert("ভুল পাসওয়ার্ড!");
        }
    } else {
        alert("ইউজার পাওয়া যায়নি! বড়/ছোট অক্ষর ঠিক করে লিখুন।");
    }
}

function loginUser(user) { 
    localStorage.setItem('activeUserPRO', user); 
    // সরাসরি মেইন অ্যাপে রিডাইরেক্ট
    window.location.reload(); 
}

function toggleAuth(isReg) {
    document.getElementById('auth-title').innerText = isReg ? "রেজিস্ট্রেশন" : "লগইন";
    document.getElementById('reg-fields').classList.toggle('hidden', !isReg);
    document.getElementById('login-fields').classList.toggle('hidden', isReg);
}
// --- ৪. ডেইলি হিসাব লজিক (Home Page) ---
function startApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('u-char').innerText = currentUser[0].toUpperCase();
    loadDailyData(currentFilter);
}

async function saveDaily() {
    const desc = document.getElementById('daily-desc').value.trim();
    const amt = Number(document.getElementById('daily-amt').value);
    if(!desc || amt <= 0) return;
    await rdb.ref('daily_records/' + currentUser).push({
        desc, amt, ts: Date.now(),
        date: new Date().toISOString().split('T')[0]
    });
    document.getElementById('daily-desc').value = ""; document.getElementById('daily-amt').value = "";
    loadDailyData(currentFilter);
}

async function loadDailyData(filter) {
    currentFilter = filter;
    const snap = await rdb.ref('daily_records/' + currentUser).once('value');
    const records = snap.val() ? Object.values(snap.val()) : [];
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    let filtered = records;
    let label = "আজকের খরচ";

    if(filter === 'today') filtered = records.filter(r => r.date === today);
    else if(filter === 'week') { filtered = records.filter(r => r.ts >= (Date.now() - 7*86400000)); label = "৭ দিনের খরচ"; }
    else if(filter === 'month') { filtered = records.filter(r => r.date.startsWith(today.substring(0,7))); label = "এই মাসের খরচ"; }
    else if(filter === 'year') { filtered = records.filter(r => r.date.startsWith(today.substring(0,4))); label = "এই বছরের খরচ"; }

    const total = filtered.reduce((sum, r) => sum + r.amt, 0);
    document.getElementById('total-summary-amt').innerText = total;
    document.getElementById('view-title').innerText = label;

    const list = document.getElementById('daily-list'); list.innerHTML = "";
    filtered.sort((a,b) => b.ts - a.ts).forEach(r => {
        list.innerHTML += `
            <div class="bg-white p-5 rounded-2xl flex justify-between items-center shadow-sm border-l-4 border-indigo-500">
                <div><p class="font-bold text-slate-800">${r.desc}</p><p class="text-[8px] text-slate-400 uppercase font-black">${r.date}</p></div>
                <p class="text-lg font-black text-indigo-600">৳${r.amt}</p>
            </div>`;
    });
}

async function undoDaily() {
    const snap = await rdb.ref('daily_records/' + currentUser).limitToLast(1).once('value');
    if(snap.exists() && confirm("শেষ এন্ট্রি মুছবেন?")) {
        await rdb.ref('daily_records/' + currentUser + '/' + Object.keys(snap.val())[0]).remove();
        loadDailyData(currentFilter);
    }
}

// --- ৫. ম্যানেজারি হিসাব সাব-সিস্টেম (এডভান্সড) ---
function openManager() { document.getElementById('manager-screen').classList.remove('hidden'); loadManagerHome(); }
function closeManager() { document.getElementById('manager-screen').classList.add('hidden'); }

async function loadManagerHome() {
    const snap = await rdb.ref('manager/'+currentUser).once('value');
    const d = snap.val() || {};
    const tTaka = d.m1 ? Object.values(d.m1).reduce((s,x)=>s+x.amt, 0) : 0;
    const tExp = d.m2 ? Object.values(d.m2).reduce((s,x)=>s+x.amt, 0) : 0;
    const tMeal = d.m3 ? Object.values(d.m3).reduce((s,x)=>s+x.amt, 0) : 0;
    
    document.getElementById('m-total-taka').innerText = tTaka;
    document.getElementById('m-total-exp').innerText = tExp;
    document.getElementById('m-total-meal').innerText = tMeal;
    document.getElementById('m-rate').innerText = tMeal > 0 ? (tExp / tMeal).toFixed(2) : "0.00";
}

// সাব স্ক্রিন কন্ট্রোল (M1, M2, M3, M4)
let activeSub = '';
function openSub(title, type) {
    activeSub = type;
    document.getElementById('sub-title').innerText = title;
    document.getElementById('sub-screen').classList.remove('hidden');
    renderSubInputs(type);
    loadSubList(type);
}

function closeSub() { document.getElementById('sub-screen').classList.add('hidden'); }

async function renderSubInputs(type) {
    const area = document.getElementById('dynamic-inputs'); area.innerHTML = "";
    if(type === 'm1' || type === 'm3') {
        area.innerHTML = `
            <input type="text" id="s-name" placeholder="সদস্যের নাম" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" ${type === 'm3' ? 'list="m1-names"' : ''}>
            <input type="number" id="s-amt" placeholder="${type==='m1' ? 'টাকা' : 'মোট মিল'}" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-2xl">
            <datalist id="m1-names"></datalist>`;
        if(type === 'm3') { // M1 থেকে নাম পপুলেট করা
            const snap = await rdb.ref(`manager/${currentUser}/m1`).once('value');
            const names = snap.exists() ? [...new Set(Object.values(snap.val()).map(x => x.name))] : [];
            const dl = document.getElementById('m1-names');
            names.forEach(n => dl.innerHTML += `<option value="${n}">`);
        }
    } else if(type === 'm2') {
        area.innerHTML = `
            <input type="text" id="s-desc" placeholder="খরচের বিবরণ" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
            <input type="number" id="s-amt" placeholder="টাকার পরিমাণ" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-2xl">`;
    }
    
    document.getElementById('sub-add-btn').onclick = () => saveSubEntry(type);
}

async function saveSubEntry(type) {
    const amt = Number(document.getElementById('s-amt').value);
    if(amt <= 0) return;
    let data = { amt, ts: Date.now() };
    if(type === 'm1' || type === 'm3') data.name = document.getElementById('s-name').value.trim();
    if(type === 'm2') data.desc = document.getElementById('s-desc').value.trim();
    
    await rdb.ref(`manager/${currentUser}/${type}`).push(data);
    loadSubList(type); loadManagerHome();
}

async function loadSubList(type) {
    const snap = await rdb.ref(`manager/${currentUser}/${type}`).once('value');
    const list = document.getElementById('sub-list'); list.innerHTML = "";
    let total = 0;
    if(snap.exists()) {
        Object.entries(snap.val()).reverse().forEach(([id, val]) => {
            total += val.amt;
            list.innerHTML += `
                <div class="bg-white p-5 rounded-2xl flex justify-between items-center shadow-sm">
                    <div>
                        <p class="font-black text-slate-800">${val.name || val.desc}</p>
                        <p class="text-[9px] text-slate-400">${new Date(val.ts).toLocaleDateString()}</p>
                    </div>
                    <div class="flex items-center gap-4">
                        <p class="font-black text-indigo-600">${val.amt}</p>
                        <button onclick="deleteSub('${type}','${id}')" class="text-rose-400"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        });
    }
    document.getElementById('sub-total-label').innerText = "Total: " + total;
}

// M4 (মিল রেট ও ফাইনাল হিসাব) লজিক
async function openM4() {
    activeSub = 'm4';
    document.getElementById('sub-title').innerText = "মিল রেট ও রিপোর্ট";
    document.getElementById('sub-screen').classList.remove('hidden');
    document.getElementById('sub-input-area').classList.add('hidden');
    
    const snap = await rdb.ref('manager/'+currentUser).once('value');
    const d = snap.val() || {};
    const tExp = d.m2 ? Object.values(d.m2).reduce((s,x)=>s+x.amt, 0) : 0;
    const tMeal = d.m3 ? Object.values(d.m3).reduce((s,x)=>s+x.amt, 0) : 0;
    const rate = tMeal > 0 ? (tExp / tMeal) : 0;

    const list = document.getElementById('sub-list'); list.innerHTML = "";
    const m1Data = d.m1 ? Object.values(d.m1) : [];
    const m3Data = d.m3 ? Object.values(d.m3) : [];
    const names = [...new Set(m1Data.map(x => x.name))];

    names.forEach(n => {
        const uTaka = m1Data.filter(x => x.name === n).reduce((s,x)=>s+x.amt, 0);
        const uMeal = m3Data.filter(x => x.name === n).reduce((s,x)=>s+x.amt, 0);
        const uCost = uMeal * rate;
        const diff = uTaka - uCost;

        list.innerHTML += `
            <div class="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-3">
                <div class="flex justify-between items-center border-b pb-2">
                    <p class="font-black text-indigo-600">${n}</p>
                    <p class="text-xs font-bold text-slate-400">মিল: ${uMeal}</p>
                </div>
                <div class="grid grid-cols-2 text-[11px] font-bold text-slate-500">
                    <p>জমা: ৳${uTaka}</p>
                    <p>খরচ: ৳${uCost.toFixed(1)}</p>
                </div>
                <div class="pt-2 text-center">
                    ${diff >= 0 ? 
                        `<p class="text-emerald-500 font-black">ম্যানেজার দিবে: ৳${diff.toFixed(1)}</p>` : 
                        `<p class="text-rose-500 font-black">ম্যানেজার পাবে: ৳${Math.abs(diff).toFixed(1)}</p>`}
                </div>
            </div>`;
    });
}

// --- ৬. ডিমের হিসাব (স্টক লজিক) ---
async function openEgg() {
    activeSub = 'egg';
    document.getElementById('sub-title').innerText = "ডিমের হিসাব";
    document.getElementById('sub-screen').classList.remove('hidden');
    document.getElementById('sub-input-area').classList.remove('hidden');
    document.getElementById('dynamic-inputs').innerHTML = `
        <select id="e-type" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
            <option value="buy">ডিম কেনা (Stock In)</option>
            <option value="use">ডিম খরচ (Stock Out)</option>
        </select>
        <input type="number" id="e-qty" placeholder="সংখ্যা (টি)" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-2xl">`;
    
    document.getElementById('sub-add-btn').onclick = saveEgg;
    loadEggList();
}

async function saveEgg() {
    const type = document.getElementById('e-type').value;
    const qty = Number(document.getElementById('e-qty').value);
    if(qty <= 0) return;
    await rdb.ref(`manager/${currentUser}/eggs`).push({ type, qty, ts: Date.now() });
    loadEggList();
}

async function loadEggList() {
    const snap = await rdb.ref(`manager/${currentUser}/eggs`).once('value');
    const list = document.getElementById('sub-list'); list.innerHTML = "";
    let stock = 0;
    if(snap.exists()){
        Object.entries(snap.val()).reverse().forEach(([id, e]) => {
            if(e.type === 'buy') stock += e.qty; else stock -= e.qty;
            list.innerHTML += `
                <div class="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
                    <p class="font-bold text-slate-700">${e.type==='buy'?'কিনেছে':'খরচ'}</p>
                    <p class="font-black ${e.type==='buy'?'text-emerald-500':'text-rose-500'}">${e.qty} টি</p>
                </div>`;
        });
    }
    document.getElementById('sub-total-label').innerText = "বর্তমানে আছে: " + stock + " টি";
}

// --- ৭. ইউটিলিটি ফাংশনস ---
function toggleSidebar(s) { document.getElementById('sidebar').classList.toggle('active', s); document.getElementById('sidebar-overlay').classList.toggle('hidden', !s); }
function applyFilter(f) { loadDailyData(f); toggleSidebar(false); }
function closeSub() { document.getElementById('sub-screen').classList.add('hidden'); document.getElementById('sub-input-area').classList.remove('hidden'); }
async function resetManager() { if(confirm("পুরো ম্যানেজারি হিসাব রিসেট হবে! নিশ্চিত?")) { await rdb.ref('manager/'+currentUser).remove(); loadManagerHome(); } }
async function deleteSub(t, id) { if(confirm("মুছে ফেলবেন?")) { await rdb.ref(`manager/${currentUser}/${t}/${id}`).remove(); loadSubList(t); loadManagerHome(); } }
async function showProfile() { 
    const s = await rdb.ref('users/'+currentUser).once('value');
    document.getElementById('p-name').innerText = currentUser.toUpperCase();
    document.getElementById('p-avatar').innerText = currentUser[0].toUpperCase();
    document.getElementById('p-join').innerText = s.val().joinDate;
    document.getElementById('profile-screen').classList.remove('hidden'); 
}
function closeProfile() { document.getElementById('profile-screen').classList.add('hidden'); }

// শর্টকাট বাটন বাইন্ডিং
function openM1() { openSub("টাকা জমা (M1)", "m1"); }
function openM2() { openSub("বাজার খরচ (M2)", "m2"); }
function openM3() { openSub("মিল সংখ্যা (M3)", "m3"); }
// লগআউট ফাংশন যা ইউজারকে বের করে দিবে
function handleLogout() {
    if(confirm("আপনি কি নিশ্চিতভাবে লগআউট করতে চান?")) {
        // ফোন থেকে ইউজারের লগইন তথ্য মুছে ফেলা
        localStorage.removeItem('activeUserPRO');
        
        // পেজটি আবার লোড করা যাতে লগইন স্ক্রিন চলে আসে
        window.location.reload();
    }
    }
// ডাউনলোড ফিক্স করার ফাংশন
async function startDownload() {
    // আপনার গিটহাবের সেই ডাইরেক্ট লিঙ্ক
    const apkUrl = "https://github.com/myw4371-a11y/Amar-hisab/raw/refs/heads/main/app-release.apk";
    
    alert("ডাউনলোড শুরু হচ্ছে, দয়া করে অপেক্ষা করুন...");

    try {
        const response = await fetch(apkUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Amar_Hisab_V3.apk'; // ফোনে এই নামে সেভ হবে
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (e) {
        // যদি উপরের কোড কাজ না করে তবে সরাসরি লিঙ্কে নিয়ে যাবে
        window.location.href = apkUrl;
    }
        }
