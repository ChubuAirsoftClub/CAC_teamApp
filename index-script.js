import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

// Firebase Configuration (管理者画面と同一)
const firebaseConfig = {
  apiKey: "AIzaSyD-9HM6DAcSHZvx6_zcdRk-Q7j9W5PnUJs",
  authDomain: "cac-pointapp.firebaseapp.com",
  projectId: "cac-pointapp",
  storageBucket: "cac-pointapp.firebasestorage.app",
  messagingSenderId: "428732442449",
  appId: "1:428732442449:web:ea6bbbf5693736d8a89570",
  measurementId: "G-4XXCRZT4VZ"
};

// Initialize Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Data Store
let players = [];
let teams = [];
let globalLogs = [];

// HTMLエスケープ処理
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// チームごとのTailwindカラークラス変換ヘルパー
function getTeamBadgeClass(color) {
  switch(color) {
    case 'red': return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    case 'yellow': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    case 'emerald': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    case 'blue': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    case 'purple': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    case 'none':
    default: return 'bg-slate-700 text-slate-300 border-slate-600';
  }
}

// タブ切り替え
window.switchTab = function(tab) {
  ['ranking', 'teams'].forEach(t => {
    document.getElementById(`sec-${t}`).classList.add('hidden');
    document.getElementById(`tab-${t}`).className = "py-2.5 rounded-md text-slate-400 hover:text-slate-200 transition";
  });

  document.getElementById(`sec-${tab}`).classList.remove('hidden');
  document.getElementById(`tab-${tab}`).className = "py-2.5 rounded-md bg-amber-500 text-slate-950 shadow transition";
};

// 画面描画処理
function render() {
  // 1. Ranking List
  const rankingList = document.getElementById('ranking-list');
  rankingList.innerHTML = '';
  const activePlayers = players.filter(p => p.active !== false);
  document.getElementById('total-players-count').textContent = `参加者: ${activePlayers.length}名`;

  if(players.length === 0) {
    rankingList.innerHTML = '<div class="text-center text-slate-500 py-8 text-sm">部員が登録されていません</div>';
  } else {
    const sorted = [...players].sort((a,b) => b.points - a.points);
    let currentRank = 1;

    sorted.forEach((p, idx) => {
      if (idx > 0 && p.points < sorted[idx - 1].points) {
        currentRank = idx + 1;
      }

      let rankBadge = `<span class="w-6 h-6 rounded-full bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center">${currentRank}</span>`;
      if(currentRank === 1) rankBadge = `<span class="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shadow">1</span>`;
      if(currentRank === 2) rankBadge = `<span class="w-6 h-6 rounded-full bg-slate-300 text-slate-950 font-black text-xs flex items-center justify-center shadow">2</span>`;
      if(currentRank === 3) rankBadge = `<span class="w-6 h-6 rounded-full bg-amber-700 text-amber-100 font-black text-xs flex items-center justify-center shadow">3</span>`;

      const team = teams.find(t => t.id === p.teamId);
      const badgeClass = team ? getTeamBadgeClass(team.color) : 'bg-slate-700 text-slate-300 border-slate-600';
      const teamLabel = team ? `<span class="text-[10px] border px-2 py-0.5 rounded-full ${badgeClass} ml-1.5 font-bold">${escapeHtml(team.name)}</span>` : '';

      const card = document.createElement('div');
      card.className = "bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center justify-between";
      card.innerHTML = `
        <div class="flex items-center space-x-2">
          ${rankBadge}
          <span class="font-bold text-sm text-slate-100">${escapeHtml(p.name)}</span>
        </div>
        <div class="flex items-center space-x-2">
          ${teamLabel}
          <span class="font-black text-base text-amber-400">${p.points} <span class="text-xs font-normal text-slate-400">pt</span></span>
        </div>
      `;
      rankingList.appendChild(card);
    });
  }

  // 2. Team Management Render
  const teamsContainer = document.getElementById('teams-container');
  teamsContainer.innerHTML = '';
  if(teams.length === 0) {
    teamsContainer.innerHTML = '<div class="text-slate-500 italic text-xs">チームが登録されていません</div>';
  } else {
    teams.forEach(t => {
      const teamMembers = players.filter(p => p.teamId === t.id);
      const totalLevel = teamMembers.reduce((sum, m) => sum + (parseInt(m.level) || 1), 0);
      const badgeClass = getTeamBadgeClass(t.color);

      const card = document.createElement('div');
      card.className = "bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2";
      
      let membersHTML = teamMembers.map(m => `
        <span class="inline-flex items-center gap-1 bg-slate-800 text-slate-200 text-xs px-2 py-1 rounded border border-slate-700">
          ${escapeHtml(m.name)}
        </span>
      `).join(' ');

      if(teamMembers.length === 0) membersHTML = '<span class="text-slate-600 text-xs italic">所属メンバーなし</span>';

      card.innerHTML = `
        <div class="flex justify-between items-center border-b border-slate-800 pb-2">
          <span class="font-bold text-sm px-2.5 py-1 rounded-full border ${badgeClass}"><i class="fa-solid fa-users text-xs mr-1.5"></i>${escapeHtml(t.name)} (${teamMembers.length}名)</span>
        </div>
        <div class="flex flex-wrap gap-1.5 pt-1">${membersHTML}</div>
      `;
      teamsContainer.appendChild(card);
    });
  }

  // 3. Logs
  const logsContainer = document.getElementById('recent-logs');
  logsContainer.innerHTML = '';
  if(globalLogs.length === 0) {
    logsContainer.innerHTML = '<div class="text-slate-500 italic">履歴はありません</div>';
  } else {
    globalLogs.slice(0, 5).forEach(l => {
      const logItem = document.createElement('div');
      logItem.className = "flex justify-between border-b border-slate-700/50 pb-1";
      logItem.innerHTML = `
        <span><strong class="text-amber-400">${escapeHtml(l.targetName)}</strong> : ${escapeHtml(l.reason)}</span>
        <span class="font-bold text-emerald-400">+${l.pts} pt</span>
      `;
      logsContainer.appendChild(logItem);
    });
  }
}

// Firestoreのデータをリアルタイムで監視・同期
onSnapshot(doc(db, "sabage", "mainData"), (docSnap) => {
  if (docSnap.exists()) {
    const data = docSnap.data();
    players = data.players || [];
    teams = data.teams || [];
    globalLogs = data.globalLogs || [];
  }
  render();
}, (error) => {
  console.error("Firestore同期エラー: ", error);
});