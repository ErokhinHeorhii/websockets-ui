export const roomsDB = {
    rooms: [],
    nextRoomId: 1,

    createRoom(player) {
        if (!player || !player.name) {
            console.warn("createRoom: invalid player", player);
        }

        const room = {
            roomId: this.nextRoomId++,
            roomUsers: [{ name: player.name, index: player.index }]
        };
        this.rooms.push(room);
        return room;
    },

    addUserToRoom(roomId, player) {
        const room = this.rooms.find(r => r.roomId === roomId);
        if (!room || !player|| !player.name) return null;
        room.roomUsers.push({ name: player.name, index: player.index });
        return room;
    },

    removeRoom(roomId) {
        this.rooms = this.rooms.filter(r => r.roomId !== roomId);
    },

    getRooms() {
        return this.rooms.filter(r => r.roomUsers.length === 1);
    }
};
