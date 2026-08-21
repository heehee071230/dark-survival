const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../client')));

const players = {};          // socket.id 기준 플레이어 정보
const activeUsers = {};      // username -> socket.id 매핑 (중복 로그인 방지용)

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
                // 🚀 이미 다른 곳에서 로그인되어 있는지 확인하고 강제 퇴장
                if (activeUsers[username]) {
                    const oldSocketId = activeUsers[username];
                    const oldSocket = io.sockets.sockets.get(oldSocketId);
                    
                    if (oldSocket) {
                        oldSocket.emit('force_logout', '다른 기기(또는 다른 창)에서 로그인하여 연결이 끊어졌습니다.');
                        oldSocket.disconnect();
                    }
                }

                activeUsers[username] = socket.id;
                socket.username = username;

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
        io.emit('chat_message', {
            username: player.username,
            text: msg
        });
    });

    socket.on('disconnect', () => {
        if (socket.username && activeUsers[socket.username] === socket.id) {
            delete activeUsers[socket.username];
        }

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

function broadcastAllPlayers() {
    io.emit('update_all_players', players);
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
