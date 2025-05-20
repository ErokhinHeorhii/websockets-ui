class PlayersDatabase {
    constructor() {
        this.players = new Map();
        this.playersByName = new Map();
        this.indexCounter = 1;
    }

    findByName(name) {
        return this.playersByName.get(name);
    }

    findByIndex(index) {
        return this.players.get(index);
    }

    create(name, password) {
        const player = {
            index: this.indexCounter++,
            name,
            password,
            wins: 0,
            ws: null
        };

        this.players.set(player.index, player);
        this.playersByName.set(name, player);
        return player;
    }

    validatePassword(player, password) {
        return player.password === password;
    }

    getWinners() {
        return Array.from(this.players.values())
            .sort((a, b) => b.wins - a.wins)
            .map(player => ({
                name: player.name,
                wins: player.wins
            }));
    }
}

export const playersDB = new PlayersDatabase();
