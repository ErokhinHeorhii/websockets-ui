import {WebSocketServer} from 'ws';
import {httpServer} from "./src/http_server/index.js";
import {playersDB} from './src/websocket_server/database/players.js';
import {handleRegistration, broadcastRooms} from './src/websocket_server/utils.js';
import {roomsDB} from "./src/websocket_server/database/rooms.js";
import {gamesDB} from "./src/websocket_server/database/games.js";

const HTTP_PORT = 8181;
const WS_PORT = Number(process.env.WS_PORT) || 3000;

console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP server running on port ${HTTP_PORT}`);
});

const wss = new WebSocketServer({port: WS_PORT});
console.log(`WebSocket server created on port ${WS_PORT}`);

const clients = new Set();

wss.on('connection', (ws) => {
    console.log('Client connected');
    clients.add(ws);

    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.type === 'reg') {
                const {name, password} = JSON.parse(parsedMessage.data);
                if (typeof name === 'string' && typeof password === 'string') {

                    handleRegistration(ws, parsedMessage, playersDB, clients);
                } else {
                    ws.send(JSON.stringify({
                        type: 'reg',
                        data: JSON.stringify({
                            error: true,
                            errorText: 'Invalid data format!!!!'
                        }),
                        id: 0
                    }));
                }
            }
            else if (parsedMessage.type === 'create_room') {
                const player = playersDB.findByIndex(ws.playerIndex);
                if (player) {
                    roomsDB.createRoom(player);
                    broadcastRooms(roomsDB, clients);
                }
            }
            else if (parsedMessage.type === 'add_user_to_room') {
                const player = playersDB.findByIndex(ws.playerIndex);

                let roomData;
                try {
                    roomData = typeof parsedMessage.data === 'string'
                        ? JSON.parse(parsedMessage.data)
                        : parsedMessage.data;
                } catch (e) {
                    console.error('Ошибка парсинга indexRoom:', e);
                    return;
                }

                const roomId = roomData.indexRoom;

                if (typeof roomId === 'undefined') {
                    console.warn('indexRoom не передан');
                    return;
                }

                const room = roomsDB.addUserToRoom(roomId, player);

                if (room && room.roomUsers.length === 2) {
                    const gameId = Date.now();

                    const players = room.roomUsers.map((user, index) => {
                        const p = playersDB.findByIndex(user.index);
                        return {
                            index: user.index,
                            idPlayer: `${gameId}-${index}`,
                            ws: p?.ws
                        };
                    });

                    gamesDB.createGame(gameId, players);

                    players.forEach((p) => {
                        if (p.ws?.readyState === p.ws.OPEN) {
                            p.ws.send(JSON.stringify({
                                type: 'create_game',
                                data: JSON.stringify({
                                    idGame: gameId,
                                    idPlayer: p.idPlayer
                                }),
                                id: 0
                            }));
                        }
                    });

                    roomsDB.removeRoom(roomId);
                    broadcastRooms(roomsDB, clients);
                }
            }
            else if (parsedMessage.type === 'add_ships') {
                const { gameId, ships, indexPlayer } = typeof parsedMessage.data === 'string'
                    ? JSON.parse(parsedMessage.data)
                    : parsedMessage.data;

                console.log(`Получены корабли от игрока ${indexPlayer} в игре ${gameId}`);

                const game = gamesDB.getGame(gameId);
                if (!game) {
                    console.log('Игра не найдена:', gameId);
                    return;
                }

                const player = game.players.find(p => p.idPlayer === indexPlayer);
                if (!player) {
                    console.log('Игрок не найден в игре:', indexPlayer);
                    return;
                }

                player.ships = ships;

                const bothReady = game.players.every(p => Array.isArray(p.ships));

                if (bothReady) {
                    console.log('Оба игрока готовы. Начинаем игру.');

                    game.players.forEach(p => {
                        if (p.ws && p.ws.readyState === p.ws.OPEN) {
                            p.ws.send(JSON.stringify({
                                type: 'start_game',
                                data: {
                                    ships: p.ships,
                                    currentPlayerIndex: p.idPlayer
                                },
                                id: 0
                            }));
                        }
                    });
                }
            }
        }
        catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`Client disconnected. Code: ${code}, Reason: ${reason}`);
        clients.delete(ws);

        if (ws.playerIndex !== undefined) {
            const player = playersDB.findByIndex(ws.playerIndex);
            if (player) {
                player.ws = null;
                console.log(`Player ${player.name} disconnected`);
            }
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});
