// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyAyNkZvxqdPsa2E2SXnYVsZe1wENJF1I7E",
    authDomain: "amar-hishab-pro.firebaseapp.com",
    databaseURL: "https://amar-hishab-pro-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "amar-hishab-pro",
    storageBucket: "amar-hishab-pro.appspot.com",
    messagingSenderId: "669695299386",
    appId: "1:669695299386:web:c8e58b6249a57123538a03"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
let currentUser = localStorage.getItem('proUser');

// --- AUTH SYSTEM ---
function toggleAuth(isReg) {
    document.getElementById('reg-fields').classList.toggle('hidden', !isReg);
    document.getElementById('login-fields').classList.toggle('hidden', isReg);
    document.getElementById('auth-title').innerText = isReg ? "নতুন অ্যাকাউন্ট" : "স্বাগতম বস!";
}

async function handleRegister() {
    const u = document.getElementById('reg-user').value.trim().toLowerCase();
    const p = document.getElementById('reg-pass').value;
    if(!u || p.length < 4) return toast("সঠিক তথ্য দিন!", "err");
    
    const s = await db.ref('users/' + u).once('value');
    if(s.exists()) return toast("ইউজার নেম বুকড!", "err");
    
    await db.ref('users/' + u).set({ pass: p, created: Date.now() });
    loginSuccess(u);
}

async function handleLogin() {
    const u = document.getElementById('login-user').value.trim().toLowerCase();
    const p = document.getElementById('login-pass').value;
    const s = await db.ref('users/' + u).once('value');
    if(s.exists() && s.val().pass === p) loginSuccess(u);
    else toast("ভুল তথ্য!", "err");
}

function loginSuccess(u) {
    localStorage.setItem('proUser', u);
    location.reload();
}

function logout() {
    localStorage.clear();
    location.reload();
}

// --- CORE LOGIC (Records) ---
async function addRec(type) {
    const d = document.getElementById('desc').value;
    const a = document.getElementById('amt').value;
    if(!d || !a) return toast("সব ঘর পূরণ করুন!");
    
    await db.ref('records/' + currentUser).push({
        desc: d, amt: Number(a), type: type,
        ts: Date.now(), date: new Date().toLocaleDateString('bn-BD')
    });
    
    document.getElementById('desc').value = "";
    document.getElementById('amt').value = "";
    toast("লেনদেন সফল!");
    loadData();
}

async function loadData() {
    const snap = await db.ref('records/' + currentUser).once('value');
    const list = document.getElementById('data-list');
    list.innerHTML = "";
    let iSum = 0, eSum = 0;
    
    if(!snap.exists()) {
        list.innerHTML = `<p class="text-center text-slate-600 text-xs py-10">কোনো ডাটা নেই</p>`;
        return;
    }

    const data = Object.entries(snap.val()).reverse();
    data.forEach(([id, r]) => {
        if(r.type === 'income') iSum += r.amt; else eSum += r.amt;
        const color = r.type === 'income' ? 'emerald' : 'rose';
        list.innerHTML += `
            <div class="glass p-5 rounded-[2rem] flex justify-between items-center animate__animated animate__fadeInUp">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-xl bg-${color}-500/10 text-${color}-500 flex items-center justify-center">
                        <i class="fa-solid ${r.type === 'income' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                    </div>
                    <div>
                        <p class="font-bold text-sm text-white">${r.desc}</p>
                        <p class="text-[8px] font-black opacity-30 uppercase">${r.date}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-lg font-black text-${color}-400">৳${r.amt}</p>
                    <button onclick="delRec('${id}')" class="text-[8px] text-rose-900 font-bold uppercase">Remove</button>
                </div>
            </div>`;
    });

    document.getElementById('t-in').innerText = iSum.toLocaleString();
    document.getElementById('t-ex').innerText = eSum.toLocaleString();
    document.getElementById('balance').innerText = (iSum - eSum).toLocaleString();
}

async function delRec(id) {
    if(confirm("রিমুভ করতে চান?")) {
        await db.ref('records/' + currentUser + '/' + id).remove();
        loadData();
    }
}

// --- UI HELPERS ---
function toast(m, type = "success") {
    const t = document.getElementById('auth-err');
    t.innerText = m;
    t.style.color = type === "success" ? "#34d399" : "#fb7185";
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
}

window.onload = () => {
    setTimeout(() => {
        document.getElementById('splash').classList.add('animate__fadeOut');
        setTimeout(() => document.getElementById('splash').style.display = 'none', 500);
    }, 2000);

    if(currentUser) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('nav-user').innerText = currentUser.toUpperCase();
        document.getElementById('avatar').innerText = currentUser[0].toUpperCase();
        loadData();
    }
};

// --- EGG & MANAGER FUNCTIONS (Simplified Example) ---
// তুমি একই ভাবে 'eggs/' এবং 'manager/' নোডে ডাটা সেভ এবং রিড করতে পারবে।
