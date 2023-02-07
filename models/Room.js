
const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  accessKey: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
});

const Room = mongoose.model('Room', RoomSchema);

module.exports = Room;
