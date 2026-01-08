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
let managerStateHistory = []; 
let isSubEntryLocked = false; 
let bazarListItems = []; // 'shoppingListItems' থেকে 'bazarListItems' এ পরিবর্তন
let bazarStateHistory = []; 

// --- নতুন UI/UX ইউটিলিটি: কাস্টম পপ-আপ/অ্যালার্ট ---
function customAlert(message) {
    if (document.getElementById('custom-alert')) {
        document.getElementById('custom-alert-message').innerText = message;
        document.getElementById('custom-alert').classList.remove('hidden');
    } else {
        alert(message); 
    }
}

function customConfirm(message) {
    if (document.getElementById('custom-confirm')) {
        return new Promise(resolve => {
            document.getElementById('custom-confirm-message').innerText = message;
            document.getElementById('custom-confirm-yes').onclick = () => {
                document.getElementById('custom-confirm').classList.add('hidden');
                resolve(true);
            };
            document.getElementById('custom-confirm-no').onclick = () => {
                document.getElementById('custom-confirm').classList.add('hidden');
                resolve(false);
            };
            document.getElementById('custom-confirm').classList.remove('hidden');
        });
    } else {
        return Promise.resolve(confirm(message)); 
    }
}

function closeCustomAlert() {
    const alertDiv = document.getElementById('custom-alert');
    if (alertDiv) {
        alertDiv.classList.add('hidden');
    }
}
function closeCustomConfirm() {
    const confirmDiv = document.getElementById('custom-confirm');
    if (confirmDiv) {
        confirmDiv.classList.add('hidden');
    }
}

// --- ২. স্প্ল্যাশ ও টেলিগ্রাম সিকিউরিটি (অপরিবর্তিত) ---
window.onload = () => {
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

// --- নতুন ইউটিলিটি: ডেট ও লোকাল সেভ (অপরিবর্তিত) ---
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

function saveDataToDB(refPath, data, key = null) {
    const ref = rdb.ref(refPath);
    let finalKey = key;
    
    if (key) {
        ref.child(key).set(data);
    } else {
        const newRef = ref.push();
        newRef.set(data);
        finalKey = newRef.key;
    }

    if (typeof AndroidInterface !== 'undefined' && AndroidInterface.saveDataLocally) {
        const localData = { 
            ...data, 
            isSynced: true, 
            refPath: refPath, 
            firebaseKey: finalKey 
        };
        AndroidInterface.saveDataLocally(JSON.stringify(localData), refPath, finalKey);
    }
}

// --- ৩. অথেন্টিকেশন লজিক (অপরিবর্তিত) ---
async function handleRegister() {
    const user = document.getElementById('reg-user').value.trim();
    const pass = document.getElementById('reg-pass').value;

    if(!user || pass.length < 4) return customAlert("সঠিক ইউজার নেম ও পাসওয়ার্ড দিন");
    
    try {
        const snap = await rdb.ref('users/' + user).once('value');
        if (snap.exists()) return customAlert("এই ইউজার আছে!");

        saveDataToDB('users/' + user, { 
            pass: pass, 
            joinDate: new Date().toLocaleDateString('bn-BD') 
        }, user);

        customAlert("রেজিস্ট্রেশন সফল!");
        loginUser(user);
    } catch (error) {
        console.error("Firebase Registration Error:", error);
        customAlert("রেজিস্ট্রেশন ব্যর্থ।");
    }
}

async function handleLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;

    if(!user || !pass) return customAlert("ঘরগুলো পূরণ করুন");

    try {
        const snap = await rdb.ref('users/' + user).once('value');
        if(snap.exists()){
            const userData = snap.val();
            if(userData.pass === pass) {
                loginUser(user);
            } else {
                customAlert("ভুল পাসওয়ার্ড!");
            }
        } else {
            customAlert("ইউজার পাওয়া যায়নি! বড়/ছোট অক্ষর ঠিক করে লিখুন।");
        }
    } catch (error) {
        console.error("Firebase Login Error:", error);
        customAlert("লগইন ব্যর্থ।");
    }
}

function loginUser(user) { 
    localStorage.setItem('activeUserPRO', user); 
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

// --- ৪. ডেইলি হিসাব লজিক (Home Page) (অপরিবর্তিত) ---
function startApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('u-char').innerText = currentUser[0].toUpperCase();
    
    if (typeof AndroidInterface !== 'undefined' && AndroidInterface.fetchDataToLocal) {
         AndroidInterface.fetchDataToLocal('daily_records/' + currentUser);
    }
    
    loadDailyData(currentFilter);
    loadManagerHomeSummary(); 
}

async function saveDaily() {
    const desc = document.getElementById('daily-desc').value.trim();
    const amt = Number(document.getElementById('daily-amt').value);
    if(!desc || amt <= 0) return customAlert("বিবরণ ও পরিমাণ লিখুন।");
    
    saveDataToDB('daily_records/' + currentUser, {
        desc, amt, ts: Date.now(),
        date: getTodayDateString()
    });
    
    document.getElementById('daily-desc').value = ""; document.getElementById('daily-amt').value = "";
    loadDailyData(currentFilter);
}

async function editDailyEntry(id, currentDesc, currentAmt) {
    const newAmt = prompt(`"${currentDesc}" (৳${currentAmt}) এর জন্য নতুন পরিমাণ লিখুন:`, currentAmt);
    
    if (newAmt !== null) {
        const amt = Number(newAmt);
        if (amt >= 0) {
            const confirmed = await customConfirm("এই এন্ট্রি আপডেট করবেন?");
            if (confirmed) {
                // Daily records এর জন্য managerStateHistory ব্যবহার করা হচ্ছে না
                
                await rdb.ref(`daily_records/${currentUser}/${id}/amt`).set(amt);
                
                if (typeof AndroidInterface !== 'undefined' && AndroidInterface.updateDataLocally) {
                     AndroidInterface.updateDataLocally(`daily_records/${currentUser}`, id, JSON.stringify({amt: amt}));
                }
                
                loadDailyData(currentFilter);
                customAlert("এন্ট্রি সফলভাবে আপডেট হয়েছে।");
            }
        } else {
            customAlert("পরিমাণ অবশ্যই ধনাত্মক হতে হবে।");
        }
    }
}

async function loadDailyData(filter) {
    currentFilter = filter;
    
    let records = [];
    try {
        const snap = await rdb.ref('daily_records/' + currentUser).once('value');
        records = snap.val() ? Object.entries(snap.val()).map(([key, val]) => ({...val, id: key})) : [];
    } catch (e) {}
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    let filtered = records;
    let label = "আজকের খরচ";

    if(filter === 'today') filtered = records.filter(r => r.date === today);
    else if(filter === 'week') { filtered = records.filter(r => r.ts >= (Date.now() - 7*86400000)); label = "৭ দিনের খরচ"; }
    else if(filter === 'month') { filtered = records.filter(r => r.date.startsWith(today.substring(0,7))); label = "এই মাসের খরচ"; }
    else if(filter === 'year') { filtered = records.filter(r => r.ts >= (Date.now() - 365*86400000)); label = "এই বছরের খরচ"; } // বছরের ফিল্টারিং ঠিক করা হলো

    const total = filtered.reduce((sum, r) => sum + r.amt, 0);
    document.getElementById('total-summary-amt').innerText = total;
    document.getElementById('view-title').innerText = label;

    const list = document.getElementById('daily-list'); list.innerHTML = "";
    filtered.sort((a,b) => b.ts - a.ts).forEach(r => {
        list.innerHTML += `
            <div class="bg-white p-5 rounded-2xl flex justify-between items-center shadow-sm border-l-4 border-indigo-500">
                <div><p class="font-bold text-slate-800">${r.desc}</p><p class="text-[8px] text-slate-400 uppercase font-black">${r.date}</p></div>
                <div class="flex items-center gap-3">
                    <p class="text-lg font-black text-indigo-600">৳${r.amt}</p>
                    <button onclick="editDailyEntry('${r.id}','${r.desc.replace(/'/g, "\\'")}',${r.amt})" class="text-indigo-400"><i class="fa-solid fa-pencil"></i></button>
                    <button onclick="deleteSub('daily_records', '${r.id}')" class="text-rose-400"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
    });
}

async function undoDaily() {
    const confirmed = await customConfirm("শেষ এন্ট্রি মুছবেন?");
    if (confirmed) {
        const snap = await rdb.ref('daily_records/' + currentUser).limitToLast(1).once('value');
        if(snap.exists()) {
            const lastEntryKey = Object.keys(snap.val())[0];
            await rdb.ref('daily_records/' + currentUser + '/' + lastEntryKey).remove();
            
            if (typeof AndroidInterface !== 'undefined' && AndroidInterface.removeDataLocally) {
                AndroidInterface.removeDataLocally('daily_records/' + currentUser, lastEntryKey);
            }
            
            loadDailyData(currentFilter);
            customAlert("শেষ এন্ট্রি মুছে ফেলা হয়েছে।");
        } else {
             customAlert("মুছে ফেলার জন্য কোনো এন্ট্রি নেই।");
        }
    }
}

// --- ৫. ম্যানেজারি হিসাব সাব-সিস্টেম (আপডেট করা হয়েছে) ---

// ম্যানেজারি বাটনের পাশে সংক্ষিপ্ত সামারি দেখানো বন্ধ
async function loadManagerHomeSummary() {
    document.getElementById('manager-m1-text').innerText = "";
    document.getElementById('manager-m2-text').innerText = "";
    document.getElementById('manager-m3-text').innerText = "";
    document.getElementById('manager-m4-text').innerText = "";
    document.getElementById('manager-eggs-text').innerText = "";
    
    // ডেটা ক্যালকুলেশন লজিক (অন্যান্য ফাংশনের জন্য রাখা হলো)
    try {
        const snap = await rdb.ref(`manager/${currentUser}`).once('value');
        const data = snap.val();
        let totalDeposit = 0;
        let totalExpense = 0;
        let totalMeal = 0;
        let eggStock = 0;
        
        if (data) {
            // ... (ক্যালকুলেশন লজিক)
            let millRate = 0;
            // ...
        }
    } catch (error) {
        console.error("Manager Summary Load Error:", error);
    }
}

// --- নতুন সাব-সিস্টেম: বাজার লিস্টকে ম্যানেজারে ইন্টিগ্রেট করা ---
async function openBazarEntry() {
    activeSub = 'bazar';
    document.getElementById('sub-title').innerText = "বাজার লিস্ট"; // নাম পরিবর্তন
    document.getElementById('sub-screen').classList.remove('hidden');
    document.getElementById('sub-input-area').classList.remove('hidden');
    
    document.getElementById('btn-show-history').classList.remove('hidden');
    document.getElementById('btn-show-history').innerText = "বাজার লিস্ট দেখান";
    document.getElementById('btn-show-history').onclick = loadBazarListTable;
    
    document.getElementById('btn-lock-sub-entry').classList.add('hidden');
    document.getElementById('sub-undo-btn').onclick = undoBazar;
    
    // ডায়নামিক ইনপুট এরিয়াতে বাজারের এন্ট্রি ফর্ম লোড করা
    document.getElementById('dynamic-inputs').innerHTML = `
        <input type="text" id="bazar-item-name" placeholder="পণ্যের নাম" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
        <div class="grid grid-cols-2 gap-2">
            <input type="number" id="bazar-item-qty" placeholder="সংখ্যা/পরিমাণ" class="w-full p-4 bg-slate-50 rounded-2xl outline-none">
            <select id="bazar-item-unit" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
                <option value="kg">KG</option>
                <option value="gram">GRAM</option>
                <option value="pcs">Pcs</option>
            </select>
        </div>
        <input type="number" id="bazar-item-price" placeholder="প্রতি ইউনিটের দাম (৳)" class="w-full p-4 bg-slate-50 rounded-2xl outline-none">
        <input type="text" id="bazar-item-total" placeholder="মোট খরচ" class="w-full p-4 bg-indigo-50 rounded-2xl outline-none font-black text-2xl" readonly value="0.00">
    `;
    
    document.getElementById('sub-add-btn').onclick = saveBazarItemFromManager;
    
    const qtyInput = document.getElementById('bazar-item-qty');
    const priceInput = document.getElementById('bazar-item-price');
    const unitSelect = document.getElementById('bazar-item-unit');
    
    if (qtyInput) qtyInput.oninput = calculateBazarTotal;
    if (priceInput) priceInput.oninput = calculateBazarTotal;
    if (unitSelect) unitSelect.onchange = calculateBazarTotal;
    
    loadBazarListTable();
}

function calculateBazarTotal() {
    const qty = Number(document.getElementById('bazar-item-qty').value);
    const price = Number(document.getElementById('bazar-item-price').value);
    const unit = document.getElementById('bazar-item-unit').value;
    
    let total = 0;
    
    if (qty > 0 && price > 0) {
        let correctedQty = qty;
        if (unit === 'gram') correctedQty = qty / 1000;
        total = correctedQty * price;
    }
    document.getElementById('bazar-item-total').value = total.toFixed(2);
}

function saveBazarItemFromManager() {
    const name = document.getElementById('bazar-item-name').value.trim();
    const qty = Number(document.getElementById('bazar-item-qty').value);
    const unit = document.getElementById('bazar-item-unit').value;
    const price = Number(document.getElementById('bazar-item-price').value);
    const total = Number(document.getElementById('bazar-item-total').value);

    if (!name || qty <= 0 || price <= 0 || total <= 0) return customAlert("সব ঘর পূরণ করুন।");

    bazarStateHistory.push([...bazarListItems]);
    
    const newItem = { id: Date.now(), name, qty, unit, price, totalPrice: total };
    bazarListItems.push(newItem);
    
    document.getElementById('bazar-item-name').value = '';
    document.getElementById('bazar-item-qty').value = '';
    document.getElementById('bazar-item-price').value = '';
    document.getElementById('bazar-item-total').value = '0.00';
    
    loadBazarListTable();
    customAlert("পণ্য বাজার লিস্টে যোগ হয়েছে।");
}

function loadBazarListTable() { 
    const container = document.getElementById('sub-list');
    container.innerHTML = "";
    
    let grandTotal = 0;
    
    bazarListItems.forEach(item => {
        grandTotal += item.totalPrice;
        
        container.innerHTML += `
            <div id="bazar-item-${item.id}" class="bg-slate-50 p-3 rounded-xl flex justify-between items-center shadow-sm">
                <p class="font-bold text-slate-800 flex-1">${item.name} 
                    <span class="text-xs font-medium text-slate-500 ml-2">(${item.qty} ${item.unit} @ ৳${item.price.toFixed(1)})</span>
                </p>
                <div class="flex items-center gap-3">
                    <p class="font-black text-rose-600">৳${item.totalPrice.toFixed(2)}</p>
                    <button onclick="editBazarItemInPlace(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.qty}, '${item.unit}', ${item.price})" class="text-indigo-400"><i class="fa-solid fa-pencil"></i></button>
                    <button onclick="deleteBazarItem(${item.id})" class="text-rose-400"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
    });
    
    document.getElementById('sub-total-label').innerText = `মোট: ৳${grandTotal.toFixed(2)} | আইটেম: ${bazarListItems.length}`;
    
    if(bazarListItems.length > 0) {
        container.innerHTML += `<button onclick="saveBazarAsExpense()" class="mt-5 w-full bg-emerald-600 text-white font-black p-4 rounded-xl">৳${grandTotal.toFixed(2)} খরচ হিসেবে সেভ করুন</button>`;
    }
}

async function editBazarItemInPlace(id, name, qty, unit, price) {
    const newQty = prompt(`"${name}" (${unit} @ ৳${price}) এর নতুন পরিমাণ (Qty) দিন:`, qty);
    
    if (newQty !== null) {
        const itemIndex = bazarListItems.findIndex(i => i.id === id);
        if (itemIndex === -1) return;
        
        bazarStateHistory.push([...bazarListItems]);
        
        const item = bazarListItems[itemIndex];
        item.qty = Number(newQty);
        let correctedQty = item.qty;
        if (item.unit === 'gram') correctedQty = item.qty / 1000;
        
        item.totalPrice = correctedQty * item.price;
        
        bazarListItems[itemIndex] = item;
        loadBazarListTable();
        customAlert("পণ্য আপডেট হয়েছে।");
    }
}

async function deleteBazarItem(id) {
    const confirmed = await customConfirm("এই আইটেমটি মুছবেন?");
    if (confirmed) {
        bazarStateHistory.push([...bazarListItems]);
        bazarListItems = bazarListItems.filter(i => i.id !== id);
        loadBazarListTable();
        customAlert("আইটেম মুছে ফেলা হলো।");
    }
}

async function undoBazar() {
    if (bazarStateHistory.length === 0) return customAlert("আর কোনো এন্ট্রি Undo করার নেই।");
    
    const confirmed = await customConfirm("বাজার লিস্টের শেষ পরিবর্তন Undo করবেন?");
    if (confirmed) {
        bazarListItems = bazarStateHistory.pop();
        loadBazarListTable();
        customAlert("বাজার লিস্ট Undo সফল!");
    }
}

async function saveBazarAsExpense() {
    if (bazarListItems.length === 0) return customAlert("লিস্টে কোনো আইটেম নেই।");
    
    const grandTotal = Number(document.getElementById('sub-total-label').innerText.split('৳')[1].split(' ')[0]);
    
    const confirmed = await customConfirm(`৳${grandTotal.toFixed(2)} কি ম্যানেজার খরচ হিসেবে যোগ করবেন? (মেইন পেজে যোগ হবে না)`);
    
    if (confirmed) {
        
        // **গুরুত্বপূর্ণ পরিবর্তন: daily_records এ সেভ করার লজিক সরানো হয়েছে।**
        // শুধুমাত্র M2 (ম্যানেজারি খরচ) এ সেভ হবে।
        saveDataToDB(`manager/${currentUser}/m2`, {
            desc: `বাজার (বাজার লিস্ট)`, // বিবরণ পরিবর্তন
            amt: grandTotal, 
            ts: Date.now(),
            date: getTodayDateString()
        });
        
        bazarListItems = [];
        bazarStateHistory = [];
        loadBazarListTable(); 
        
        loadManagerHomeSummary();
        
        customAlert(`৳${grandTotal.toFixed(2)} সফলভাবে ম্যানেজার খরচ হিসেবে যোগ করা হয়েছে!`);
        closeSub();
    }
}

// ... [বাকি ম্যানেজারি লজিক (loadSubList, editSubEntryInPlace, openM4 ইত্যাদি) অপরিবর্তিত]
let allMembers = [];
async function openSub(title, type) {
    activeSub = type;
    document.getElementById('sub-title').innerText = title;
    document.getElementById('sub-screen').classList.remove('hidden');
    
    document.getElementById('btn-show-history').classList.remove('hidden');
    document.getElementById('btn-show-history').innerText = "এন্ট্রির লিস্ট"; 
    document.getElementById('btn-show-history').onclick = loadSubList; 
    
    document.getElementById('btn-lock-sub-entry').classList.toggle('hidden', type !== 'm1' && type !== 'm3');
    
    isSubEntryLocked = false; 
    document.getElementById('sub-input-area').classList.remove('input-locked');

    await loadMembers(); 
    renderSubInputs(type);
    loadSubList(type);
    
    managerStateHistory = [];
}

async function loadMembers() {
    const snap = await rdb.ref(`manager/${currentUser}/members`).once('value');
    allMembers = snap.val() ? Object.values(snap.val()).map(m => m.name) : [];
}

function closeSub() { 
    document.getElementById('sub-screen').classList.add('hidden'); 
    document.getElementById('sub-input-area').classList.remove('hidden');
    document.getElementById('btn-show-history').classList.add('hidden');
    document.getElementById('btn-lock-sub-entry').classList.add('hidden');
}

function renderSubInputs(type) {
    document.getElementById('sub-list').innerHTML = "";
    document.getElementById('sub-total-label').innerText = "Total: 0";
    document.getElementById('sub-undo-btn').onclick = () => undoSubEntry(type);

    let memberOptions = allMembers.map(name => `<option value="${name}">${name}</option>`).join('');
    
    if (type === 'm1' || type === 'm3') {
        document.getElementById('dynamic-inputs').innerHTML = `
            <select id="m-member" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
                ${memberOptions.length ? memberOptions : '<option value="" disabled selected>আগে মেম্বার যোগ করুন</option>'}
            </select>
            <input type="number" id="m-amt" placeholder="${type === 'm1' ? 'টাকার পরিমাণ (৳)' : 'মিলের সংখ্যা (টি)'}" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-2xl">
        `;
    } else if (type === 'm2') {
        document.getElementById('dynamic-inputs').innerHTML = `
            <input type="text" id="m-desc" placeholder="বিবরণ" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
            <input type="number" id="m-amt" placeholder="টাকার পরিমাণ (৳)" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-2xl">
        `;
    }
    
    document.getElementById('sub-add-btn').onclick = saveSubEntry;
}

function saveCurrentSubState(type) {
    rdb.ref(`manager/${currentUser}/${type}`).once('value').then(snap => {
        const data = snap.val();
        managerStateHistory.push(data || {});
    });
}

async function saveSubEntry() {
    const type = activeSub;
    let name = '';
    const amt = Number(document.getElementById('m-amt').value);

    if (type === 'm1' || type === 'm3') {
        name = document.getElementById('m-member').value;
        if (!name || amt <= 0) return customAlert("মেম্বার ও পরিমাণ লিখুন।");
    } else if (type === 'm2') {
        const desc = document.getElementById('m-desc').value.trim();
        if (!desc || amt <= 0) return customAlert("বিবরণ ও পরিমাণ লিখুন।");
        name = desc; 
    }

    saveCurrentSubState(type); 

    const data = { 
        amt, 
        ts: Date.now(), 
        date: getTodayDateString() 
    };

    if (type === 'm1' || type === 'm3') {
        data.name = name;
    } else if (type === 'm2') {
        data.desc = name; 
    }

    saveDataToDB(`manager/${currentUser}/${type}`, data);

    document.getElementById('m-amt').value = "";
    if (document.getElementById('m-desc')) document.getElementById('m-desc').value = "";
    
    customAlert("এন্ট্রি সফল!");
    loadSubList(type);
    loadManagerHomeSummary();
}

async function undoSubEntry(type) {
    if (managerStateHistory.length === 0) return customAlert("আর কোনো এন্ট্রি Undo করার নেই।");
    
    const confirmed = await customConfirm("শেষ পরিবর্তনটি Undo করবেন?");
    if (confirmed) {
        const prevState = managerStateHistory.pop();
        
        const ref = rdb.ref(`manager/${currentUser}/${type}`);
        await ref.set(prevState);
        
        if (typeof AndroidInterface !== 'undefined' && AndroidInterface.overwriteNodeLocally) {
             AndroidInterface.overwriteNodeLocally(JSON.stringify(prevState), `manager/${currentUser}/${type}`);
        }
        
        loadSubList(type);
        loadManagerHomeSummary();
        customAlert("Undo সফল! (শেষ এন্ট্রি মুছে ফেলা হয়েছে)");
    }
}

async function loadSubList(type = activeSub) {
    const refType = (type === 'm4') ? 'm2' : type; 
    const snap = await rdb.ref(`manager/${currentUser}/${refType}`).once('value');
    const list = document.getElementById('sub-list'); list.innerHTML = "";
    let total = 0;
    
    if(snap.exists()) {
        const records = Object.entries(snap.val()).sort(([,a], [,b]) => b.ts - a.ts);
        
        records.forEach(([id, val]) => {
            total += val.amt;
            const dateStr = val.date ? val.date : new Date(val.ts).toLocaleDateString('bn-BD');
            const nameOrDesc = val.name || val.desc || 'N/A';
            const unit = refType === 'm3' ? 'টি' : '৳';
            const color = refType === 'm1' ? 'text-emerald-600' : refType === 'm2' ? 'text-rose-600' : 'text-indigo-600';
            
            list.innerHTML += `
                <div id="entry-${id}" class="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border-l-4 border-slate-200">
                    <div>
                        <p class="font-black text-slate-800">${nameOrDesc}</p>
                        <p class="text-[8px] text-slate-400 uppercase font-black">${dateStr}</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <p class="font-black ${color} text-lg">${val.amt} ${unit}</p>
                        ${(refType === 'm1' || refType === 'm3' || refType === 'm2') ? 
                            `<button onclick="editSubEntryInPlace('${refType}','${id}','${nameOrDesc.replace(/'/g, "\\'")}',${val.amt})" class="text-indigo-400"><i class="fa-solid fa-pencil"></i></button>` : ''}
                        <button onclick="deleteSub('manager/${refType}','${id}')" class="text-rose-400"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        });
    }
    
    if (refType === 'm2') document.getElementById('sub-total-label').innerText = "Total Expense: ৳" + total;
    else if (refType === 'm1') document.getElementById('sub-total-label').innerText = "Total Deposit: ৳" + total;
    else if (refType === 'm3') document.getElementById('sub-total-label').innerText = "Total Meals: " + total + " টি";
}

async function editSubEntryInPlace(type, id, nameOrDesc, currentAmt) {
    const unit = type === 'm3' ? 'মিল' : 'টাকা';
    const newAmt = prompt(`"${nameOrDesc}" এর জন্য নতুন ${unit} পরিমাণ লিখুন:`, currentAmt);
    
    if (newAmt !== null) {
        const amt = Number(newAmt);
        if (amt >= 0) {
             const confirmed = await customConfirm(`আপনি কি ${amt} ${unit} দিয়ে এই এন্ট্রি আপডেট করতে চান?`);
             if (confirmed) {
                saveCurrentSubState(type);
                
                await rdb.ref(`manager/${currentUser}/${type}/${id}/amt`).set(amt);
                
                if (typeof AndroidInterface !== 'undefined' && AndroidInterface.updateDataLocally) {
                     AndroidInterface.updateDataLocally(`manager/${currentUser}/${type}`, id, JSON.stringify({amt: amt}));
                }
                
                loadSubList(type);
                loadManagerHomeSummary();
                customAlert("এন্ট্রি সফলভাবে আপডেট হয়েছে।");
             }
        } else {
            customAlert("পরিমাণ অবশ্যই ধনাত্মক হতে হবে।");
        }
    }
}


async function openM4() {
    activeSub = 'm4';
    document.getElementById('sub-title').innerText = "মিল রেট ও রিপোর্ট";
    document.getElementById('sub-screen').classList.remove('hidden');
    document.getElementById('sub-input-area').classList.add('hidden');
    
    document.getElementById('btn-show-history').classList.remove('hidden');
    document.getElementById('btn-show-history').innerText = "খরচের লিস্ট";
    document.getElementById('btn-show-history').onclick = () => loadSubList('m2'); 
    
    document.getElementById('btn-lock-sub-entry').classList.add('hidden');
    
    // M4 রিপোর্ট দেখানোর লজিক
    
    await rdb.ref(`manager/${currentUser}`).once('value').then(snap => {
        const data = snap.val() || {};
        
        let totalDeposit = 0;
        if (data.m1) totalDeposit = Object.values(data.m1).reduce((sum, entry) => sum + (entry.amt || 0), 0);
        
        let totalExpense = 0;
        if (data.m2) totalExpense = Object.values(data.m2).reduce((sum, entry) => sum + (entry.amt || 0), 0);
        
        let totalMeal = 0;
        if (data.m3) totalMeal = Object.values(data.m3).reduce((sum, entry) => sum + (entry.amt || 0), 0);
        
        let millRate = totalMeal > 0 ? (totalExpense / totalMeal) : 0;
        
        // মেম্বারদের আলাদা আলাদা হিসাব
        let memberDeposits = {};
        if (data.m1) {
            Object.values(data.m1).forEach(e => {
                memberDeposits[e.name] = (memberDeposits[e.name] || 0) + e.amt;
            });
        }
        
        let memberMeals = {};
        if (data.m3) {
            Object.values(data.m3).forEach(e => {
                memberMeals[e.name] = (memberMeals[e.name] || 0) + e.amt;
            });
        }
        
        let reportHTML = `
            <div class="bg-indigo-50 p-4 rounded-xl shadow-inner mb-4">
                <p class="text-xs font-bold text-indigo-700 mb-1">সারাংশ</p>
                <p class="text-xl font-black text-slate-800">মোট মিল রেট: ৳${millRate.toFixed(2)}</p>
                <p class="text-sm text-slate-600">মোট খরচ: ৳${totalExpense.toFixed(2)} | মোট মিল: ${totalMeal} টি</p>
                <p class="text-sm text-slate-600">মোট জমা: ৳${totalDeposit.toFixed(2)} | ব্যালেন্স: ৳${(totalDeposit - totalExpense).toFixed(2)}</p>
            </div>
            <h3 class="font-black text-lg text-slate-700 mb-3">মেম্বার হিসাব</h3>
            <div class="space-y-3">
        `;

        Object.keys(memberDeposits).forEach(name => {
            const deposited = memberDeposits[name] || 0;
            const meals = memberMeals[name] || 0;
            const mealCost = meals * millRate;
            const balance = deposited - mealCost;
            const color = balance >= 0 ? 'text-emerald-600' : 'text-rose-600';
            const status = balance >= 0 ? 'পাওনা' : 'বাকি';

            reportHTML += `
                <div class="bg-white p-4 rounded-xl shadow-sm border-l-4 ${balance >= 0 ? 'border-emerald-500' : 'border-rose-500'}">
                    <p class="font-black text-base text-slate-800">${name}</p>
                    <div class="grid grid-cols-2 text-sm mt-1">
                        <p class="text-slate-600">মিল খরচ: ৳${mealCost.toFixed(2)} (${meals} মিল)</p>
                        <p class="text-slate-600">জমা: ৳${deposited.toFixed(2)}</p>
                    </div>
                    <p class="mt-2 text-lg font-black ${color}">ব্যালেন্স: ৳${Math.abs(balance).toFixed(2)} (${status})</p>
                </div>
            `;
        });
        reportHTML += `</div>`;
        
        document.getElementById('sub-list').innerHTML = reportHTML;
        document.getElementById('sub-total-label').innerText = ""; 
    });
}

// --- ৬. ডিমের হিসাব (অপরিবর্তিত) ---

async function openEgg() {
    activeSub = 'eggs'; 
    document.getElementById('sub-title').innerText = "ডিমের হিসাব";
    document.getElementById('sub-screen').classList.remove('hidden');
    document.getElementById('sub-input-area').classList.remove('hidden');
    
    document.getElementById('btn-show-history').classList.remove('hidden');
    document.getElementById('btn-show-history').innerText = "ডিমের লিস্ট"; 
    document.getElementById('btn-show-history').onclick = loadEggList;
    
    document.getElementById('btn-lock-sub-entry').classList.add('hidden');
    
    document.getElementById('dynamic-inputs').innerHTML = `
        <select id="e-type" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
            <option value="buy">ডিম কেনা (Stock In)</option>
            <option value="use">ডিম খরচ (Stock Out)</option>
        </select>
        <input type="number" id="e-qty" placeholder="সংখ্যা (টি)" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-black text-2xl">`;
    
    document.getElementById('sub-add-btn').onclick = saveEgg;
    document.getElementById('sub-undo-btn').onclick = () => undoSubEntry('eggs'); 
    
    managerStateHistory = [];
    loadEggList();
}

async function saveEgg() {
    const type = document.getElementById('e-type').value;
    const qty = Number(document.getElementById('e-qty').value);
    if(qty <= 0) return customAlert("পরিমাণ অবশ্যই ধনাত্মক হতে হবে।");
    
    saveCurrentSubState('eggs');
    
    saveDataToDB(`manager/${currentUser}/eggs`, { type, qty, ts: Date.now(), date: getTodayDateString() });
    
    document.getElementById('e-qty').value = "";
    customAlert(`ডিমের এন্ট্রি সফল (${qty} টি ${type === 'buy' ? 'কেনা' : 'খরচ'})`);
    loadEggList();
}

async function loadEggList() {
    const snap = await rdb.ref(`manager/${currentUser}/eggs`).once('value');
    const list = document.getElementById('sub-list'); list.innerHTML = "";
    let stock = 0;
    
    if(snap.exists()){
        const records = Object.entries(snap.val()).sort(([,a], [,b]) => b.ts - a.ts);
        records.forEach(([id, e]) => {
            if(e.type === 'buy') stock += e.qty; else stock -= e.qty;
            
            const dateStr = e.date ? e.date : new Date(e.ts).toLocaleDateString('bn-BD');
            
            list.innerHTML += `
                <div class="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
                    <div>
                        <p class="font-bold text-slate-700">${e.type==='buy'?'ডিম কেনা':'ডিম খরচ'}</p>
                        <p class="text-[8px] text-slate-400 uppercase font-black">${dateStr}</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <p class="font-black ${e.type==='buy'?'text-emerald-500':'text-rose-500'}">${e.qty} টি</p>
                        <button onclick="editEggEntryInPlace('${id}','${e.type}',${e.qty})" class="text-indigo-400"><i class="fa-solid fa-pencil"></i></button>
                        <button onclick="deleteSub('manager/eggs','${id}')" class="text-rose-400"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        });
    }
    document.getElementById('sub-total-label').innerText = "বর্তমানে স্টক: " + stock + " টি";
}

async function editEggEntryInPlace(id, type, currentQty) {
    const typeText = type === 'buy' ? 'কেনা' : 'খরচ';
    const newQty = prompt(`${typeText} ডিমের নতুন সংখ্যা লিখুন:`, currentQty);
    
    if (newQty !== null) {
        const qty = Number(newQty);
        if (qty >= 0) {
             const confirmed = await customConfirm(`আপনি কি ${qty} টি ডিমের এন্ট্রি আপডেট করতে চান?`);
             if (confirmed) {
                saveCurrentSubState('eggs');
                
                await rdb.ref(`manager/${currentUser}/eggs/${id}/qty`).set(qty);
                
                if (typeof AndroidInterface !== 'undefined' && AndroidInterface.updateDataLocally) {
                     AndroidInterface.updateDataLocally(`manager/${currentUser}/eggs`, id, JSON.stringify({qty: qty}));
                }
                
                loadEggList();
                customAlert("ডিমের এন্ট্রি সফলভাবে আপডেট হয়েছে।");
             }
        } else {
            customAlert("পরিমাণ অবশ্যই ধনাত্মক হতে হবে।");
        }
    }
}


// --- ৭. ইউটিলিটি ফাংশনস (অপরিবর্তিত) ---
function toggleSidebar(s) { document.getElementById('sidebar').classList.toggle('active', s); document.getElementById('sidebar-overlay').classList.toggle('hidden', !s); }
function applyFilter(f) { loadDailyData(f); toggleSidebar(false); }

async function resetManager() { 
    const confirmed = await customConfirm("পুরো ম্যানেজারি হিসাব রিসেট হবে! নিশ্চিত?");
    if(confirmed) { 
        await rdb.ref('manager/'+currentUser).remove(); 
        if (typeof AndroidInterface !== 'undefined' && AndroidInterface.removeNodeLocally) {
             AndroidInterface.removeNodeLocally('manager/' + currentUser);
        }
        loadManagerHomeSummary(); // শুধু সামারি আপডেট হবে
        closeSub();
        customAlert("ম্যানেজারি হিসাব সফলভাবে রিসেট করা হয়েছে।");
    } 
}

// এই ফাংশন এখন রেফারেন্স পাথে 'daily_records' বা 'manager/M2' এভাবে কাজ করবে।
async function deleteSub(refPath, id) { 
    const fullRefPath = refPath.startsWith('daily_records') ? `${refPath}/${currentUser}/${id}` : `${refPath}/${currentUser}/${id}`;
    const confirmed = await customConfirm("এই এন্ট্রি মুছে ফেলবেন?");
    
    if(confirmed) { 
        // মেইন নোডটি বের করা
        const nodeType = refPath.split('/').pop();
        if (nodeType !== 'daily_records') {
            saveCurrentSubState(nodeType); // ম্যানেজারি এন্ট্রি হলে UNDO এর জন্য সেভ করা
        }
        
        await rdb.ref(fullRefPath).remove(); 
        
        if (typeof AndroidInterface !== 'undefined' && AndroidInterface.removeDataLocally) {
            AndroidInterface.removeDataLocally(refPath, id);
        }
        
        if (refPath.startsWith('daily_records')) {
             loadDailyData(currentFilter);
        } else {
             loadSubList(nodeType); 
             loadManagerHomeSummary();
        }

        customAlert("এন্ট্রি সফলভাবে মুছে ফেলা হয়েছে।");
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

function showInfo() {
    const infoText = `
        <h3 class="font-black text-xl mb-3 text-indigo-600">অ্যাপ্লিকেশন তথ্য</h3>
        <p class="text-sm mb-4">এই অ্যাপটি আপনার দৈনন্দিন ও যৌথ হিসাব ব্যবস্থাপনার জন্য ডিজাইন করা হয়েছে।</p>
        <ul class="list-disc list-inside space-y-2 text-sm text-slate-700">
            <li><strong>দৈনিক হিসাব:</strong> ব্যক্তিগত আয়-ব্যয় ট্র্যাক করুন।</li>
            <li><strong>ম্যানেজারি সিস্টেম:</strong> মেস বা যৌথ খরচের টাকা জমা, খরচ ও মিলের হিসাব স্বয়ংক্রিয়ভাবে পরিচালনা করুন। **(দৈনিক হিসাবের সাথে আলাদা)**</li>
            <li><strong>ইনলাইন এডিটিং:</strong> পেন্সিল আইকনে ক্লিক করে দ্রুত যেকোনো এন্ট্রির পরিমাণ পরিবর্তন করুন।</li>
            <li><strong>অফলাইন সাপোর্ট:</strong> ইন্টারনেট না থাকলেও ডেটা এন্ট্রি করা যাবে।</li>
            <li><strong>সিকিউরিটি:</strong> আপনার ডেটা শুধুমাত্র আপনার Firebase Realtime Database-এ সুরক্ষিত থাকে।</li>
        </ul>
        <p class="text-xs text-slate-500 mt-4">সংস্করণ: V3.1.0 | ধন্যবাদ: User Pro (Developer)</p>
    `;
    document.getElementById('info-content').innerHTML = infoText;
    document.getElementById('info-dialog').classList.remove('hidden');
}
function closeInfoDialog() {
    document.getElementById('info-dialog').classList.add('hidden');
}

// শর্টকাট বাটন বাইন্ডিং
function openM1() { openSub("টাকা জমা (M1)", "m1"); }
function openM2() { openSub("বাজার খরচ (M2)", "m2"); } 
function openM3() { openSub("মিল সংখ্যা (M3)", "m3"); }
function openM4() { openM4(); } 
function openEgg() { openEgg(); }
function openBazarList() { openBazarEntry(); } 

// লগআউট ফাংশন
async function handleLogout() {
    const confirmed = await customConfirm("আপনি কি নিশ্চিতভাবে লগআউট করতে চান?");
    if(confirmed) {
        localStorage.removeItem('activeUserPRO');
        window.location.reload();
    }
}
async function startDownload() {
    // ... আপনার ডাউনলোড লজিক অপরিবর্তিত ...
}
