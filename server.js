const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 연결 (현재 폴더)
app.use(express.static(path.join(__dirname)));

// 루트 접속 시 index.html 반환
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 회원가입 및 로그인 데이터 관리 파일 (users.json) ---
const USERS_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 1. 아이디 중복 확인
app.post('/api/check-duplicate', (req, res) => {
    const { username } = req.body;
    const users = loadUsers();
    if (users[username]) {
        res.json({ available: false, message: '이미 존재하는 아이디입니다!' });
    } else {
        res.json({ available: true, message: '사용 가능한 아이디입니다!' });
    }
});

// 2. 회원가입
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: '정보가 부족합니다.' });
    }
    const users = loadUsers();
    if (users[username]) {
        return res.json({ success: false, message: '이미 존재하는 아이디입니다.' });
    }
    users[username] = { password, score: 0 };
    saveUsers(users);
    res.json({ success: true, message: '회원가입이 완료되었습니다! 로그인해주세요.' });
});

// 3. 로그인
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = loadUsers();
    if (!users[username] || users[username].password !== password) {
        return res.json({ success: false, message: '아이디 또는 비밀번호가 잘못되었습니다.' });
    }
    res.json({ success: true, message: '로그인 성공', score: users[username].score || 0 });
});

// 4. 비밀번호 변경
app.post('/api/change-password', (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    const users = loadUsers();
    if (!users[username] || users[username].password !== currentPassword) {
        return res.json({ success: false, message: '현재 비밀번호가 일치하지 않습니다.' });
    }
    users[username].password = newPassword;
    saveUsers(users);
    res.json({ success: true, message: '비밀번호가 성공적으로 변경되었습니다.' });
});

// 5. 점수 저장
app.post('/api/saveScore', (req, res) => {
    const { username, score } = req.body;
    const users = loadUsers();
    if (users[username]) {
        if (score > (users[username].score || 0)) {
            users[username].score = score;
            saveUsers(users);
        }
    }
    res.json({ success: true });
});

// 실시간 멀티플레이(Socket.io) 로직
io.on('connection', (socket) => {
    console.log(`플레이어 접속됨: ${socket.id}`);

    socket.on('playerMove', (data) => {
        socket.broadcast.emit('playerMove', { id: socket.id, ...data });
    });

    socket.on('saveScore', (data) => {
        const users = loadUsers();
        if (data.username && users[data.username]) {
            if (data.score > (users[data.username].score || 0)) {
                users[data.username].score = data.score;
                saveUsers(users);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`플레이어 나감: ${socket.id}`);
        socket.broadcast.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
