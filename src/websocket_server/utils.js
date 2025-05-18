import { WebSocket } from 'ws';
import {roomsDB} from "./database/rooms.js";

export function handleRegistration(ws, data, playersDB, clients) {
    const { name, password } = data.data;
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
