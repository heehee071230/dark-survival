const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'users.json');

if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
}

function getUsers() {
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(dbPath, JSON.stringify(users, null, 2));
}

const db = {
    checkUsername: (username, callback) => {
        const users = getUsers();
        const existing = users.find(u => u.username === username);
        if (existing) {
            callback(new Error('이미 사용 중인 아이디입니다.'));
        } else {
            callback(null);
        }
    },

    register: (username, password, callback) => {
        const users = getUsers();
        const existing = users.find(u => u.username === username);
        if (existing) {
            return callback(new Error('이미 존재하는 아이디입니다.'));
        }
        users.push({ username, password });
        saveUsers(users);
        return callback(null);
    },

    login: (username, password, callback) => {
        const users = getUsers();
        const user = users.find(u => u.username === username);
        if (!user) {
            return callback(new Error('존재하지 않는 아이디입니다.'));
        }
        if (user.password !== password) {
            return callback(new Error('비밀번호가 틀렸습니다.'));
        }
        return callback(null, user);
    }
};

console.log('데이터베이스 모듈 로드 완료');
module.exports = db;