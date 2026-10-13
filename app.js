import { firebaseConfig, BOARD_ID } from './config.js';

const FB_VERSION = '10.12.2';
const TYPES = { base: '기준', alt: '대체', addon: '추가', discount: '할인' };

// 구글 시트 원본 데이터 (첫 실행 시 한 번만 저장됨)
const SEED = [
  ['스튜디오(세미)', '소율', 870000, '2시간 30분 촬영 / 앨범 6p / 원본+6P 수정컷 / 16R액자 / 드레스 2벌 + 캐주얼 1벌', 'base', true],
  ['스튜디오(세미)', '소율', 150000, '이모님', 'addon', false],
  ['스튜디오(세미)', '클레', 980000, '2시간 촬영 / 앨범 x / 원본+10P 수정컷 / 16R액자 / 드레스 2벌 (캐주얼 추가 불가)', 'alt', false],
  ['스튜디오(세미)', '클레', 200000, '이모님', 'addon', false],
  ['스튜디오(세미)', '추가 옵션', 400000, '앨범 20p + 기본 20r액자', 'addon', false],
  ['드레스 본식 1회', '시작by이명순', 1680000, '', 'base', true],
  ['드레스 본식 1회', '라포레', 1680000, '', 'alt', false],
  ['드레스 본식 1회', '황정아', 1910000, '', 'alt', false],
  ['드레스 본식 1회', '모리엠포티', 1030000, '', 'alt', false],
  ['헤메(촬영+본식)', '요닝', 570000, '실장', 'base', true],
  ['헤메(촬영+본식)', '요닝', 680000, '부원장', 'alt', false],
  ['헤메(촬영+본식)', '요닝', 900000, '원장', 'alt', false],
  ['헤메(촬영+본식)', '퓨티진동희', 595000, '실장', 'alt', false],
  ['헤메(촬영+본식)', '퓨티진동희', 705000, '부원장', 'alt', false],
  ['헤메(촬영+본식)', '퓨티진동희', 925000, '원장', 'alt', false],
  ['헤메(촬영+본식)', '지정비용', 30000, '스튜디오 1회', 'addon', false],
  ['헤메(촬영+본식)', '지정비용', 30000, '본식 1회', 'addon', false],
  ['기타', '제이웨딩할인', -100000, '', 'discount', true],
].map(([category, vendor, amount, note, type, selected]) =>
  ({ id: uid(), category, vendor, amount, note, type, selected }));

// ---------- helpers ----------
function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
}
const fmt = n => (Number(n) || 0).toLocaleString('ko-KR');
const signed = n => (n > 0 ? '+' : '') + fmt(n);
const tone = n => (n > 0 ? 'plus' : n < 0 ? 'minus' : 'zero');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function parseAmount(s) {
  const neg = /^\s*-/.test(String(s));
  const digits = String(s).replace(/[^\d]/g, '');
  const v = digits ? parseInt(digits, 10) : 0;
  return neg ? -v : v;
}
const $ = id => document.getElementById(id);

// ---------- state ----------
let rows = [];
let store = null;          // { save(rows) }
let pendingRender = false;

function categories() {
  const seen = [];
  for (const r of rows) if (!seen.includes(r.category)) seen.push(r.category);
  return seen;
}
function baseOf(category) {
  return rows.find(r => r.category === category && r.type === 'base');
}
function diffOf(r) {
  if (r.type === 'base') return 0;
  if (r.type === 'alt') {
    const b = baseOf(r.category);
    return b ? r.amount - b.amount : 0;
  }
  return r.amount; // 추가, 할인
}

// ---------- render ----------
function isEditing() {
  const a = document.activeElement;
  return a && $('table').contains(a) && (a.matches('input[type=text]') || a.tagName === 'SELECT');
}

function render() {
  if (isEditing()) { pendingRender = true; return; }
  pendingRender = false;

  const sel = rows.filter(r => r.selected);
  $('total').textContent = fmt(sel.reduce((s, r) => s + r.amount, 0)) + '원';
  const d = sel.reduce((s, r) => s + diffOf(r), 0);
  $('diff').textContent = signed(d);
  $('diff').className = tone(d);
  $('base').textContent = fmt(rows.filter(r => r.type === 'base').reduce((s, r) => s + r.amount, 0));

  const table = $('table');
  table.querySelectorAll('tbody').forEach(t => t.remove());

  for (const cat of categories()) {
    const items = rows.filter(r => r.category === cat);
    const subtotal = items.filter(r => r.selected).reduce((s, r) => s + r.amount, 0);
    let prevVendor = null;
    let html = `<tr class="cat"><td colspan="7"><div class="cat-row">
        <input type="text" data-cat="${esc(cat)}" data-field="category" value="${esc(cat)}" aria-label="구분 이름">
        <span class="subtotal">선택 ${fmt(subtotal)}</span>
        <button class="ghost" data-action="del-cat" data-cat="${esc(cat)}" title="구분 삭제">삭제</button>
      </div></td></tr>`;
    for (const r of items) {
      const diff = diffOf(r);
      const repeat = r.vendor && r.vendor === prevVendor;
      prevVendor = r.vendor;
      html += `<tr class="item${r.selected ? ' selected' : ''}" data-id="${r.id}">
        <td class="c-vendor"><input type="text" data-field="vendor" value="${esc(r.vendor)}" class="${repeat ? 'dim' : ''}" placeholder="업체명"></td>
        <td class="c-amount num"><input type="text" inputmode="numeric" class="amount" data-field="amount" value="${fmt(r.amount)}"></td>
        <td class="c-note"><input type="text" data-field="note" value="${esc(r.note)}" title="${esc(r.note)}" placeholder="—"></td>
        <td class="c-type"><select data-field="type">${Object.entries(TYPES).map(([k, v]) =>
          `<option value="${k}"${k === r.type ? ' selected' : ''}>${v}</option>`).join('')}</select></td>
        <td class="c-diff num ${tone(diff)}">${r.type === 'base' ? '기준' : signed(diff)}</td>
        <td class="c-sel col-sel"><input type="checkbox" data-field="selected"${r.selected ? ' checked' : ''} aria-label="선택"></td>
        <td class="c-del"><button class="ghost" data-action="del-row" title="행 삭제">✕</button></td>
      </tr>`;
    }
    html += `<tr class="add"><td colspan="7"><button class="ghost" data-action="add-row" data-cat="${esc(cat)}">+ 항목 추가</button></td></tr>`;
    const tbody = document.createElement('tbody');
    tbody.innerHTML = html;
    table.appendChild(tbody);
  }
}

// ---------- edits ----------
function commit() {
  render();
  store.save(rows);
}

$('table').addEventListener('change', e => {
  const el = e.target;
  const field = el.dataset.field;
  if (!field) return;

  if (field === 'category') {
    const oldName = el.dataset.cat;
    let name = el.value.trim() || oldName;
    if (name !== oldName && categories().includes(name)) name = name + ' 2';
    rows.forEach(r => { if (r.category === oldName) r.category = name; });
    el.blur();
    return commit();
  }

  const tr = el.closest('tr[data-id]');
  const r = tr && rows.find(x => x.id === tr.dataset.id);
  if (!r) return;
  if (field === 'selected') r.selected = el.checked;
  else if (field === 'amount') r.amount = parseAmount(el.value);
  else if (field === 'type') {
    // 한 구분에 기준은 하나만: 새 기준을 지정하면 기존 기준은 대체로 변경
    if (el.value === 'base') rows.forEach(x => { if (x.category === r.category && x.type === 'base') x.type = 'alt'; });
    r.type = el.value;
  } else r[field] = el.value;
  if (el.tagName === 'SELECT') el.blur();
  commit();
});

$('table').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('input[type=text]')) e.target.blur();
});

$('table').addEventListener('focusout', () => {
  setTimeout(() => { if (pendingRender) render(); }, 0);
});

$('table').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'add-row') {
    const cat = btn.dataset.cat;
    const lastIdx = rows.map(r => r.category).lastIndexOf(cat);
    const newRow = { id: uid(), category: cat, vendor: '', amount: 0, note: '', type: baseOf(cat) ? 'alt' : 'base', selected: false };
    rows.splice(lastIdx + 1, 0, newRow);
    commit();
    document.querySelector(`tr[data-id="${newRow.id}"] input[data-field=vendor]`)?.focus();
  } else if (action === 'del-row') {
    const id = btn.closest('tr[data-id]').dataset.id;
    const r = rows.find(x => x.id === id);
    if (!confirm(`'${r.vendor || '이 항목'}' ${fmt(r.amount)}원 행을 삭제할까요?`)) return;
    rows = rows.filter(x => x.id !== id);
    commit();
  } else if (action === 'del-cat') {
    const cat = btn.dataset.cat;
    if (!confirm(`'${cat}' 구분과 그 안의 항목을 모두 삭제할까요?`)) return;
    rows = rows.filter(r => r.category !== cat);
    commit();
  }
});

$('add-cat').addEventListener('click', () => {
  let name = '새 구분', n = 2;
  while (categories().includes(name)) name = `새 구분 ${n++}`;
  rows.push({ id: uid(), category: name, vendor: '', amount: 0, note: '', type: 'base', selected: false });
  commit();
  const input = document.querySelector(`tr.cat input[data-cat="${CSS.escape(name)}"]`);
  input?.focus(); input?.select();
});

// ---------- UI state ----------
function setStatus(text) { $('status').textContent = text; }
function showBoard() { $('gate').hidden = true; $('board').hidden = false; }
function showGate(msg) {
  $('board').hidden = true; $('gate').hidden = false;
  if (msg) $('gate-msg').textContent = msg;
}

// ---------- demo mode (Firebase 미설정) ----------
function startDemo() {
  const KEY = 'sdm-demo-rows';
  $('banner').hidden = false;
  $('banner').textContent = '데모 모드: config.js에 Firebase 설정을 넣기 전까지는 이 브라우저에만 저장됩니다.';
  try { rows = JSON.parse(localStorage.getItem(KEY)) || SEED; } catch { rows = SEED; }
  store = { save(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch {} setStatus('이 브라우저에 저장됨'); } };
  setStatus('데모 모드');
  showBoard();
  render();
}

// ---------- Firebase mode ----------
async function startFirebase() {
  const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}`;
  const { initializeApp } = await import(`${base}/firebase-app.js`);
  const { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } =
    await import(`${base}/firebase-auth.js`);
  const { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } =
    await import(`${base}/firebase-firestore.js`);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const ref = doc(db, 'boards', BOARD_ID);
  const provider = new GoogleAuthProvider();
  let unsubscribe = null;
  let saveTimer = null;

  $('login-btn').onclick = async () => {
    try { await signInWithPopup(auth, provider); }
    catch (err) {
      if (err.code === 'auth/popup-blocked') await signInWithRedirect(auth, provider);
      else if (err.code === 'auth/unauthorized-domain')
        showGate('이 도메인이 Firebase 승인 도메인에 없습니다. README의 "승인된 도메인" 단계를 확인하세요.');
      else if (err.code !== 'auth/popup-closed-by-user') showGate('로그인 실패: ' + err.message);
    }
  };

  store = {
    save(r) {
      setStatus('저장 중…');
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        try {
          await setDoc(ref, { rows: r, updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || '' });
          setStatus('저장됨 · ' + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
        } catch (err) {
          setStatus('저장 실패: ' + (err.code || err.message));
        }
      }, 400);
    }
  };

  onAuthStateChanged(auth, user => {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (!user) {
      $('user').innerHTML = '';
      setStatus('로그인이 필요합니다');
      showGate();
      return;
    }
    $('user').innerHTML = `<span>${esc(user.email)}</span><button id="logout-btn">로그아웃</button>`;
    $('logout-btn').onclick = () => signOut(auth);
    setStatus('불러오는 중…');

    unsubscribe = onSnapshot(ref, snap => {
      if (!snap.exists()) {
        rows = SEED;
        store.save(rows);      // 첫 실행: 시트 데이터로 초기화
      } else {
        if (snap.metadata.hasPendingWrites) return; // 내 저장이 반영 중인 건 무시
        rows = snap.data().rows || [];
        const by = snap.data().updatedBy;
        setStatus('동기화됨' + (by ? ` · 마지막 수정 ${by.split('@')[0]}` : ''));
      }
      showBoard();
      render();
    }, err => {
      if (err.code === 'permission-denied')
        showGate(`${user.email} 계정은 접근 권한이 없습니다. firestore.rules의 이메일 목록을 확인하세요.`);
      else showGate('불러오기 실패: ' + err.message);
    });
  });
}

if (String(firebaseConfig.apiKey).startsWith('YOUR_')) startDemo();
else startFirebase().catch(err => showGate('Firebase 초기화 실패: ' + err.message));
