const socket = io();

const authContainer = document.getElementById('auth-container');
const gameContainer = document.getElementById('game-container');
const authMsg = document.getElementById('auth-msg');

const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');

const regUsernameInput = document.getElementById('reg-username');
const regPasswordInput = document.getElementById('reg-password');
const regPasswordConfirmInput = document.getElementById('reg-password-confirm');
const idCheckMsg = document.getElementById('id-check-msg');
const pwMatchMsg = document.getElementById('pw-match-msg');

const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const mapTitle = document.getElementById('current-map-title');
const userListEl = document.getElementById('user-list');
const userCountEl = document.getElementById('user-count');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let myUsername = '';
let currentMap = 'map1';
let players = {};
let allPlayers = {}; // 전체 접속자 관리
let myPosition = { x: 100, y: 100 };
let isUsernameChecked = false;

// 섹션 접기/펼치기 토글 함수 (전역 등록)
function toggleSection(sectionId, headerEl) {
    const section = document.getElementById(sectionId);
    const arrow = headerEl.querySelector('span:last-child');
    if (section.classList.contains('hidden')) {
        section.classList.remove('hidden');
        arrow.innerText = '▼';
    } else {
        section.classList.add('hidden');
        arrow.innerText = '▶';
    }
}
window.toggleSection = toggleSection;

// 탭 전환 함수 (전역 등록)
function switchTab(tabName) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabs = document.querySelectorAll('.tab-btn');

    tabs.forEach(btn => btn.classList.remove('active'));
    authMsg.innerText = '';

    if (tabName === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabs[0].classList.add('active');
    } else {
        if (localStorage.getItem('game_registered') === 'true') {
            authMsg.innerText = '이 기기에서는 이미 회원가입이 완료되었습니다. (기기당 1개 제한)';
            authMsg.style.color = '#ff5252';
            return;
        }
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabs[1].classList.add('active');
    }
}
window.switchTab = switchTab;

function togglePassword(elementId, btn) {
    const input = document.getElementById(elementId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerText = '숨김';
    } else {
        input.type = 'password';
        btn.innerText = '보기';
    }
}
window.togglePassword = togglePassword;

regUsernameInput.addEventListener('input', () => {
    isUsernameChecked = false;
    idCheckMsg.innerText = '아이디 중복확인이 필요합니다.';
    idCheckMsg.style.color = '#ff5252';
});

function validatePassword() {
    const pw = regPasswordInput.value;
    const confirmPw = regPasswordConfirmInput.value;

    const regex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+{};:,<.>]).{8,}$/;
    if (!regex.test(pw)) {
        pwMatchMsg.innerText = '비밀번호는 8자 이상, 영문/숫자/특수문자를 모두 포함해야 합니다.';
        pwMatchMsg.style.color = '#ff5252';
        return false;
    }

    if (pw !== confirmPw) {
        pwMatchMsg.innerText = '비밀번호가 일치하지 않습니다.';
        pwMatchMsg.style.color = '#ff5252';
        return false;
    }

    pwMatchMsg.innerText = '비밀번호가 안전하고 일치합니다.';
    pwMatchMsg.style.color = '#4CAF50';
    return true;
}

regPasswordInput.addEventListener('input', validatePassword);
regPasswordConfirmInput.addEventListener('input', validatePassword);

function checkUsername() {
    const username = regUsernameInput.value.trim();
    if (!username) {
        idCheckMsg.innerText = '아이디를 입력해주세요.';
        idCheckMsg.style.color = '#ff5252';
        return;
    }
    socket.emit('check_username', { username });
}
window.checkUsername = checkUsername;

socket.on('check_username_res', (res) => {
    idCheckMsg.innerText = res.message;
    idCheckMsg.style.color = res.success ? '#4CAF50' : '#ff5252';
    isUsernameChecked = res.success;
});

document.getElementById('register-btn').addEventListener('click', () => {
    if (localStorage.getItem('game_registered') === 'true') {
        authMsg.innerText = '이 기기에서는 이미 회원가입이 완료되었습니다.';
        authMsg.style.color = '#ff5252';
        return;
    }

    const username = regUsernameInput.value.trim();
    const password = regPasswordInput.value.trim();

    if (!username) {
        authMsg.innerText = '아이디를 입력해주세요.';
        authMsg.style.color = 'yellow';
        return;
    }
    if (!isUsernameChecked) {
        authMsg.innerText = '아이디 중복 확인을 진행해주세요.';
        authMsg.style.color = 'yellow';
        return;
    }
    if (!validatePassword()) {
        authMsg.innerText = '비밀번호 규정 및 일치 여부를 확인해주세요.';
        authMsg.style.color = 'yellow';
        return;
    }

    socket.emit('register', { username, password });
});

socket.on('register_res', (res) => {
    authMsg.innerText = res.message;
    authMsg.style.color = res.success ? '#4CAF50' : '#ff5252';
    if (res.success) {
        localStorage.setItem('game_registered', 'true');
        regUsernameInput.value = '';
        regPasswordInput.value = '';
        regPasswordConfirmInput.value = '';
        setTimeout(() => switchTab('login'), 1500);
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();
    if (!username || !password) {
        authMsg.innerText = '아이디와 비밀번호를 모두 입력해주세요.';
        authMsg.style.color = 'yellow';
        return;
    }
    socket.emit('login', { username, password });
});

socket.on('login_res', (res) => {
    if (res.success) {
        myUsername = res.username;
        authContainer.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        socket.emit('join_game', { username: myUsername, mapId: currentMap });
        
        const initialMapConfig = getMapConfig(currentMap);
        mapTitle.innerText = `현재 맵: ${initialMapConfig.name}`;

        requestAnimationFrame(gameLoop);
    } else {
        authMsg.innerText = res.message;
        authMsg.style.color = '#ff5252';
    }
});

// 현재 맵 내 플레이어 위치 동기화
socket.on('update_players', (serverPlayers) => {
    players = serverPlayers;
});

// 🚀 전체 접속자 및 각 유저의 맵 정보 동기화
socket.on('update_all_players', (serverAllPlayers) => {
    allPlayers = serverAllPlayers;
    
    userListEl.innerHTML = '';
    let count = 0;
    for (let id in allPlayers) {
        count++;
        const p = allPlayers[id];
        const isMe = (p.username === myUsername);
        const mapConfig = getMapConfig(p.mapId);

        const li = document.createElement('li');
        li.innerText = `${p.username} (${mapConfig.name})${isMe ? ' [나]' : ''}`;
        if (isMe) {
            li.style.fontWeight = 'bold';
            li.style.color = '#4CAF50';
        }
        userListEl.appendChild(li);
    }
    userCountEl.innerText = count;
});

socket.on('map_changed', (newMap) => {
    currentMap = newMap;
    const mapConfig = getMapConfig(newMap);
    mapTitle.innerText = `현재 맵: ${mapConfig.name}`;
});

function changeMap(mapId) {
    socket.emit('change_map', mapId);
}
window.changeMap = changeMap;

const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key] = true; });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

function updateMovement() {
    let speed = 3;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) myPosition.y -= speed;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) myPosition.y += speed;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) myPosition.x -= speed;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) myPosition.x += speed;

    myPosition.x = Math.max(15, Math.min(canvas.width - 15, myPosition.x));
    myPosition.y = Math.max(15, Math.min(canvas.height - 15, myPosition.y));

    socket.emit('move', { x: myPosition.x, y: myPosition.y });
}

function gameLoop() {
    updateMovement();

    const mapConfig = getMapConfig(currentMap);
    ctx.fillStyle = mapConfig.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let id in players) {
        const p = players[id];
        const isMe = (p.username === myUsername);

        ctx.fillStyle = isMe ? '#4CAF50' : '#2196F3';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
        ctx.fill();

        if (isMe) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isMe ? `${p.username} (나)` : p.username, p.x, p.y - 20);
    }

    requestAnimationFrame(gameLoop);
}

function sendChat() {
    const text = chatInput.value.trim();
    if (!text) return;
    socket.emit('chat_message', text);
    chatInput.value = '';
}
window.sendChat = sendChat;

socket.on('chat_message', (data) => {
    const p = document.createElement('div');
    p.innerHTML = `<strong>${data.username}:</strong> ${data.text}`;
    chatBox.appendChild(p);
    chatBox.scrollTop = chatBox.scrollHeight;
});