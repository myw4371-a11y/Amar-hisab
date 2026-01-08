// ====================================================================================
// হিসেব PRO | JAVASCRIPT CORE V3.3 (Addition, Update, and Save As Logic Implemented)
// DEVELOPED BY ZORD ACADEMY
// ====================================================================================

// --- ১. ফায়ারবেস কনফিগারেশন এবং ইনিশিয়ালাইজেশন ---
const firebaseConfig = {
    
    databaseURL: "https://amar-hishab-pro-default-rtdb.asia-southeast1.firebasedatabase.app/" 
};
    

let firebaseApp;
let database;
try {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    database = firebase.database();
} catch (e) {
    console.error("Firebase initialization failed:", e);
}


// --- ২. গ্লোবাল ভেরিয়েবল এবং স্টেট ---
let currentUser = null;
let activeSub = null; // M1, M2, M3, Egg
let currentFilter = 'today'; // Filter for daily list
let managerLocked = false;
let currentKeyToUpdate = null; // M1, M2, M3, Egg এ এডিটিং এর জন্য ব্যবহৃত হবে
let currentMemberKey = null; // M1/M3 এর সংযোজন লজিকের জন্য সর্বশেষ ব্যবহৃত মেম্বার key

// --- ৩. ইউটিলিটি ফাংশন (আগের মতোই আছে) ---
const formatTaka = (amount) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0';
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const showCustomAlert = (message) => {
    document.getElementById('custom-alert-message').textContent = message;
    document.getElementById('custom-alert').classList.remove('hidden');
}

const closeCustomAlert = () => {
    document.getElementById('custom-alert').classList.add('hidden');
}

const showCustomConfirm = (message, callback) => {
    document.getElementById('custom-confirm-message').textContent = message;
    document.getElementById('custom-confirm').classList.remove('hidden');
    
    const yesBtn = document.getElementById('custom-confirm-yes');
    const noBtn = document.getElementById('custom-confirm-no');

    const newYesBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    
    const newNoBtn = noBtn.cloneNode(true);
    noBtn.parentNode.replaceChild(newNoBtn, noBtn);
    
    newYesBtn.addEventListener('click', () => {
        document.getElementById('custom-confirm').classList.add('hidden');
        callback();
    });

    newNoBtn.addEventListener('click', () => {
        document.getElementById('custom-confirm').classList.add('hidden');
    });
}

// ... (filterDataByTime, handleLogin, handleRegister, handleLogout, saveDaily, undoDaily, renderDailyList, loadDailyEntry, openManager, closeManager, loadManagerSummary - এই সব ফাংশন আগের মতোই থাকবে) ...

// --- ৪. সাব-সিস্টেম কন্ট্রোল (M1, M2, M3, Egg) ---

const openSub = (sub) => {
    activeSub = sub;
    // এডিটিং মোড রিসেট
    currentKeyToUpdate = null; 
    document.getElementById('sub-add-btn').textContent = 'সংরক্ষণ করুন'; 
    
    document.getElementById('sub-screen').classList.remove('hidden');
    document.getElementById('manager-screen').classList.add('hidden');
    
    setupSubInput(sub);
    loadSubSystem(sub);
}

const closeSub = () => {
    activeSub = null;
    currentKeyToUpdate = null;
    document.getElementById('sub-add-btn').textContent = 'সংরক্ষণ করুন';
    document.getElementById('sub-screen').classList.add('hidden');
    document.getElementById('manager-screen').classList.remove('hidden');
}

const setupSubInput = (sub) => {
    const titleMap = {
        'M1': 'মোট জমা (M1)',
        'M2': 'বাজার/শপিং লিস্ট',
        'M3': 'মোট মিল (M3)',
        'Egg': 'ডিমের হিসাব',
    };
    document.getElementById('sub-title').textContent = titleMap[sub];
    const dynamicInputs = document.getElementById('dynamic-inputs');
    dynamicInputs.innerHTML = '';
    
    // M2 এর জন্য 'Save As' বাটন দেখানো/লুকানো
    document.getElementById('bazar-save-as-area').classList.toggle('hidden', sub !== 'M2');
    
    // M1 এবং M3 এর জন্য 'সবার জন্য যোগ' বাটন
    document.getElementById('btn-add-for-all').classList.toggle('hidden', sub !== 'M1' && sub !== 'M3');
    
    let inputHtml = '';
    
    switch (sub) {
        case 'M1': 
            inputHtml = `
                <input type="text" id="sub-desc" placeholder="জমার কারণ" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
                <input type="number" id="sub-amt" placeholder="টাকার পরিমাণ (৳)" class="w-full p-5 bg-slate-100 rounded-2xl outline-none text-3xl font-black">
                <select id="sub-member" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
                    <option value="">মেম্বার নির্বাচন করুন (সংযোজনের জন্য খালি রাখুন)</option>
                </select>
            `;
            break;
        case 'M2': // খরচ/বাজার
            inputHtml = `
                <input type="text" id="sub-desc" placeholder="পণ্য/খরচের কারণ (যেমন: আলু)" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
                <input type="number" id="sub-amt" placeholder="টাকার পরিমাণ (৳) - ঐচ্ছিক" class="w-full p-5 bg-slate-100 rounded-2xl outline-none text-3xl font-black">
                <select id="sub-member" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
                    </select>
            `;
            break;
        case 'M3': 
            inputHtml = `
                <input type="number" id="sub-amt" placeholder="মিল সংখ্যা (যেমন: ১ বা ০.৫)" class="w-full p-5 bg-slate-100 rounded-2xl outline-none text-3xl font-black">
                <select id="sub-member" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
                    <option value="">মেম্বার নির্বাচন করুন (সংযোজনের জন্য খালি রাখুন)</option>
                </select>
            `;
            break;
        case 'Egg': 
            inputHtml = `
                <input type="text" id="sub-desc" placeholder="ডিমের কারণ (ক্রয়/খরচ/স্টক)" class="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold">
                <input type="number" id="sub-amt" placeholder="ডিমের সংখ্যা (নেগেটিভ মানে খরচ)" class="w-full p-5 bg-slate-100 rounded-2xl outline-none text-3xl font-black">
            `;
            break;
    }
    
    dynamicInputs.innerHTML = inputHtml;

    document.getElementById('sub-add-btn').onclick = () => saveSubEntry(sub);

    // M1, M2 এবং M3 এর জন্য মেম্বার লোড করা
    if (sub === 'M1' || sub === 'M2' || sub === 'M3') {
        loadMemberOptions('sub-member');
    }
}

const loadMemberOptions = (selectId) => {
    const select = document.getElementById(selectId);
    // প্রথম অপশনটি সংযোজন লজিকের জন্য খালি রাখা
    const initialOption = (selectId === 'sub-member' && (activeSub === 'M1' || activeSub === 'M3')) 
        ? '<option value="">মেম্বার নির্বাচন করুন (সংযোজনের জন্য খালি রাখুন)</option>'
        : '<option value="">মেম্বার নির্বাচন করুন</option>';
        
    select.innerHTML = initialOption;
    
    database.ref('manager_data/' + currentUser + '/members').once('value', (snapshot) => {
        const members = snapshot.val() || {};
        for (const key in members) {
            if (members[key].isActive) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = members[key].name;
                select.appendChild(option);
            }
        }
    });
}

/**
 * সাব-সিস্টেমের এন্ট্রি সংরক্ষণ বা হালনাগাদ করে।
 * M1/M3: Add (সংযোজন) এবং Update লজিক বাস্তবায়িত।
 * M2: Bazar List (isFinalExpense: false) সেভ বা আপডেট করে।
 */
const saveSubEntry = async (sub) => {
    if (!currentUser || managerLocked) return showCustomAlert("ম্যানেজার লক করা আছে।");

    const descEl = document.getElementById('sub-desc');
    const amtEl = document.getElementById('sub-amt');
    const memberEl = document.getElementById('sub-member');
    
    let desc = descEl ? descEl.value.trim() : '';
    let amt = parseFloat(amtEl.value);
    let member = memberEl ? memberEl.value : currentUser;
    
    if (isNaN(amt) || amt === 0) return showCustomAlert("সঠিক টাকার/মিল/ডিমের পরিমাণ দিন।");

    try {
        const ref = database.ref('manager_data/' + currentUser + '/' + sub);

        // --- এডিটিং/হালনাগাদ মোড (M1, M2, M3, Egg সবকিছুর জন্য) ---
        if (currentKeyToUpdate) {
            // শুধুমাত্র আপডেটের জন্য
            const updateData = {
                amount: amt,
                timestamp: new Date().toISOString(),
            };
            if (descEl) updateData.desc = desc;
            if (memberEl) updateData.member = member;
            
            await ref.child(currentKeyToUpdate).update(updateData);
            showCustomAlert(`এন্ট্রি সফলভাবে হালনাগাদ করা হয়েছে!`);
            currentKeyToUpdate = null; // এডিটিং মোড বন্ধ
            document.getElementById('sub-add-btn').textContent = 'সংরক্ষণ করুন';
        } 
        // --- নতুন এন্ট্রি বা সংযোজন মোড ---
        else {
             // M1/M3: মেম্বার সিলেক্ট না করা হলে সংযোজন লজিক
            if ((sub === 'M1' || sub === 'M3') && !member) {
                if (!currentMemberKey) return showCustomAlert("সংযোজনের জন্য পূর্বে কোনো মেম্বার এন্ট্রি পাওয়া যায়নি। মেম্বার সিলেক্ট করুন।");
                
                // সর্বশেষ মেম্বারের এন্ট্রিতে সংযোজন
                const lastEntryRef = ref.child(currentMemberKey);
                const snapshot = await lastEntryRef.once('value');
                const lastEntry = snapshot.val();
                
                if (lastEntry) {
                    await lastEntryRef.update({
                        amount: lastEntry.amount + amt, // সংযোজন
                        timestamp: new Date().toISOString(),
                    });
                    showCustomAlert(`৳${formatTaka(amt)} / ${amt} মিল সফলভাবে সংযোজন করা হয়েছে!`);
                } else {
                    return showCustomAlert("সংযোজনের জন্য সর্বশেষ এন্ট্রি পাওয়া যায়নি।");
                }
            } 
            // M1, M2, M3, Egg: নতুন সাধারণ এন্ট্রি
            else {
                if (sub === 'M1' && !desc) return showCustomAlert("জমার কারণ লিখুন।");
                if ((sub === 'M1' || sub === 'M3') && !member) return showCustomAlert("মেম্বার নির্বাচন করুন।");

                const entryData = {
                    desc: desc || (sub === 'M3' ? 'মিল এন্ট্রি' : 'অনির্দিষ্ট খরচ'),
                    amount: amt,
                    timestamp: new Date().toISOString(),
                    member: member,
                    // M2 এর জন্য, এটি শপিং লিস্ট (isFinalExpense: false) বা স্থায়ী খরচ (isFinalExpense: true) হবে
                    isFinalExpense: (sub === 'M2' && !desc && amt > 0) ? true : (sub === 'M2' ? false : true),
                };
                
                const newEntry = await ref.push(entryData);
                if (sub === 'M1' || sub === 'M3') {
                     // সংযোজন লজিকের জন্য key সেভ করা
                    currentMemberKey = newEntry.key; 
                }
                showCustomAlert("এন্ট্রি সফলভাবে যোগ করা হয়েছে!");
            }
        }

        // ইনপুট রিসেট
        if (descEl) descEl.value = '';
        if (amtEl) amtEl.value = '';
        if (memberEl) memberEl.value = '';

    } catch (error) {
        console.error("Saving sub entry failed:", error);
        showCustomAlert("এন্ট্রি সংরক্ষণ ব্যর্থ হয়েছে।");
    }
}

/**
 * সাব-সিস্টেমের এন্ট্রি ইনপুট বক্সে লোড করে (ক্লিক টু এডিট)।
 * @param {Event} e
 */
const loadSubEntry = (e) => {
    const item = e.currentTarget; 
    
    currentKeyToUpdate = item.getAttribute('data-key');
    const sub = item.getAttribute('data-sub');
    const desc = item.getAttribute('data-desc');
    const amount = item.getAttribute('data-amount');
    const member = item.getAttribute('data-member');
    
    // M2 তে স্থায়ী খরচ এডিট করা যাবে না
    if (sub === 'M2' && item.getAttribute('data-final') === 'true') {
        currentKeyToUpdate = null;
        return showCustomAlert("এটি একটি স্থায়ী খরচ এন্ট্রি। এটি পরিবর্তন করা যাবে না।");
    }

    const descEl = document.getElementById('sub-desc');
    const amtEl = document.getElementById('sub-amt');
    const memberEl = document.getElementById('sub-member');

    // ইনপুট বক্সে ডেটা লোড করা
    if (descEl) descEl.value = desc;
    if (amtEl) amtEl.value = parseFloat(amount);
    if (memberEl) memberEl.value = member;
    
    document.getElementById('sub-add-btn').textContent = 'হালনাগাদ করুন';
    
    showCustomAlert(`'${desc || sub}' (${formatTaka(parseFloat(amount))}) লোড করা হয়েছে। ডেটা আপডেট করুন।`);
}

/**
 * বাজার লিস্টের মোট খরচকে স্থায়ী M2 খরচ হিসেবে সেভ করে। (Save As বাটন)
 */
const saveBazarAsExpense = async () => {
    if (activeSub !== 'M2' || managerLocked) return;

    // মোট বাজারের টোটাল নেওয়া
    const totalEl = document.getElementById('bazar-grand-total');
    const totalAmount = parseFloat(totalEl.textContent.replace(/[৳,]/g, '')) || 0;

    if (totalAmount <= 0) {
        showCustomAlert("খরচ করার মতো কোনো বাজার এন্ট্রি নেই।");
        return;
    }
    
    showCustomConfirm(`মোট ৳${formatTaka(totalAmount)} স্থায়ী খরচ হিসেবে সংরক্ষণ করবেন? বর্তমান শপিং লিস্টের এন্ট্রিগুলো মুছে যাবে।`, async () => {
        try {
            const ref = database.ref('manager_data/' + currentUser + '/M2');
            
            // ১. একটি নতুন স্থায়ী খরচ এন্ট্রি তৈরি করা (isFinalExpense: true)
            await ref.push({
                desc: `বাজার খরচ সংরক্ষণ (${new Date().toLocaleDateString('bn-BD')})`,
                amount: totalAmount,
                timestamp: new Date().toISOString(),
                member: currentUser, 
                isFinalExpense: true, // স্থায়ী খরচ
            });

            // ২. বাজার এন্ট্রিগুলো মুছে ফেলা (isFinalExpense: false এন্ট্রিগুলি)
            const snapshot = await ref.once('value');
            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    const entry = childSnapshot.val();
                    if (childSnapshot.key !== 'initial' && !entry.isFinalExpense) {
                         database.ref('manager_data/' + currentUser + '/M2/' + childSnapshot.key).remove();
                    }
                });
            }

            showCustomAlert(`৳${formatTaka(totalAmount)} সফলভাবে স্থায়ী খরচ হিসেবে সংরক্ষণ করা হয়েছে। শপিং লিস্ট রিসেট হয়েছে।`);
            loadManagerSummary(); 
        } catch (error) {
            console.error("Save As Expense failed:", error);
            showCustomAlert("Save As (খরচ) ব্যর্থ হয়েছে।");
        }
    });
}

// --- ৫. সবার জন্য যোগ (Add For All) লজিক (M1/M3) ---

const openAddForAllDialog = () => {
    if (activeSub !== 'M1' && activeSub !== 'M3') return;
    const title = activeSub === 'M1' ? 'সবার জন্য জমা যোগ' : 'সবার জন্য মিল যোগ';
    const placeholder = activeSub === 'M1' ? 'টাকার পরিমাণ (৳)' : 'মিল সংখ্যা';
    
    document.getElementById('add-for-all-title').textContent = title;
    document.getElementById('add-for-all-amt').placeholder = placeholder;
    document.getElementById('add-for-all-dialog').classList.remove('hidden');
}

const closeAddForAllDialog = () => {
    document.getElementById('add-for-all-dialog').classList.add('hidden');
    document.getElementById('add-for-all-amt').value = '';
}

const saveForAll = async () => {
    if (!currentUser || managerLocked) return showCustomAlert("ম্যানেজার লক করা আছে।");
    const sub = activeSub;
    const amount = parseFloat(document.getElementById('add-for-all-amt').value);

    if (isNaN(amount) || amount === 0) return showCustomAlert("সঠিক পরিমাণ দিন।");

    closeAddForAllDialog();
    showCustomConfirm(`সকল সক্রিয় মেম্বারের জন্য ${amount} ${sub === 'M1' ? 'টাকা' : 'মিল'} যোগ করবেন?`, async () => {
        try {
            const membersSnapshot = await database.ref('manager_data/' + currentUser + '/members').once('value');
            const members = membersSnapshot.val() || {};
            const ref = database.ref('manager_data/' + currentUser + '/' + sub);
            const timestamp = new Date().toISOString();
            
            let count = 0;
            for (const memberKey in members) {
                if (members[memberKey].isActive) {
                    const desc = sub === 'M1' ? 'সবার জন্য এককালীন জমা' : 'সবার জন্য এককালীন মিল';
                    
                    await ref.push({
                        desc: desc,
                        amount: amount,
                        timestamp: timestamp,
                        member: memberKey, 
                        isFinalExpense: true, // M1/M3 এ সব এন্ট্রিই চূড়ান্ত
                    });
                    count++;
                }
            }

            if (count > 0) {
                showCustomAlert(`${count} জন মেম্বারের জন্য সফলভাবে যোগ করা হয়েছে!`);
            } else {
                showCustomAlert("কোনো সক্রিয় মেম্বার পাওয়া যায়নি।");
            }
        } catch (error) {
            console.error("Save For All failed:", error);
            showCustomAlert("যোগ করা ব্যর্থ হয়েছে।");
        }
    });
}


// --- ৬. অন্যান্য কন্ট্রোল (Telegram, M1, M2, M3, Egg ওপেন ফাংশন) ---
// ... (openM1, openM2, openM3, openM4, openEgg, openAddMemberDialog, closeAddMemberDialog, addNewMember, resetManager, joinTelegram - এই সব ফাংশন আগের মতোই থাকবে, শুধু joinTelegram এ আপনার Telegram ID দেওয়া লাগবে) ...


// --- ৭. DOMContentLoaded এবং Initialization ---
// ... (DOMContentLoaded function remains unchanged)

// --- ফাংশনগুলো HTML এর জন্য এক্সপোজ করা ---
// ... (window.toggleAuth, handleLogin, etc.)

window.saveSubEntry = saveSubEntry;
window.loadSubEntry = loadSubEntry;
window.saveBazarAsExpense = saveBazarAsExpense;
window.openAddForAllDialog = openAddForAllDialog;
window.closeAddForAllDialog = closeAddForAllDialog;
window.saveForAll = saveForAll;
window.openSub = openSub;
window.closeSub = closeSub;
