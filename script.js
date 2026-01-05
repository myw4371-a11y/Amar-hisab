const db = new Dexie("ProHishabDB");
db.version(1).stores({
    users: "&username, password, joinDate",
    records: "++id, user, desc, amt, type, date, ts"
});

let currentUser = localStorage.getItem('activeUser');
let currentFilter = 'home';

// --- Auth System ---
function toggleAuth(isReg) {
    document.getElementById('reg-fields').classList.toggle('hidden', !isReg);
    document.getElementById('login-fields').classList.toggle('hidden', isReg);
    document.getElementById('auth-title').innerText = isReg ? "রেজিস্ট্রেশন" : "লগইন";
    document.getElementById('auth-error').innerText = "";
}

async function handleRegister() {
    const user = document.getElementById('reg-user').value.trim();
    const p1 = document.getElementById('reg-pass1').value;
    const p2 = document.getElementById('reg-pass2').value;

    if(!user || p1.length < 4) return showError("সঠিক তথ্য দিন");
    if(p1 !== p2) return showError("পাসওয়ার্ড মেলেনি");

    try {
        await db.users.add({
            username: user,
            password: p1,
            joinDate: new Date().toLocaleDateString('bn-BD')
        });
        loginUser(user);
    } catch(e) { showError("এই ইউজার নেমটি আগেই নেয়া হয়েছে!"); }
}

async function handleLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;
    const found = await db.users.get(user);

    if(found && found.password === pass) loginUser(user);
    else showError("ইউজার নেম বা পাসওয়ার্ড ভুল!");
}

function loginUser(user) {
    localStorage.setItem('activeUser', user);
    currentUser = user;
    location.reload();
}

function showError(m) { document.getElementById('auth-error').innerText = m; }

// --- App Logic ---
async function save(type) {
    const desc = document.getElementById('desc').value;
    const amt = document.getElementById('amt').value;
    if(!desc || amt <= 0) return;

    await db.records.add({
        user: currentUser,
        desc,
        amt: Number(amt),
        type,
        date: new Date().toISOString().split('T')[0],
        ts: Date.now()
    });
    document.getElementById('desc').value = "";
    document.getElementById('amt').value = "";
    loadData(currentFilter);
}

async function loadData(filter = 'home') {
    currentFilter = filter;
    const list = document.getElementById('data-list');
    const records = await db.records.where('user').equals(currentUser).toArray();
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

    // Rendering & Sum
    list.innerHTML = "";
    let inSum = 0, exSum = 0;

    filtered.reverse().forEach(r => {
        if(r.type === 'income') inSum += r.amt; else exSum += r.amt;
        list.innerHTML += `
            <div class="bg-white p-5 rounded-3xl shadow-sm flex justify-between items-center animate__animated animate__fadeInUp border-l-8 ${r.type==='income'?'border-emerald-400':'border-rose-400'}">
                <div>
                    <p class="font-black text-slate-800">${r.desc}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">${r.date}</p>
                </div>
                <p class="text-xl font-black ${r.type==='income'?'text-emerald-500':'text-rose-500'}">${r.type==='income'?'+':'-'} ৳${r.amt}</p>
            </div>
        `;
    });

    document.getElementById('sum-in').innerText = inSum;
    document.getElementById('sum-ex').innerText = exSum;
    document.getElementById('total-balance').innerText = inSum - exSum;
    document.getElementById('view-title').innerText = filter === 'home' ? "সব লেনদেন" : "ফিল্টার করা হিসাব";
    if(document.getElementById('sidebar').classList.contains('active')) toggleSidebar();
}

// --- UI Helpers ---
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('sidebar-overlay').classList.toggle('hidden');
}

async function openProfile() {
    const user = await db.users.get(currentUser);
    document.getElementById('prof-user').innerText = user.username;
    document.getElementById('prof-date').innerText = "Joining: " + user.joinDate;
    document.getElementById('profile-modal').classList.remove('hidden');
}

function closeProfile() { document.getElementById('profile-modal').classList.add('hidden'); }

function logout() { localStorage.removeItem('activeUser'); location.reload(); }

async function undo() {
    const recs = await db.records.where('user').equals(currentUser).toArray();
    if(recs.length > 0) {
        await db.records.delete(recs[recs.length-1].id);
        loadData(currentFilter);
    }
}

window.onload = () => {
    if(currentUser) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        loadData('home');
    }
}
