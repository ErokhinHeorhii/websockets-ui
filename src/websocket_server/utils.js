import {roomsDB} from "./database/rooms.js";
import {gamesDB} from "./database/games.js";

export function handleRegistration(ws, data, playersDB, clients) {

    let payload = data.data;

    if (typeof payload === 'string') {
        try {
            payload = JSON.parse(payload);
        } catch (e) {
            console.error('Ошибка парсинга data.data:', e);
            return;
        }
    }

    const { name, password } = payload;

    let player = playersDB.findByName(name);
    let error = false;
    let errorText = '';

    if (player) {
        if (!playersDB.validatePassword(player, password)) {
            error = true;
            errorText = 'Wrong password';
        }
    } else {
        player = playersDB.create(name, password);
    }

    if (!error) {
        player.ws = ws;
        ws.playerIndex = player.index;
    } else {
        player = null;
    }
    const response = {
        type: 'reg',
        data: JSON.stringify({
            name: player.name,
            index: player.index,
            error,
            errorText
        }),
        id: 0
    };

    if (ws.readyState === ws.OPEN) {
        try {
            ws.send(JSON.stringify(response));
        } catch (err) {
            console.warn('Ошибка при отправке через WebSocket:', err.message);
        }
    }else {
        console.warn('Не удалось отправить ответ: WebSocket не открыт');
    }

    if (!error) {
        broadcastRooms(roomsDB, clients);
        broadcastWinners(playersDB, clients);
    }
}

export function broadcastWinners(playersDB, clients) {
    const winners = playersDB.getWinners();
    const message = JSON.stringify({
        type: 'update_winners',
        data: JSON.stringify(winners),
        id: 0,
    });

    for (const client of [...clients]) {
        if (client.readyState === client.OPEN) {
            client.send(message);
        } else {
            clients.delete(client);
            console.log('Удалён неактивный клиент');
        }
    }
}

export function broadcastRooms(roomsDB, clients) {
    const roomsData = {
        type: 'update_room',
        data: JSON.stringify(roomsDB.getRooms()),
        id: 0
    };
    clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(JSON.stringify(roomsData));
        }
    });
}

export function handleAttack(ws, data) {
    const { gameId, x, y, indexPlayer } = data;

    const game = gamesDB.getGame(gameId);
    if (!game) return;

    const attacker = game.players.find(p => p.idPlayer === indexPlayer);
    const defender = game.players.find(p => p.idPlayer !== indexPlayer);

    if (!attacker || !defender || !defender.ships) return;

    let status = 'miss';
    let killedShip = null;

    for (const ship of defender.ships) {
        const hits = ship.hits || [];

        for (let i = 0; i < ship.length; i++) {
            const shipX = ship.direction ? ship.position.x : ship.position.x + i;
            const shipY = ship.direction ? ship.position.y + i : ship.position.y;

            if (shipX === x && shipY === y) {
                if (!hits.find(h => h.x === x && h.y === y)) {
                    hits.push({ x, y });
                }
                ship.hits = hits;
                status = hits.length === ship.length ? 'killed' : 'shot';
                if (status === 'killed') killedShip = ship;
                break;
            }
        }

        if (status !== 'miss') break;
    }

    const attackResponse = {
        type: 'attack',
        data: JSON.stringify({
            position: { x, y },
            currentPlayer: indexPlayer,
            status
        }),
        id: 0
    };

    game.players.forEach(p => {
        if (p.ws?.readyState === p.ws.OPEN) {
            p.ws.send(JSON.stringify(attackResponse));
        }
    });

    if (status === 'killed') {
        const missedCells = getCellsAroundShip(killedShip);

        missedCells.forEach(cell => {
            const missMsg = {
                type: 'attack',
                data: JSON.stringify({
                    position: { x: cell.x, y: cell.y },
                    currentPlayer: indexPlayer,
                    status: 'miss'
                }),
                id: 0
            };

            game.players.forEach(p => {
                if (p.ws?.readyState === p.ws.OPEN) {
                    p.ws.send(JSON.stringify(missMsg));
                }
            });
        });
    }

    if (status === 'miss' || status === 'killed') {
        game.currentTurn = defender.idPlayer;
    } else {
        game.currentTurn = attacker.idPlayer;
    }

    const allShipsKilled = defender.ships.every(ship => {
        return ship.hits && ship.hits.length === ship.length;
    });

    if (allShipsKilled) {
        const finishMessage = {
            type: 'finish',
            data: JSON.stringify({
                winPlayer: attacker.idPlayer
            }),
            id: 0
        };

        game.players.forEach(p => {
            if (p.ws?.readyState === p.ws.OPEN) {
                p.ws.send(JSON.stringify(finishMessage));
            }
        });

        gamesDB.deleteGame(gameId);
        return;
    }

    const turnMessage = {
        type: 'turn',
        data: JSON.stringify({
            currentPlayer: game.currentTurn
        }),
        id: 0
    };

    game.players.forEach(p => {
        if (p.ws?.readyState === p.ws.OPEN) {
            p.ws.send(JSON.stringify(turnMessage));
        }
    });
}


function getCellsAroundShip(ship) {
    const cells = [];

    const dx = ship.direction ? 0 : 1;
    const dy = ship.direction ? 1 : 0;
    for (let i = -1; i <= ship.length; i++) {
        for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
                const x = ship.position.x + dx * i + ox;
                const y = ship.position.y + dy * i + oy;

                let isShipCell = false;
                for (let j = 0; j < ship.length; j++) {
                    const sx = ship.position.x + dx * j;
                    const sy = ship.position.y + dy * j;
                    if (sx === x && sy === y) {
                        isShipCell = true;
                        break;
                    }
                }

                if (!isShipCell && x >= 0 && y >= 0 && x < 10 && y < 10) {
                    cells.push({ x, y });
                }
            }
        }
    }

    const seen = new Set();
    return cells.filter(({ x, y }) => {
        const key = `${x},${y}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
