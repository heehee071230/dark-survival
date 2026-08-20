const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// public 폴더 위치 설정 (server 폴더 기준 한 칸 위로 나가서 찾기)
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// 실시간 멀티플레이(소켓) 로직
io.on('connection', (socket) => {
    console.log(`플레이어 접속됨: ${socket.id}`);

    socket.on('playerMove', (data) => {
        socket.broadcast.emit('playerMove', { id: socket.id, ...data });
    });

    socket.on('disconnect', () => {
        console.log(`플레이어 나감: ${socket.id}`);
        socket.broadcast.emit('playerDisconnected', socket.id);
    });
});

// 클라우드 환경에서 지정해 주는 포트를 쓰거나, 없으면 3000번 사용
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});