import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

// DBから取得した「ハッシュ化済みパスワード」を保持する変数
let serverAdminPasswordHash = "";

// 文字列をSHA-256でハッシュ化する関数
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ログイン処理関数（async化してハッシュ照合）
window.handleLogin = async function(e) {
  e.preventDefault();
  const inputPass = document.getElementById('login-password').value;
  const errorMsg = document.getElementById('login-error');

  const inputHash = await hashPassword(inputPass);

  if (inputHash === serverAdminPasswordHash) {
    sessionStorage.setItem('admin_authenticated', 'true');
    document.getElementById('login-modal').classList.add('hidden');
    errorMsg.classList.add('hidden');
  } else {
    errorMsg.classList.remove('hidden');
    document.getElementById('login-password').value = '';
  }
};

// ページ読み込み時に既にログイン済みか確認してモーダルを隠す
document.addEventListener('DOMContentLoaded', () => {
  const isAuth = sessionStorage.getItem('admin_authenticated');
  if (isAuth === 'true') {
    document.getElementById('login-modal').classList.add('hidden');
  }
});

// Firebase Configuration
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

// Initial State & Data Store
let players = [];
let teams = [
  { id: 'team_red', name: '赤チーム', color: 'red' },
  { id: 'team_yellow', name: '黄チーム', color: 'yellow' }
];
let globalLogs = [];

// Default Point Rules
let pointRules = [
  { id: 'r1', target: 'team', name: 'チーム勝利', pts: 10, icon: 'fa-flag', color: 'emerald' },
  { id: 'r2', target: 'indiv', name: '勝利', pts: 10, icon: 'fa-trophy', color: 'emerald' },
  { id: 'r3', target: 'indiv', name: 'フラッグGET', pts: 20, icon: 'fa-bullseye', color: 'amber' },
  { id: 'r4', target: 'indiv', name: 'ラストサバイバー', pts: 5, icon: 'fa-shield-halved', color: 'blue' },
  { id: 'r5', target: 'indiv', name: 'ファーストヒット', pts: 5, icon: 'fa-skull', color: 'rose' },
  { id: 'r6', target: 'indiv', name: '特殊ミッション', pts: 5, icon: 'fa-star', color: 'purple' }
];

// クラウド（Firestore）へデータを保存する処理
async function saveData() {
  try {
    await setDoc(doc(db, "sabage", "mainData"), {
      players: players,
      teams: teams,
      globalLogs: globalLogs,
      pointRules: pointRules,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error("Firestore保存エラー: ", e);
  }
}

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

window.switchTab = function(tab) {
  ['score', 'ranking', 'teams', 'members', 'settings'].forEach(t => {
    document.getElementById(`sec-${t}`).classList.add('hidden');
    document.getElementById(`tab-${t}`).className = "py-2.5 rounded-md text-slate-400 hover:text-slate-200 transition";
  });

  document.getElementById(`sec-${tab}`).classList.remove('hidden');
  document.getElementById(`tab-${tab}`).className = "py-2.5 rounded-md bg-amber-500 text-slate-950 shadow transition";
};

window.toggleTargetType = function() {
  const isTeam = document.querySelector('input[name="target-type"]:checked').value === 'team';
  document.getElementById('target-team-box').classList.toggle('hidden', !isTeam);
  document.getElementById('target-indiv-box').classList.toggle('hidden', isTeam);
  
  document.getElementById('btn-group-team').classList.toggle('hidden', !isTeam);
  document.getElementById('btn-group-indiv').classList.toggle('hidden', isTeam);
};

function render() {
  const teamSelect = document.getElementById('team-select');
  const prevSelectedTeam = teamSelect.value;
  teamSelect.innerHTML = teams.length === 0 ? '<option value="">チームがありません</option>' : '';
  teams.forEach(t => {
    const memberCount = players.filter(p => p.teamId === t.id).length;
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.name} (${memberCount}名所属)`;
    teamSelect.appendChild(opt);
  });
  if (prevSelectedTeam && teams.some(t => t.id === prevSelectedTeam)) {
    teamSelect.value = prevSelectedTeam;
  }

  const indivSelect = document.getElementById('player-select');
  const prevSelectedPlayer = indivSelect.value;
  indivSelect.innerHTML = players.length === 0 ? '<option value="">部員を登録してください</option>' : '';
  players.forEach(p => {
    const team = teams.find(t => t.id === p.teamId);
    const teamName = team ? ` [${team.name}]` : ' [未所属]';
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name}${teamName} (${p.points} pt)`;
    indivSelect.appendChild(opt);
  });
  if (prevSelectedPlayer && players.some(p => p.id === prevSelectedPlayer)) {
    indivSelect.value = prevSelectedPlayer;
  }

  const teamBtnsContainer = document.getElementById('btn-group-team');
  const indivBtnsContainer = document.getElementById('btn-group-indiv');
  teamBtnsContainer.innerHTML = '';
  indivBtnsContainer.innerHTML = '';

  pointRules.forEach(rule => {
    const btn = document.createElement('button');
    btn.onclick = () => addPoint(rule.name, rule.pts);
    btn.className = "flex justify-between items-center bg-slate-700 hover:bg-slate-650 active:scale-[0.98] border border-slate-600 p-3 rounded-lg transition text-left";
    btn.innerHTML = `
      <div>
        <div class="font-bold text-sm"><i class="fa-solid ${rule.icon || 'fa-circle-dot'} text-${rule.color || 'amber'}-400 mr-2"></i>${escapeHtml(rule.name)}</div>
        <div class="text-xs text-slate-400">${rule.target === 'team' ? 'チームメンバー全員に付与' : '個人に付与'}</div>
      </div>
      <span class="bg-${rule.color || 'amber'}-500/20 text-${rule.color || 'amber'}-400 font-extrabold px-3 py-1 rounded-full text-sm">+${rule.pts} pt</span>
    `;

    if(rule.target === 'team') {
      teamBtnsContainer.appendChild(btn);
    } else {
      indivBtnsContainer.appendChild(btn);
    }
  });

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
          <button onclick="adjustPoint('${p.id}', -5)" class="text-slate-500 hover:text-rose-400 px-1 text-xs"><i class="fa-solid fa-minus"></i></button>
          <button onclick="adjustPoint('${p.id}', 5)" class="text-slate-500 hover:text-emerald-400 px-1 text-xs"><i class="fa-solid fa-plus"></i></button>
        </div>
      `;
      rankingList.appendChild(card);
    });
  }

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
          ${escapeHtml(m.name)} (Lv.${m.level || 1})
          <button onclick="assignTeam('${m.id}', '')" class="text-slate-500 hover:text-rose-400 ml-1"><i class="fa-solid fa-xmark"></i></button>
        </span>
      `).join(' ');

      if(teamMembers.length === 0) membersHTML = '<span class="text-slate-600 text-xs italic">所属メンバーなし</span>';

      card.innerHTML = `
        <div class="flex justify-between items-center border-b border-slate-800 pb-2">
          <span class="font-bold text-sm px-2.5 py-1 rounded-full border ${badgeClass}"><i class="fa-solid fa-users text-xs mr-1.5"></i>${escapeHtml(t.name)} (${teamMembers.length}名)</span>
          <div class="flex items-center gap-2">
            <span class="text-xs bg-slate-700 text-slate-300 border border-slate-600 px-2 py-0.5 rounded-full font-bold">Total Lv.${totalLevel}</span>
            <button onclick="deleteTeam('${t.id}')" class="text-slate-600 hover:text-rose-400 text-xs"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5 pt-1">${membersHTML}</div>
      `;
      teamsContainer.appendChild(card);
    });
  }

  const membersList = document.getElementById('members-list');
  membersList.innerHTML = '';
  if(players.length === 0) {
    membersList.innerHTML = '<div class="text-slate-500 italic text-xs">登録部員はいません</div>';
  } else {
    players.forEach(p => {
      const item = document.createElement('div');
      item.className = "flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800 text-xs";
      
      let teamOptions = `<option value="">未所属</option>` + teams.map(t => 
        `<option value="${t.id}" ${p.teamId === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`
      ).join('');

      let levelOptions = [1,2,3,4,5,6,7,8,9,10].map(lvl => 
        `<option value="${lvl}" ${(p.level || 1) === lvl ? 'selected' : ''}>Lv.${lvl}</option>`
      ).join('');

      const isChecked = p.active !== false ? 'checked' : '';

      item.innerHTML = `
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-1.5 cursor-pointer" title="自動振り分け対象にする">
            <input type="checkbox" ${isChecked} onchange="togglePlayerActive('${p.id}', this.checked)" class="accent-amber-500 w-3.5 h-3.5 rounded">
            <span class="font-medium ${isChecked ? 'text-slate-200' : 'text-slate-500 line-through'}">${escapeHtml(p.name)}</span>
          </label>
          <select onchange="updateLevel('${p.id}', this.value)" class="bg-slate-800 border border-slate-700 text-amber-400 font-bold text-[11px] rounded px-1.5 py-1">
            ${levelOptions}
          </select>
        </div>
        <div class="flex items-center gap-2">
          <select onchange="assignTeam('${p.id}', this.value)" class="bg-slate-800 border border-slate-700 text-slate-300 text-[11px] rounded px-1.5 py-1">
            ${teamOptions}
          </select>
          <button onclick="deleteMember('${p.id}')" class="text-slate-500 hover:text-rose-400 transition"><i class="fa-solid fa-trash"></i></button>
        </div>
      `;
      membersList.appendChild(item);
    });
  }

  const rulesList = document.getElementById('rules-list');
  rulesList.innerHTML = '';
  pointRules.forEach(rule => {
    const rItem = document.createElement('div');
    rItem.className = "flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800 text-xs";
    rItem.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400">${rule.target === 'team' ? 'チーム' : '個人'}</span>
        <span class="font-bold text-slate-200">${escapeHtml(rule.name)}</span>
        <span class="text-emerald-400 font-extrabold">+${rule.pts}pt</span>
      </div>
      <button onclick="deletePointRule('${rule.id}')" class="text-slate-500 hover:text-rose-400 transition"><i class="fa-solid fa-trash"></i></button>
    `;
    rulesList.appendChild(rItem);
  });

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

window.autoAssignTeams = function() {
  if (teams.length === 0) return alert('チームが作成されていません。先にチームを作成してください。');
  
  const activePlayers = players.filter(p => p.active !== false);
  if (activePlayers.length === 0) return alert('自動振り分けの対象（チェックが入っている部員）が誰もいません。');

  if (!confirm(`チェックが入っている部員（${activePlayers.length}名）を、現在のチーム（${teams.length}チーム）に自動でシャッフル＆均等振り分けますか？`)) {
    return;
  }

  let shuffledActive = [...activePlayers].sort(() => Math.random() - 0.5);
  shuffledActive.sort((a, b) => (parseInt(b.level) || 1) - (parseInt(a.level) || 1));

  const teamAllocations = teams.map(t => ({
    id: t.id,
    name: t.name,
    members: [],
    totalLevel: 0
  }));

  shuffledActive.forEach(player => {
    const playerLevel = parseInt(player.level) || 1;

    teamAllocations.sort((a, b) => {
      if (a.members.length !== b.members.length) {
        return a.members.length - b.members.length;
      }
      return a.totalLevel - b.totalLevel;
    });

    const targetTeam = teamAllocations[0];
    targetTeam.members.push(player.id);
    targetTeam.totalLevel += playerLevel;
  });

  teamAllocations.forEach(t => {
    t.members.forEach(pid => {
      const p = players.find(x => x.id === pid);
      if (p) p.teamId = t.id;
    });
  });

  players.forEach(p => {
    if (p.active === false) {
      p.teamId = '';
    }
  });

  saveData();
  alert('チームの自動振り分けが完了しました！');
};

window.togglePlayerActive = function(pid, isChecked) {
  const player = players.find(p => p.id === pid);
  if (player) {
    player.active = isChecked;
    saveData();
  }
};

window.addPoint = function(reason, pts) {
  const targetType = document.querySelector('input[name="target-type"]:checked').value;

  if(targetType === 'team') {
    const teamId = document.getElementById('team-select').value;
    if(!teamId) return alert('チームを選択してください');
    
    const team = teams.find(t => t.id === teamId);
    const targetMembers = players.filter(p => p.teamId === teamId);
    if(targetMembers.length === 0) return alert('このチームには部員が所属していません');

    targetMembers.forEach(p => p.points += pts);

    globalLogs.unshift({
      targetName: `[チーム] ${team.name}`,
      reason: `${reason} (${targetMembers.length}名全員)`,
      pts: pts
    });
  } else {
    const pid = document.getElementById('player-select').value;
    if(!pid) return alert('部員を選択してください');

    const player = players.find(p => p.id === pid);
    if(player) {
      player.points += pts;
      globalLogs.unshift({
        targetName: player.name,
        reason: reason,
        pts: pts
      });
    }
  }
  saveData();
};

window.adjustPoint = function(pid, delta) {
  const player = players.find(p => p.id === pid);
  if(player) {
    player.points = Math.max(0, player.points + delta);
    saveData();
  }
};

window.addSingleMember = function() {
  const input = document.getElementById('new-member-name');
  const levelSelect = document.getElementById('new-member-level');
  const name = input.value.trim();
  const level = parseInt(levelSelect.value) || 1;
  if(!name) return;

  players.push({ 
    id: 'p_' + Date.now() + Math.random().toString(36).substr(2,4), 
    name: name, 
    level: level, 
    teamId: '', 
    points: 0,
    active: true 
  });
  input.value = '';
  saveData();
};

window.addBulkMembers = function() {
  const textarea = document.getElementById('bulk-members');
  const names = textarea.value.split('\n').map(n => n.trim()).filter(n => n.length > 0);
  names.forEach(name => {
    players.push({ 
      id: 'p_' + Date.now() + Math.random().toString(36).substr(2,4), 
      name: name, 
      level: 1, 
      teamId: '', 
      points: 0,
      active: true 
    });
  });
  textarea.value = '';
  saveData();
};

window.deleteMember = function(pid) {
  if(confirm('この部員を削除しますか？')) {
    players = players.filter(p => p.id !== pid);
    saveData();
  }
};

window.updateLevel = function(pid, newLevel) {
  const player = players.find(p => p.id === pid);
  if(player) {
    player.level = parseInt(newLevel) || 1;
    saveData();
  }
};

window.addTeam = function() {
  const input = document.getElementById('new-team-name');
  const colorSelect = document.getElementById('new-team-color');
  const name = input.value.trim();
  const color = colorSelect.value;
  if(!name) return;
  teams.push({ id: 'team_' + Date.now(), name: name, color: color });
  input.value = '';
  saveData();
};

window.deleteTeam = function(teamId) {
  if(confirm('このチームを削除しますか？（所属部員は未所属になります）')) {
    teams = teams.filter(t => t.id !== teamId);
    players.forEach(p => { if(p.teamId === teamId) p.teamId = ''; });
    saveData();
  }
};

window.assignTeam = function(pid, teamId) {
  const player = players.find(p => p.id === pid);
  if(player) {
    player.teamId = teamId;
    saveData();
  }
};

window.addPointRule = function() {
  const target = document.getElementById('new-rule-target').value;
  const name = document.getElementById('new-rule-name').value.trim();
  const pts = parseInt(document.getElementById('new-rule-pts').value);
  if(!name || isNaN(pts)) return alert('項目名とポイント数を正しく入力してください');

  pointRules.push({
    id: 'r_' + Date.now(),
    target: target,
    name: name,
    pts: pts,
    icon: 'fa-star',
    color: 'amber'
  });
  document.getElementById('new-rule-name').value = '';
  saveData();
};

window.deletePointRule = function(ruleId) {
  if(confirm('This point rule is going to be deleted?')) {
    pointRules = pointRules.filter(r => r.id !== ruleId);
    saveData();
  }
};

window.resetPointsOnly = function() {
  if (confirm('【確認】部員データとチーム編成はそのまま維持し、全員のポイントと履歴だけを0にリセットしますか？')) {
    players.forEach(p => p.points = 0);
    globalLogs = [];
    saveData();
    alert('ポイントを0にリセットしました。');
  }
};

document.getElementById('reset-btn').addEventListener('click', () => {
  if(confirm('【警告】すべての登録部員、チーム、ポイントをリセットして初期状態に戻しますか？')) {
    players = [];
    teams = [
      { id: 'team_red', name: '赤チーム', color: 'red' },
      { id: 'team_yellow', name: '黄チーム', color: 'yellow' }
    ];
    globalLogs = [];
    saveData();
  }
});

// Firestoreのデータをリアルタイムで監視・同期
onSnapshot(doc(db, "sabage", "mainData"), (docSnap) => {
  if (docSnap.exists()) {
    const data = docSnap.data();
    players = data.players || [];
    teams = data.teams || [];
    globalLogs = data.globalLogs || [];
    if (data.pointRules && data.pointRules.length > 0) {
      pointRules = data.pointRules;
    }

    serverAdminPasswordHash = data.adminPasswordHash || "";
  }
  render();
}, (error) => {
  console.error("同期エラー: ", error);
});