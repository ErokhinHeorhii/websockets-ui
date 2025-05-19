export const gamesDB = {
    games: {},

    createGame(idGame, players) {
        this.games[idGame] = {
            idGame,
            players: players.map(p => ({
                ...p,
                ships: null
            })),
        };
    },

    setShips(idGame, idPlayer, ships) {
        const game = this.games[idGame];
        if (!game) return false;

        const player = game.players.find(p => p.idPlayer === idPlayer);
        if (!player) return false;

        player.ships = ships;

        const bothReady = game.players.every(p => p.ships !== null);
        console.log('Оба игрока готовы?', bothReady);
        if (bothReady) {
            console.log('Игра начинается!');
            game.players.forEach(p => {
                if (p.ws && p.ws.readyState === p.ws.OPEN) {
                    p.ws.send(JSON.stringify({
                        type: 'start_game',
                        data: JSON.stringify({
                            ships: p.ships,
                            currentPlayerIndex: p.idPlayer
                        }),
                        id: 0
                    }));
                }
            });
        }

        return bothReady;
    },

    getGame(idGame) {
        return this.games[idGame];
    },

    deleteGame(idGame) {
        delete this.games[idGame];
    }
};
