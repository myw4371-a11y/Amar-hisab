/**
 * Amar Hishab - Professional Logic v1.0
 * Features: Offline Sync, Auto-update at midnight, Advanced Filters
 */

const db = new Dexie("HishabProDB");
db.version(1).stores({
    records: "++id, desc, amt, type, date, ts"
});

let currentFilter = 'home';
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');

// --- ১. অথেনটিকেশন লজিক ---
function handleAuth() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const msg = document.getElementById('auth-msg');

    if (email.includes('@') && pass.length >= 6) {
        localStorage.setItem('user_session', email);
        document.getElementById('user-display').innerText = email.split('@')[0];
        initApp();
    } else {
        msg.innerText = "সঠিক ইমেইল এবং অন্তত ৬ সংখ্যার পাসওয়ার্ড দিন";
        msg.classList.remove('hidden');
    }
}

function initApp() {
    authScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    checkMidnightUpdate();
    loadHishab('home');
}

// --- ২. মেইন ফাংশনালিটি ---
async function addEntry(type) {
    const desc = document.getElementById('desc').value;
    const amt = document.getElementById('amt').value;
    const date = new Date().toISOString().split('T')[0];

    if (desc && amt > 0) {
        await db.records.add({
            desc,
            amt: parseFloat(amt),
            type,
            date,
            ts: Date.now()
        });
        document.getElementById('desc').value = "";
        document.getElementById('amt').value = "";
        loadHishab(currentFilter);
    } else {
        alert("বিবরণ এবং টাকার পরিমাণ সঠিক নয়!");
    }
}

async function loadHishab(filter = 'home', customDate = null) {
    currentFilter = filter;
    const list = document.getElementById('list-container');
    const incomeEl = document.getElementById('sum-income');
    const expenseEl = document.getElementById('sum-expense');
    const titleEl = document.getElementById('filter-title');
    
    let allRecords = await db.records.toArray();
    let filtered = [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // অ্যাডভান্সড ফিল্টার লজিক
    switch(filter) {
        case 'today':
            filtered = allRecords.filter(r => r.date === todayStr);
            titleEl.innerText = "আজকের হিসাব";
            break;
        case 'week':
            const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            filtered = allRecords.filter(r => r.ts >= weekAgo);
            titleEl.innerText = "গত ৭ দিনের হিসাব";
            break;
        case 'thisMonth':
            const thisMonth = todayStr.substring(0, 7);
            filtered = allRecords.filter(r => r.date.startsWith(thisMonth));
            titleEl.innerText = "এই মাসের হিসাব";
            break;
        case 'lastMonth':
            const lastM = new Date();
            lastM.setMonth(lastM.getMonth() - 1);
            const lastMonthStr = lastM.toISOString().substring(0, 7);
            filtered = allRecords.filter(r => r.date.startsWith(lastMonthStr));
            titleEl.innerText = "গত মাসের হিসাব";
            break;
        case 'year':
            const yearStr = todayStr.substring(0, 4);
            filtered = allRecords.filter(r => r.date.startsWith(yearStr));
            titleEl.innerText = "এই বছরের হিসাব";
            break;
        case 'calendar':
            filtered = allRecords.filter(r => r.date === customDate);
            titleEl.innerText = customDate + " এর হিসাব";
            break;
        default:
            filtered = allRecords;
            titleEl.innerText = "সব সময়ের হিসাব";
    }

    // স্ক্রিন রেন্ডারিং
    list.innerHTML = "";
    let iSum = 0, eSum = 0;

    filtered.sort((a,b) => b.ts - a.ts).forEach(item => {
        if(item.type === 'income') iSum += item.amt; else eSum += item.amt;
        
        list.innerHTML += `
            <div class="bg-white p-5 rounded-3xl shadow-sm flex justify-between items-center border border-gray-50 animate-up">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-lg ${item.type === 'income' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}">
                        <i class="fa-solid ${item.type === 'income' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i>
                    </div>
                    <div>
                        <p class="font-bold text-gray-800 text-sm">${item.desc}</p>
                        <p class="text-[10px] text-gray-400 font-bold tracking-widest uppercase">${item.date}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-lg font-black ${item.type === 'income' ? 'text-green-500' : 'text-red-500'}">
                        ${item.type === 'income' ? '+' : '-'} ৳${item.amt}
                    </p>
                </div>
            </div>
        `;
    });

    incomeEl.innerText = iSum.toLocaleString('bn-BD');
    expenseEl.innerText = eSum.toLocaleString('bn-BD');
    document.getElementById('current-date').innerText = todayStr;
    if(document.getElementById('sidebar').classList.contains('active')) toggleSidebar();
}

// --- ৩. ইউটিলিটি ফাংশনস ---
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('sidebar-overlay').classList.toggle('hidden');
}

function openCalendar() {
    document.getElementById('calInput').showPicker();
}

function filterByCalendar(val) {
    loadHishab('calendar', val);
}

async function undo() {
    const all = await db.records.toArray();
    if(all.length > 0) {
        const last = all[all.length - 1];
        if(confirm(`"${last.desc}" হিসাবটি মুছে ফেলতে চান?`)) {
            await db.records.delete(last.id);
            loadHishab(currentFilter);
        }
    }
}

// রাত ১২টার পর আপডেট করার লজিক
function checkMidnightUpdate() {
    const lastUpdate = localStorage.getItem('last_update_date');
    const today = new Date().toDateString();
    if (lastUpdate && lastUpdate !== today) {
        console.log("নতুন দিন শুরু হয়েছে, হিসাব আপডেট করা হচ্ছে...");
        // এখানে চাইলে কোনো অটোমেটেড মেসেজ বা রিপোর্ট জেনারেট করা যায়
    }
    localStorage.setItem('last_update_date', today);
}

function logout() {
    if(confirm("লগআউট করতে চান?")) {
        localStorage.removeItem('user_session');
        location.reload();
    }
}

// চেক সেশন
window.onload = () => {
    if(localStorage.getItem('user_session')) {
        document.getElementById('user-display').innerText = localStorage.getItem('user_session').split('@')[0];
        initApp();
    }
    }
