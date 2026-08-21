const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../client')));

const players = {};

io.on('connection', (socket) => {
    console.log(`새로운 유저 연결됨: ${socket.id}`);

    socket.on('check_username', ({ username }) => {
        db.checkUsername(username, (err) => {
            if (err) {
                socket.emit('check_username_res', { success: false, message: err.message });
            } else {
                socket.emit('check_username_res', { success: true, message: '사용 가능한 아이디입니다.' });
            }
        });
    });

    socket.on('register', ({ username, password }) => {
        db.register(username, password, (err) => {
            if (err) {
                socket.emit('register_res', { success: false, message: err.message });
            } else {
                socket.emit('register_res', { success: true, message: '회원가입 성공! 로그인해주세요.' });
            }
        });
    });

    socket.on('login', ({ username, password }) => {
        db.login(username, password, (err, user) => {
            if (err) {
                socket.emit('login_res', { success: false, message: err.message });
            } else {
                socket.emit('login_res', { success: true, username: user.username });
            }
        });
    });

    socket.on('join_game', ({ username, mapId }) => {
        players[socket.id] = {
            username: username,
            mapId: mapId || 'map1',
            x: 100,
            y: 100
        };
        socket.join(players[socket.id].mapId);
        broadcastAllPlayers();
    });

    socket.on('move', (data) => {
        if (!players[socket.id]) return;
        players[socket.id].x = data.x;
        players[socket.id].y = data.y;

        const currentMap = players[socket.id].mapId;
        // 내 맵의 유저들에게 내 위치 전달
        io.to(currentMap).emit('update_players', getPlayersInMap(currentMap));
    });

    socket.on('change_map', (newMapId) => {
        if (!players[socket.id]) return;
        
        const oldMapId = players[socket.id].mapId;
        socket.leave(oldMapId);

        players[socket.id].mapId = newMapId;
        players[socket.id].x = 100;
        players[socket.id].y = 100;
        socket.join(newMapId);

        broadcastAllPlayers();
        socket.emit('map_changed', newMapId);
    });

    socket.on('chat_message', (msg) => {
        if (!players[socket.id]) return;
        const player = players[socket.id];
        // 채팅은 전체 서버로 전송 (또는 맵별 전송 원하시면 변경 가능)
        io.emit('chat_message', {
            username: player.username,
            text: msg
        });
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            delete players[socket.id];
            broadcastAllPlayers();
        }
        console.log(`유저 나감: ${socket.id}`);
    });
});

function getPlayersInMap(mapId) {
    const mapPlayers = {};
    for (const id in players) {
        if (players[id].mapId === mapId) {
            mapPlayers[id] = players[id];
        }
    }
    return mapPlayers;
}

// 모든 접속자의 전체 목록을 모든 클라이언트에 브로드캐스트
function broadcastAllPlayers() {
    io.emit('update_all_players', players);
    // 현재 맵에 있는 유저들 화면 갱신용
    for (const socketId in io.sockets.sockets) {
        // 소켓 방별 갱신
    }
    io.sockets.sockets.forEach((sock) => {
        if (players[sock.id]) {
            sock.emit('update_players', getPlayersInMap(players[sock.id].mapId));
        }
    });
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`서버가 정상적으로 실행되었습니다: http://localhost:${PORT}`);
});