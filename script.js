// ১. ফায়ারবেস সেটআপ ও গ্লোবাল ভেরিয়েবল
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
let activeSub = '';
let managerStateHistory = []; // UNDO লজিকের জন্য নতুন স্ট্যাক
let isSubEntryLocked = false; // টাকা/মিল এন্ট্রি লক করার জন্য নতুন ভেরিয়েবল
let shoppingListItems = []; // বাজার লিস্টের জন্য নতুন অ্যারে
let bazarStateHistory = []; // বাজার লিস্ট UNDO এর জন্য

// --- ২. স্প্ল্যাশ ও টেলিগ্রাম সিকিউরিটি ---
window.onload = () => {
    // জাভাতে সিঙ্ক করার ফাংশন আছে কি না চেক করে সিঙ্ক শুরু করা
    if (typeof AndroidInterface !== 'undefined' && AndroidInterface.syncDataFromLocal) {
        AndroidInterface.syncDataFromLocal();
    }
    
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

// --- নতুন ইউটিলিটি: ডেট ও লোকাল সেভ ---
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

/**
 * অফলাইন/জাভা ইন্টিগ্রেশনের জন্য
 * ডেটা Firebase-এ সেভ করার আগে জাভা-কে জানানো হবে
 */
function saveDataToDB(refPath, data, key = null) {
    // ১. Firebase এ সেভ (পুশ হলে নতুন কী তৈরি হয়)
    const ref = rdb.ref(refPath);
    let finalKey = key;
    
    if (key) {
        ref.child(key).set(data);
    } else {
        const newRef = ref.push();
        newRef.set(data);
        finalKey = newRef.key;
    }

    // ২. অফলাইন লজিক: জাভা ইন্টারফেসের মাধ্যমে লোকালে সংরক্ষণ
    if (typeof AndroidInterface !== 'undefined' && AndroidInterface.saveDataLocally) {
        // জাভা-কে ডেটা, একটি 'unsynced' ফ্ল্যাগ, এবং Firebase key সহ সেভ করতে বলা
        const localData = { 
            ...data, 
            isSynced: true, // এটি সার্ভারে পাঠানো হচ্ছে, তাই true
            refPath: refPath, 
            firebaseKey: finalKey 
        };
        // ডেটা JSON স্ট্রিং আকারে পাঠানো
        AndroidInterface.saveDataLocally(JSON.stringify(localData), refPath, finalKey);
    }
}

// --- ৩. অথেন্টিকেশন লজিক ---
async function handleRegister() {
    const user = document.getElementById('reg-user').value.trim();
    const pass = document.getElementById('reg-pass').value;

    if(!user || pass.length < 4) return alert("সঠিক ইউজার নেম ও পাসওয়ার্ড দিন");
    
    try {
        const snap = await rdb.ref('users/' + user).once('value');
        if (snap.exists()) return alert("এই ইউজার আছে!");

        // ডেটাবেসে ইউজার সেভ করা
        saveDataToDB('users/' + user, { 
            pass: pass, 
            joinDate: new Date().toLocaleDateString('bn-BD') 
        }, user);

        alert("রেজিস্ট্রেশন সফল!");
        loginUser(user);
    } catch (error) {
        console.error("Firebase Registration Error:", error);
        alert("রেজিস্ট্রেশন ব্যর্থ। Firebase কানেকশন বা Rules চেক করুন।");
    }
}

async function handleLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;

    if(!user || !pass) return alert("ঘরগুলো পূরণ করুন");

    try {
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
    } catch (error) {
        console.error("Firebase Login Error:", error);
        alert("লগইন ব্যর্থ। আপনার Firebase Rules ঠিক আছে কিনা নিশ্চিত করুন।");
    }
}

function loginUser(user) { 
    localStorage.setItem('activeUserPRO', user); 
    // যদি জাভা ইন্টিগ্রেশন থাকে, তবে প্রথম সিঙ্কটি ট্রিগার করা
    if (typeof AndroidInterface !== 'undefined' && AndroidInterface.syncDataFromLocal) {
        AndroidInterface.syncDataFromLocal();
    }
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
    
    // জাভা থেকে ডেটা আনার জন্য ট্রিগার
    if (typeof AndroidInterface !== 'undefined' && AndroidInterface.fetchDataToLocal) {
         AndroidInterface.fetchDataToLocal('daily_records/' + currentUser);
    }
    
    loadDailyData(currentFilter);
    loadManagerHomeSummary(); // হোম পেজে ম্যানেজারি সামারি লোড করা
}

async function saveDaily() {
    const desc = document.getElementById('daily-desc').value.trim();
    const amt = Number(document.getElementById('daily-amt').value);
    if(!desc || amt <= 0) return;
    
    // ডেটাবেসে ইউজার সেভ করা
    saveDataToDB('daily_records/' + currentUser, {
        desc, amt, ts: Date.now(),
        date: getTodayDateString()
    });
    
    document.getElementById('daily-desc').value = ""; document.getElementById('daily-amt').value = "";
    loadDailyData(currentFilter);
}

// ... loadDailyData, applyFilter ফাংশন (আগের মতোই থাকবে) ...
async function loadDailyData(filter) {
    currentFilter = filter;
    
    // প্রথমে Firebase থেকে ডেটা লোড করার চেষ্টা
    let records = [];
    try {
        const snap = await rdb.ref('daily_records/' + currentUser).once('value');
        records = snap.val() ? Object.values(snap.val()) : [];
    } catch (e) {
        // ফেইল করলে অফলাইন ডেটা লোড করার লজিক (যা আপনার জাভা কোডে তৈরি করতে হবে)
        console.warn("Firebase failed, attempting to load from local storage.");
        // AndroidInterface.loadDataFromLocal('daily_records/' + currentUser); 
        // এই ফাংশনটি জাভা তৈরি করলে জাভা ডেটা লোড করে দেবে।
    }
    
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
    // UNDO: Firebase থেকে শেষ এন্ট্রি খুঁজে রিমুভ করা
    const snap = await rdb.ref('daily_records/' + currentUser).limitToLast(1).once('value');
    if(snap.exists() && confirm("শেষ এন্ট্রি মুছবেন?")) {
        const lastEntryKey = Object.keys(snap.val())[0];
        await rdb.ref('daily_records/' + currentUser + '/' + lastEntryKey).remove();
        
        // অফলাইন লজিক: জাভা-কে জানাতে হবে
        if (typeof AndroidInterface !== 'undefined' && AndroidInterface.removeDataLocally) {
            AndroidInterface.removeDataLocally('daily_records/' + currentUser, lastEntryKey);
        }
        
        loadDailyData(currentFilter);
    }
}

// --- ৫. ম্যানেজারি হিসাব সাব-সিস্টেম (এডভান্সড) ---

// নতুন: হোমপেজে ম্যানেজারি সামারি লোড করা
async function loadManagerHomeSummary() {
    const snap = await rdb.ref('manager/'+currentUser).once('value');
    const d = snap.val() || {};
    const tTaka = d.m1 ? Object.values(d.m1).reduce((s,x)=>s+x.amt, 0) : 0;
    const tExp = d.m2 ? Object.values(d.m2).reduce((s,x)=>s+x.amt, 0) : 0;
    const tMeal = d.m3 ? Object.values(d.m3).reduce((s,x)=>s+x.amt, 0) : 0;
    
    // হোম পেজের বাটনে আপডেট
    document.getElementById('home-m-total-taka').innerText = tTaka;
    document.getElementById('home-m-total-exp').innerText = tExp;
    document.getElementById('home-m-total-meal').innerText = tMeal;
}

function openManager() { 
    document.getElementById('manager-screen').classList.remove('hidden'); 
    loadManagerHome(); 
    loadManagerHomeSummary(); // নিশ্চিত করার জন্য আবার লোড
}
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

// নতুন: মেম্বার অ্যাড করার ডায়ালগ
function openAddMemberDialog() {
    document.getElementById('add-member-dialog').classList.remove('hidden');
    document.getElementById('new-member-name').value = '';
}
function closeAddMemberDialog() {
    document.getElementById('add-member-dialog').classList.add('hidden');
}

async function addNewMember() {
    const newName = document.getElementById('new-member-name').value.trim();
    if (!newName) return alert("নাম দিন।");

    // মেম্বার লিস্ট আলাদা করে সেভ করা: শুধুমাত্র নাম
    const memberRef = rdb.ref(`manager/${currentUser}/members/${newName}`);
    const snap = await memberRef.once('value');
    if(snap.exists()) return alert("এই মেম্বার আছেন!");

    saveDataToDB(`manager/${currentUser}/members`, { name: newName, active: true }, newName);
    
    alert(`${newName} যুক্ত হয়েছে!`);
    closeAddMemberDialog();
    renderSubInputs(activeSub); // যদি সাব-স্ক্রিন খোলা থাকে তবে আপডেট করা
}

// সাব স্ক্রিন কন্ট্রোল (M1, M3) - মিল ও টাকা এন্ট্রির জন্য আপডেট করা হলো
let allMembers = [];
async function openSub(title, type) {
    activeSub = type;
    document.getElementById('sub-title').innerText = title;
    document.getElementById('sub-screen').classList.remove('hidden');
    
    // শুধু M3 (মিল) এর জন্য হিস্ট্রি বাটন দেখাও
    document.getElementById('btn-show-history').classList.toggle('hidden', type !== 'm3');
    
    // শুধু M1 (টাকা) এবং M3 (মিল) এর জন্য লক বাটন দেখাও
    document.getElementById('btn-lock-sub-entry').classList.toggle('hidden', type !== 'm1' && type !== 'm3');
    
    isSubEntryLocked = false; // স্ক্রিন খুললে লক উঠিয়ে দেওয়া
    document.getElementById('sub-input-area').classList.remove('input-locked');

    await loadMembers(); // সব মেম্বার লোড করা
    renderSubInputs(type);
    loadSubList(type);
    
    // UNDO স্ট্যাক পরিষ্কার করা
    managerStateHistory = [];
}

async function loadMembers() {
    const snap = await rdb.ref(`manager/${currentUser}/members`).once('value');
    allMembers = snap.val() ? Object.values(snap.val()).map(m => m.name) : [];
}

function closeSub() { 
    document.getElementById('sub-screen').classList.add('hidden'); 
    document.getElementById('sub-input-area').classList.remove('hidden');
    document.getElementById('btn-show-history').classList.add('hidden'); // হিস্ট্রি বাটন হাইড করা
    document.getElementById('btn-lock-sub-entry').classList.add('hidden'); // লক বাটন হাইড করা
}

// M1 ও M3 এর জন্য বাল্ক ইনপুট সিস্টেম
function renderSubInputs(type) {
    const area = document.getElementById('dynamic-inputs'); area.innerHTML = "";
    
    if(type === 'm1' || type === 'm3') {
        const placeholder = type === 'm1' ? 'টাকার পরিমাণ' : 'মোট মিল সংখ্যা';
        
        area.innerHTML = `
            <select id="s-name-select" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
                <option value="All">All (সবার জন্য)</option>
                ${allMembers.map(n => `<option value="${n}">${n}</option>`).join('')}
            </select>
            <input type="number" id="s-amt" placeholder="${placeholder}" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-2xl">
        `;
        
        document.getElementById('sub-add-btn').onclick = () => saveSubEntry(type);
        document.getElementById('sub-undo-btn').onclick = () => undoSubEntry(type);
    } else if (type === 'm2') { // খরচ (আগের মতোই)
        area.innerHTML = `
            <input type="text" id="s-desc" placeholder="খরচের বিবরণ" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
            <input type="number" id="s-amt" placeholder="টাকার পরিমাণ" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-2xl">`;
            
        document.getElementById('sub-add-btn').onclick = () => saveSubEntry(type);
        document.getElementById('sub-undo-btn').onclick = () => undoSubEntry(type);
    }
}

async function saveSubEntry(type) {
    if (isSubEntryLocked) return alert("এন্ট্রি লক করা আছে।");
    
    const amt = Number(document.getElementById('s-amt').value);
    if(amt <= 0) return;
    
    // UNDO জন্য বর্তমান ডেটা সেভ করা
    saveCurrentSubState(type);
    
    const ts = Date.now();
    const date = getTodayDateString();
    
    if (type === 'm1' || type === 'm3') {
        const selectedName = document.getElementById('s-name-select').value;
        
        if (selectedName === 'All') {
            if (allMembers.length === 0) return alert("কোনো মেম্বার নেই। আগে মেম্বার যোগ করুন।");
            
            // বাল্ক এন্ট্রি
            allMembers.forEach(name => {
                saveDataToDB(`manager/${currentUser}/${type}`, { name, amt, ts, date });
            });
            alert(`${amt} সবার জন্য যোগ করা হলো!`);
        } else {
            // সিঙ্গেল এন্ট্রি
            saveDataToDB(`manager/${currentUser}/${type}`, { name: selectedName, amt, ts, date });
            alert(`${selectedName} এর জন্য ${amt} যোগ করা হলো!`);
        }
    } else if(type === 'm2') {
        const desc = document.getElementById('s-desc').value.trim();
        if(!desc) return;
        saveDataToDB(`manager/${currentUser}/${type}`, { desc, amt, ts, date });
        alert(`খরচ ${amt} যোগ করা হলো!`);
    }

    // ইনপুট রিসেট করা
    document.getElementById('s-amt').value = "";
    if (document.getElementById('s-desc')) document.getElementById('s-desc').value = "";
    
    loadSubList(type); 
    loadManagerHome();
}

// নতুন: UNDO লজিক সেভ করা
async function saveCurrentSubState(type) {
    const snap = await rdb.ref(`manager/${currentUser}/${type}`).once('value');
    managerStateHistory.push(snap.val() || {});
}

// নতুন: UNDO ফাংশন
async function undoSubEntry(type) {
    if (managerStateHistory.length === 0) return alert("আর কোনো এন্ট্রি Undo করার নেই।");
    
    const prevState = managerStateHistory.pop();
    
    // Firebase এ আগের অবস্থায় ফিরিয়ে আনা
    const ref = rdb.ref(`manager/${currentUser}/${type}`);
    if (prevState && Object.keys(prevState).length > 0) {
        await ref.set(prevState);
        // অফলাইন লজিক: জাভা-কে জানাতে হবে পুরো নোডটি ওভাররাইড করা হয়েছে
        if (typeof AndroidInterface !== 'undefined' && AndroidInterface.overwriteNodeLocally) {
             AndroidInterface.overwriteNodeLocally(JSON.stringify(prevState), `manager/${currentUser}/${type}`);
        }
    } else {
        await ref.remove(); // যদি prevState খালি হয়
        // অফলাইন লজিক: জাভা-কে জানাতে হবে পুরো নোডটি মুছে ফেলা হয়েছে
        if (typeof AndroidInterface !== 'undefined' && AndroidInterface.removeNodeLocally) {
             AndroidInterface.removeNodeLocally(`manager/${currentUser}/${type}`);
        }
    }
    
    loadSubList(type);
    loadManagerHome();
    alert("Undo সফল!");
}

// নতুন: লক এন্ট্রি ফাংশন
function lockSubEntry() {
    if (isSubEntryLocked) {
        // আনলক লজিক (প্রয়োজনে পাসওয়ার্ড বা অথেন্টিকেশন যোগ করা যেতে পারে)
        isSubEntryLocked = false;
        document.getElementById('sub-input-area').classList.remove('input-locked');
        document.getElementById('btn-lock-sub-entry').innerText = "এন্ট্রি লক করুন";
        alert("এন্ট্রি আনলক হলো।");
    } else {
        // লক লজিক
        isSubEntryLocked = true;
        document.getElementById('sub-input-area').classList.add('input-locked');
        document.getElementById('btn-lock-sub-entry').innerText = "এন্ট্রি আনলক করুন";
        alert("এন্ট্রি লক করা হলো। এখন নতুন ডেটা যোগ হবে না।");
    }
}

// লোড সাবলিস্ট (তারিখ, পেন্সিল আইকন সহ আপডেট করা)
async function loadSubList(type) {
    const snap = await rdb.ref(`manager/${currentUser}/${type}`).once('value');
    const list = document.getElementById('sub-list'); list.innerHTML = "";
    let total = 0;
    
    if (type === 'm2') document.getElementById('sub-total-label').innerText = "Total Expense: 0";
    else if (type === 'm1') document.getElementById('sub-total-label').innerText = "Total Deposit: 0";
    else if (type === 'm3') document.getElementById('sub-total-label').innerText = "Total Meals: 0";
    
    if(snap.exists()) {
        const records = Object.entries(snap.val()).sort(([,a], [,b]) => b.ts - a.ts);
        
        records.forEach(([id, val]) => {
            total += val.amt;
            const dateStr = val.date ? val.date : new Date(val.ts).toLocaleDateString('bn-BD');
            const nameOrDesc = val.name || val.desc || 'N/A';
            const unit = type === 'm3' ? 'টি' : '৳';
            const color = type === 'm1' ? 'text-emerald-600' : type === 'm2' ? 'text-rose-600' : 'text-indigo-600';
            
            list.innerHTML += `
                <div id="entry-${id}" class="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border-l-4 border-slate-200">
                    <div>
                        <p class="font-black text-slate-800">${nameOrDesc}</p>
                        <p class="text-[8px] text-slate-400 uppercase font-black">${dateStr}</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <p class="font-black ${color} text-lg">${val.amt} ${unit}</p>
                        ${(type === 'm1' || type === 'm3' || type === 'm2') ? 
                            `<button onclick="editSubEntry('${type}','${id}','${nameOrDesc}','${val.amt}')" class="text-indigo-400"><i class="fa-solid fa-pencil"></i></button>` : ''}
                        <button onclick="deleteSub('${type}','${id}')" class="text-rose-400"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        });
    }
    
    if (type === 'm2') document.getElementById('sub-total-label').innerText = "Total Expense: " + total;
    else if (type === 'm1') document.getElementById('sub-total-label').innerText = "Total Deposit: " + total;
    else if (type === 'm3') document.getElementById('sub-total-label').innerText = "Total Meals: " + total;
}

// নতুন: এন্ট্রি এডিট করার ফাংশন
function editSubEntry(type, id, nameOrDesc, currentAmt) {
    const newAmt = prompt(`"${nameOrDesc}" এর জন্য নতুন পরিমাণ লিখুন:`, currentAmt);
    if (newAmt !== null) {
        const amt = Number(newAmt);
        if (amt >= 0) {
            // UNDO জন্য বর্তমান ডেটা সেভ করা
            saveCurrentSubState(type);
            
            const refPath = `manager/${currentUser}/${type}/${id}/amt`;
            // ডেটাবেসে আপডেট করা
            saveDataToDB(refPath, amt, id);
            
            loadSubList(type);
            loadManagerHome();
        } else {
            alert("পরিমাণ অবশ্যই ধনাত্মক হতে হবে।");
        }
    }
}

// নতুন: মিল হিস্ট্রি টেবিল
async function showMealHistoryTable() {
    const snap = await rdb.ref(`manager/${currentUser}/m3`).once('value');
    if (!snap.exists()) return alert("কোনো মিল এন্ট্রি পাওয়া যায়নি।");

    const allRecords = snap.val();
    const records = Object.values(allRecords);
    
    // ১. সব মেম্বার এবং তারিখ বের করা
    const members = [...new Set(records.map(r => r.name))].sort();
    const dates = [...new Set(records.map(r => r.date))].sort();

    let tableHTML = `<h3 class="font-black text-slate-800 mb-3">মিল হিস্ট্রি চার্ট</h3><div class="overflow-x-auto"><table class="w-full bg-white rounded-xl shadow-lg text-sm">`;
    
    // ২. হেডারের জন্য তারিখ
    tableHTML += `<thead class="bg-indigo-600 text-white font-bold"><tr><th class="p-2 text-left sticky left-0 bg-indigo-600">মেম্বার</th>`;
    dates.forEach(d => tableHTML += `<th class="p-2 border-l">${d.substring(5).replace('-', '/')}</th>`);
    tableHTML += `<th class="p-2">মোট</th></tr></thead><tbody>`;

    // ৩. রো তৈরি করা (প্রতি মেম্বার)
    members.forEach(member => {
        let memberTotalMeal = 0;
        tableHTML += `<tr class="border-t hover:bg-slate-50">
                        <td class="p-2 font-black sticky left-0 bg-white">${member}</td>`;
        
        dates.forEach(date => {
            const meals = records.filter(r => r.name === member && r.date === date).reduce((sum, r) => sum + r.amt, 0);
            memberTotalMeal += meals;
            const cellColor = meals > 0 ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-slate-400';
            tableHTML += `<td class="p-2 border-l ${cellColor} text-center">${meals > 0 ? meals : '-'}</td>`;
        });
        
        tableHTML += `<td class="p-2 bg-indigo-50 font-black text-center">${memberTotalMeal}</td></tr>`;
    });

    tableHTML += `</tbody></table></div>`;
    
    // স্ক্রিন পরিবর্তন করে টেবিল দেখানো
    document.getElementById('sub-input-area').classList.add('hidden');
    document.getElementById('sub-list').innerHTML = tableHTML;
    document.getElementById('sub-total-label').innerText = `মোট সদস্য: ${members.length}`;
}

// M4 (মিল রেট ও ফাইনাল হিসাব) লজিক (আগের মতোই থাকবে)
async function openM4() {
    activeSub = 'm4';
    document.getElementById('sub-title').innerText = "মিল রেট ও রিপোর্ট";
    document.getElementById('sub-screen').classList.remove('hidden');
    document.getElementById('sub-input-area').classList.add('hidden');
    document.getElementById('btn-show-history').classList.add('hidden');
    document.getElementById('btn-lock-sub-entry').classList.add('hidden');
    
    const snap = await rdb.ref('manager/'+currentUser).once('value');
    const d = snap.val() || {};
    const tExp = d.m2 ? Object.values(d.m2).reduce((s,x)=>s+x.amt, 0) : 0;
    const tMeal = d.m3 ? Object.values(d.m3).reduce((s,x)=>s+x.amt, 0) : 0;
    const rate = tMeal > 0 ? (tExp / tMeal) : 0;

    const list = document.getElementById('sub-list'); list.innerHTML = "";
    const m1Data = d.m1 ? Object.values(d.m1) : [];
    const m3Data = d.m3 ? Object.values(d.m3) : [];
    
    // মেম্বার লিস্টের পরিবর্তে সকল এন্ট্রির নাম ব্যবহার করা
    const names = [...new Set([...m1Data.map(x => x.name), ...m3Data.map(x => x.name)])].filter(Boolean);

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


// --- ৬. ডিমের হিসাব (তারিখ ও UNDO সহ আপডেট করা) ---
async function openEgg() {
    activeSub = 'egg';
    document.getElementById('sub-title').innerText = "ডিমের হিসাব";
    document.getElementById('sub-screen').classList.remove('hidden');
    document.getElementById('sub-input-area').classList.remove('hidden');
    document.getElementById('btn-show-history').classList.add('hidden');
    document.getElementById('btn-lock-sub-entry').classList.add('hidden');
    
    document.getElementById('dynamic-inputs').innerHTML = `
        <select id="e-type" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
            <option value="buy">ডিম কেনা (Stock In)</option>
            <option value="use">ডিম খরচ (Stock Out)</option>
        </select>
        <input type="number" id="e-qty" placeholder="সংখ্যা (টি)" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-2xl">`;
    
    document.getElementById('sub-add-btn').onclick = saveEgg;
    document.getElementById('sub-undo-btn').onclick = () => undoSubEntry('eggs'); // UNDO লজিক ব্যবহার
    
    // UNDO স্ট্যাক পরিষ্কার করা
    managerStateHistory = [];
    loadEggList();
}

async function saveEgg() {
    const type = document.getElementById('e-type').value;
    const qty = Number(document.getElementById('e-qty').value);
    if(qty <= 0) return;
    
    // UNDO জন্য বর্তমান ডেটা সেভ করা
    saveCurrentSubState('eggs');
    
    // ডেটাবেসে সেভ করা
    saveDataToDB(`manager/${currentUser}/eggs`, { type, qty, ts: Date.now(), date: getTodayDateString() });
    
    document.getElementById('e-qty').value = "";
    loadEggList();
}

async function loadEggList() {
    const snap = await rdb.ref(`manager/${currentUser}/eggs`).once('value');
    const list = document.getElementById('sub-list'); list.innerHTML = "";
    let stock = 0;
    if(snap.exists()){
        const records = Object.entries(snap.val()).sort(([,a], [,b]) => b.ts - a.ts);
        records.forEach(([, e]) => {
            if(e.type === 'buy') stock += e.qty; else stock -= e.qty;
            
            const dateStr = e.date ? e.date : new Date(e.ts).toLocaleDateString('bn-BD');
            list.innerHTML += `
                <div class="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
                    <div>
                        <p class="font-bold text-slate-700">${e.type==='buy'?'ডিম কেনা':'ডিম খরচ'}</p>
                        <p class="text-[8px] text-slate-400 uppercase font-black">${dateStr}</p>
                    </div>
                    <p class="font-black ${e.type==='buy'?'text-emerald-500':'text-rose-500'}">${e.qty} টি</p>
                </div>`;
        });
    }
    document.getElementById('sub-total-label').innerText = "বর্তমানে স্টক: " + stock + " টি";
}


// --- ৭. বাজার ও শপিং লিস্ট লজিক ---

function openBazarList() {
    document.getElementById('bazar-screen').classList.remove('hidden');
    loadShoppingList();
    bazarStateHistory = []; // UNDO স্ট্যাক পরিষ্কার করা
}
function closeBazarList() {
    document.getElementById('bazar-screen').classList.add('hidden');
}

// দাম ক্যালকুলেট করা
document.getElementById('bazar-item-qty').addEventListener('input', calculateBazarTotal);
document.getElementById('bazar-item-price').addEventListener('input', calculateBazarTotal);
document.getElementById('bazar-item-unit').addEventListener('change', calculateBazarTotal);

function calculateBazarTotal() {
    let qty = Number(document.getElementById('bazar-item-qty').value);
    const price = Number(document.getElementById('bazar-item-price').value);
    const unit = document.getElementById('bazar-item-unit').value;
    const totalInput = document.getElementById('bazar-item-total');

    if (unit === 'gram') {
        qty = qty / 1000; // গ্রামে ইনপুট দিলে কেজিতে কনভার্ট
    }
    
    const total = qty * price;
    totalInput.value = total > 0 ? total.toFixed(2) : '0.00';
}

function saveBazarItem() {
    const name = document.getElementById('bazar-item-name').value.trim();
    const qty = Number(document.getElementById('bazar-item-qty').value);
    const unit = document.getElementById('bazar-item-unit').value;
    const price = Number(document.getElementById('bazar-item-price').value);
    const total = Number(document.getElementById('bazar-item-total').value);

    if (!name || qty <= 0 || price <= 0 || total <= 0) return alert("সব ঘর পূরণ করুন।");

    // UNDO জন্য বর্তমান ডেটা সেভ করা
    bazarStateHistory.push([...shoppingListItems]);
    
    const newItem = { id: Date.now(), name, qty, unit, price, totalPrice: total };
    shoppingListItems.push(newItem);
    
    // ইনপুট রিসেট করা
    document.getElementById('bazar-item-name').value = '';
    document.getElementById('bazar-item-qty').value = '';
    document.getElementById('bazar-item-price').value = '';
    document.getElementById('bazar-item-total').value = '0.00';
    
    loadShoppingList();
}

function undoBazar() {
    if (bazarStateHistory.length === 0) return alert("আর কোনো এন্ট্রি Undo করার নেই।");
    
    shoppingListItems = bazarStateHistory.pop();
    loadShoppingList();
    alert("বাজার লিস্ট Undo সফল!");
}

function loadShoppingList() {
    const container = document.getElementById('bazar-list-container');
    container.innerHTML = "";
    
    let grandTotal = 0;
    
    shoppingListItems.forEach(item => {
        grandTotal += item.totalPrice;
        
        container.innerHTML += `
            <div id="bazar-item-${item.id}" class="bg-slate-50 p-3 rounded-xl flex justify-between items-center shadow-sm">
                <p class="font-bold text-slate-800 flex-1">${item.name} 
                    <span class="text-xs font-medium text-slate-500 ml-2">(${item.qty} ${item.unit} @ ৳${item.price})</span>
                </p>
                <div class="flex items-center gap-3">
                    <p class="font-black text-rose-600">৳${item.totalPrice.toFixed(2)}</p>
                    <button onclick="editBazarItem(${item.id})" class="text-indigo-400"><i class="fa-solid fa-pencil"></i></button>
                </div>
            </div>`;
    });
    
    document.getElementById('bazar-grand-total').innerText = grandTotal.toFixed(2);
}

function editBazarItem(itemId) {
    const itemIndex = shoppingListItems.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;
    
    const item = shoppingListItems[itemIndex];
    const newQty = prompt(`"${item.name}" এর নতুন পরিমাণ (Qty) দিন:`, item.qty);
    
    if (newQty !== null) {
        // UNDO জন্য বর্তমান ডেটা সেভ করা
        bazarStateHistory.push([...shoppingListItems]);
        
        item.qty = Number(newQty);
        let correctedQty = item.qty;
        if (item.unit === 'gram') correctedQty = item.qty / 1000;
        
        item.totalPrice = correctedQty * item.price;
        
        shoppingListItems[itemIndex] = item;
        loadShoppingList();
    }
}

async function saveAsExpense() {
    if (shoppingListItems.length === 0) return alert("লিস্টে কোনো আইটেম নেই।");
    
    const grandTotal = Number(document.getElementById('bazar-grand-total').innerText);
    
    if (confirm(`৳${grandTotal.toFixed(2)} কি খরচ হিসেবে যোগ করবেন? একবার সেভ করলে লিস্ট পরিবর্তন করা যাবে না।`)) {
        
        // ১. মেইন খরচের খাতায় যোগ করা (দৈনিক হিসাবে)
        saveDataToDB('daily_records/' + currentUser, {
            desc: `বাজার (শপিং লিস্ট)`, 
            amt: grandTotal, 
            ts: Date.now(), 
            date: getTodayDateString()
        });
        
        // ২. মেইন ম্যানেজারি খরচের খাতায় যোগ করা (M2)
        saveDataToDB(`manager/${currentUser}/m2`, {
            desc: `বাজার (শপিং লিস্ট)`, 
            amt: grandTotal, 
            ts: Date.now(),
            date: getTodayDateString()
        });
        
        // ৩. শপিং লিস্ট লক ও পরিষ্কার করা
        shoppingListItems = [];
        bazarStateHistory = [];
        loadShoppingList(); // তালিকা খালি হয়ে যাবে
        
        // ৪. ইউআই আপডেট
        loadDailyData(currentFilter);
        loadManagerHomeSummary();
        
        alert(`৳${grandTotal.toFixed(2)} সফলভাবে খরচ হিসেবে যোগ করা হয়েছে!`);
        closeBazarList();
    }
}

// --- ৮. ইউটিলিটি ফাংশনস ---
function toggleSidebar(s) { document.getElementById('sidebar').classList.toggle('active', s); document.getElementById('sidebar-overlay').classList.toggle('hidden', !s); }
function applyFilter(f) { loadDailyData(f); toggleSidebar(false); }
// closeSub() ফাংশন উপরে আপডেট করা হয়েছে

async function resetManager() { 
    if(confirm("পুরো ম্যানেজারি হিসাব রিসেট হবে! নিশ্চিত?")) { 
        await rdb.ref('manager/'+currentUser).remove(); 
        // অফলাইন লজিক: জাভা-কে জানাতে হবে পুরো নোডটি মুছে ফেলা হয়েছে
        if (typeof AndroidInterface !== 'undefined' && AndroidInterface.removeNodeLocally) {
             AndroidInterface.removeNodeLocally('manager/' + currentUser);
        }
        loadManagerHome(); 
        loadManagerHomeSummary();
        alert("ম্যানেজারি হিসাব সফলভাবে রিসেট করা হয়েছে।");
    } 
}
async function deleteSub(t, id) { 
    if(confirm("মুছে ফেলবেন?")) { 
        // UNDO জন্য বর্তমান ডেটা সেভ করা
        saveCurrentSubState(t);
        
        await rdb.ref(`manager/${currentUser}/${t}/${id}`).remove(); 
        
        // অফলাইন লজিক: জাভা-কে জানাতে হবে
        if (typeof AndroidInterface !== 'undefined' && AndroidInterface.removeDataLocally) {
            AndroidInterface.removeDataLocally(`manager/${currentUser}/${t}`, id);
        }
        
        loadSubList(t); 
        loadManagerHome(); 
        loadManagerHomeSummary();
    } 
}
async function showProfile() { 
    const s = await rdb.ref('users/'+currentUser).once('value');
    document.getElementById('p-name').innerText = currentUser.toUpperCase();
    document.getElementById('p-avatar').innerText = currentUser[0].toUpperCase();
    document.getElementById('p-join').innerText = s.val() ? s.val().joinDate : 'N/A';
    document.getElementById('profile-screen').classList.remove('hidden'); 
}
function closeProfile() { document.getElementById('profile-screen').classList.add('hidden'); }

// নতুন: ইনফো ডায়ালগ ফাংশন
function showInfo() {
    document.getElementById('info-dialog').classList.remove('hidden');
}
function closeInfoDialog() {
    document.getElementById('info-dialog').classList.add('hidden');
}

// শর্টকাট বাটন বাইন্ডিং
function openM1() { openSub("টাকা জমা (M1)", "m1"); }
function openM2() { openSub("বাজার খরচ (M2)", "m2"); }
function openM3() { openSub("মিল সংখ্যা (M3)", "m3"); }
// openM4() - উপরে আছে
// openEgg() - উপরে আছে
// openBazarList() - উপরে আছে

// লগআউট ফাংশন
function handleLogout() {
    if(confirm("আপনি কি নিশ্চিতভাবে লগআউট করতে চান?")) {
        localStorage.removeItem('activeUserPRO');
        window.location.reload();
    }
}
// ডাউনলোড ফিক্স করার ফাংশন
async function startDownload() {
    const apkUrl = "https://github.com/myw4371-a11y/Amar-hisab/raw/refs/heads/main/app-release.apk";
    
    alert("ডাউনলোড শুরু হচ্ছে, দয়া করে অপেক্ষা করুন...");

    try {
        const response = await fetch(apkUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Amar_Hisab_V3.apk';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (e) {
        window.location.href = apkUrl;
    }
                         }
