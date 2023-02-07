exports = module.exports = function (io) {
  const mediasoup = require("mediasoup");
  const config = require("../config/config");

  // let users = {};
  let rooms = {};
  const mediaRooms = new Map();

  // MediaSoup server
  const mediaServer = mediasoup.Server({
    numWorkers: null, // Use as many CPUs as available.
    logLevel: config.mediasoup.logLevel,
    logTags: config.mediasoup.logTags,
    rtcIPv4: config.mediasoup.rtcIPv4,
    rtcIPv6: config.mediasoup.rtcIPv6,
    rtcAnnouncedIPv4: config.mediasoup.rtcAnnouncedIPv4,
    rtcAnnouncedIPv6: config.mediasoup.rtcAnnouncedIPv6,
    rtcMinPort: config.mediasoup.rtcMinPort,
    rtcMaxPort: config.mediasoup.rtcMaxPort,
  });

  //P2P variables
  var players;
  // var joined = true;
  var games = {};

  io.on("connection", function (socket) {
    //P2P mode
    if (socket.handshake.query.mode && socket.handshake.query.mode == "p2p") {
      //chessboard functionality
      var color;
      var playerId = Math.floor(Math.random() * 1000 + 1);

      socket.on("joined", function (roomId, gameTimer, playerColor) {
        if (!games.hasOwnProperty(roomId)) {
          games[roomId] = {
            moves: [],
            chatMessages: [],
            players: 0,
            pid: [0, 0],
          };
        }

        if (games[roomId].timerW == undefined) {
          games[roomId].timerW = gameTimer;
          games[roomId].timerB = gameTimer;
        }

        if (games[roomId].firstPlayerColor == undefined) {
          games[roomId].firstPlayerColor = playerColor;
        }

        socket.roomId = roomId;
        socket.playerId = playerId;
        if (games[roomId].players < 2) {
          //first two players will be participents.
          games[roomId].players++;
          var Idx = games[socket.roomId].pid.indexOf(0); // assign empty index of array to player
          games[roomId].pid[Idx] = playerId;
        } else {
          // console.log("room full");
          socket.emit("audience", true); // the players joined after 2nd will be audience/guests.
          socket.audience = true;
          // socket.emit("is_room_full", true);
        }

        players = games[roomId].players;

        if (Idx == 1) {
          //1 is second player index
          //2nd player
          if (games[roomId].firstPlayerColor == "white") {
            color = "black";
          } else {
            color = "white";
          }
          // idx:0 (player one) will be while and idx:1 (player two and guests) will be black;
          //2nd player will be black
        } else {
          //2nd player
          color = games[roomId].firstPlayerColor;
        }

        var preViousMoves = [];
        if (games[roomId].moves.length > 0) {
          preViousMoves = games[roomId].moves;
        }

        playerType = Idx + 1; //to display player number on the front page.
        if (socket.audience) {
          playerType = "Guest";
        }

        socket.join(roomId);

        socket.emit("player", {
          playerId,
          players,
          playerType,
          color,
          roomId,
          preViousMoves,
          chatMessages: games[roomId].chatMessages,
          gameTimerW: games[roomId].timerW,
          gameTimerB: games[roomId].timerB,
        });
        // players--;
      });
      socket.on("gameLost", function (roomID, loserColor) {
        io.in(roomID).emit("gameLost", loserColor);
      });

      socket.on("resign", function (roomID, playerType) {
        socket.broadcast.to(roomID).emit("resign", playerType);
      });
      socket.on("rematch_request", function (roomID) {
        socket.broadcast.to(roomID).emit("rematch_request", roomID);
      });
      socket.on("rematch_confirmation", function (roomID, action) {
        socket.broadcast.to(roomID).emit("rematch_confirmation", action);
      });
      socket.on("draw", function (roomID, playerType) {
        socket.broadcast.to(roomID).emit("draw", roomID, playerType);
      });
      socket.on("move_back", function (roomID, playerType) {
        socket.broadcast.to(roomID).emit("move_back", roomID, playerType);
      });
      socket.on("draw_confirmation", function (roomID, action) {
        socket.broadcast.to(roomID).emit("draw_confirmation", action);
      });
      socket.on("move_back_confirmation", function (roomID, action) {
        if (action == "Accepted") {
          games[roomID].moves.pop();
        }
        socket.broadcast.to(roomID).emit("move_back_confirmation", action);
      });

      socket.on("move", function (msg) {
        if (msg.timerObj.color == "w") {
          games[socket.roomId].timerW = msg.timerObj.timer;
        } else if (msg.timerObj.color == "b") {
          games[socket.roomId].timerB = msg.timerObj.timer;
        }
        games[socket.roomId].moves.push(msg.move);
        socket.broadcast.emit("move", msg);
      });

      // user chat msg
      socket.on("user_chat_msg", function (msgObj) {
        games[socket.roomId].chatMessages.push(msgObj);
        io.in(socket.roomId).emit("user_chat_msg_received", msgObj);
      });

      socket.on("play", function (msg) {
        // socket.broadcast.emit("play", msg);
        socket.to(socket.roomId).emit("play", msg);
      });

      socket.on("disconnect", function () {
        if (games.hasOwnProperty(socket.roomId)) {
          if (!socket.audience) {
            var Idx = games[socket.roomId].pid.indexOf(socket.playerId); // unset player array index on disconnect.
            games[socket.roomId].pid[Idx] = 0;

            games[socket.roomId].players--;
            io.in(socket.roomId).emit("user_left", true);

            if (games[socket.roomId].players == 0) {
              console.log("room deleted");
              delete games[socket.roomId];
            }
          }
        }
      });
    } else {
      //TEACHING mode
      let { room, userName, userRole } = socket.handshake.query;
      // console.log("new connection " + socket.id);

      // Used for mediaSoup mediaRoom
      let mediaRoom = null;
      // Used for mediaSoup peer
      let mediaPeer = null;
      let roomId = room;
      let peerName = userName;

      if (mediaRooms.has(roomId)) {
        mediaRoom = mediaRooms.get(roomId);
      } else {
        mediaRoom = mediaServer.Room(config.mediasoup.mediaCodecs);
        mediaRooms.set(roomId, mediaRoom);
        mediaRoom.on("close", () => {
          mediaRooms.delete(roomId);
        });
      }

      if (rooms[room] === undefined) {
        //if empty initalize room in rooms datastore
        rooms[room] = {
          users: [], //all users in a room
          moves: [], //all moves of the users,
          fenMoves: [], //all moves of the users,
          chatMessages: [],
          isFenMode: false,
          totalUser: 0,
          pgnString: "",
          teacherData: null,
        };
        // console.log("room created");
      }

      if (rooms[room].totalUser >= 7) {
        socket.emit("is_room_full", true);
      }

      //add user details to the socket itself
      socket.userData = { room, userName };

      //add socket to users datastore
      // users[socket.id] = socket;
      // users[socket.id].userData = { room, userName }; //room, userName

      //add user to the room and increment the users counter
      rooms[room].users.push(userName);
      rooms[room].totalUser = rooms[room].totalUser + 1;

      if (userRole !== "student") {
        rooms[room].teacherData = {
          role: userRole,
          name: userName,
        };
      }

      // socket joined the specific room
      // console.log("User joined the room " + room);
      socket.join(room);

      //emit room details to all users of the room
      socket.emit("all_connected_users", {
        room: rooms[room],
        teacherData: rooms[room].teacherData,
      });

      //to other only in room
      socket.to(room).emit("new_user_joined", userName);

      //emit moves if any move happend
      if (
        rooms[room].moves.length > 0 ||
        rooms[room].pgnString != "" ||
        rooms[room].isFenMode == true
      ) {
        socket.emit("set_board_position", {
          move: rooms[room].moves,
          pgnString: rooms[room].pgnString,
          isFenMode: rooms[room].isFenMode,
          fenMoves: rooms[room].fenMoves,
        });
      }

      socket.on("mediasoup-request", (request, cb) => {
        switch (request.method) {
          case "queryRoom":
            mediaRoom
              .receiveRequest(request)
              .then((response) => cb(null, response))
              .catch((error) => cb(error.toString()));
            break;

          case "join":
            mediaRoom
              .receiveRequest(request)
              .then((response) => {
                // Get the newly created mediasoup Peer
                mediaPeer = mediaRoom.getPeerByName(peerName);

                handleMediaPeer(mediaPeer);

                // Send response back
                cb(null, response);
              })
              .catch((error) => cb(error.toString()));
            break;

          default:
            if (mediaPeer) {
              mediaPeer
                .receiveRequest(request)
                .then((response) => cb(null, response))
                .catch((error) => cb(error.toString()));
            }
        }
      });

      socket.on("mediasoup-notification", (notification) => {
        // console.debug("Got notification from client peer", notification);

        // NOTE: mediasoup-client just sends notifications with target 'peer'
        if (!mediaPeer) {
          // console.error("Cannot handle mediaSoup notification, no mediaSoup Peer");
          return;
        }

        mediaPeer.receiveNotification(notification);
      });

      // emit move to all other users in the room
      socket.on("move", function (msg) {
        // rooms[room].fen = msg.position;
        rooms[room].pgnString = msg.pgn;
        rooms[room].moves.push(msg.move);
        rooms[room].fenMoves.push(msg.fen);
        socket.broadcast.to(room).emit("move", msg.move);
      });

      //load pgn
      socket.on("load_pgn", function (pgn) {
        rooms[room].isFenMode = false; //reset fenmode
        rooms[room].fenMoves = []; //rest fen moves
        rooms[room].pgnString = pgn;
        rooms[room].moves = []; //rest moves after pgn load
        socket.broadcast.to(room).emit("load_pgn", pgn);
      });

      socket.on("load_fen", function (payload) {
        rooms[room].fenMoves = [];
        rooms[room].isFenMode = true;
        rooms[room].fenMoves.push(payload.fenString);
        socket.broadcast.to(room).emit("load_fen", payload);
      });
      socket.on("draw_arrow", function (arrow_path) {
        socket.broadcast.to(room).emit("draw_arrow", arrow_path);
      });

      socket.on("clear_arrow", function (mode) {
        socket.broadcast.to(room).emit("clear_arrow", "yes");
      });

      socket.on("new_pgn", function (idx) {
        // console.log(idx);
        socket.broadcast.to(room).emit("new_pgn", idx);
      });

      socket.on("new_fen", function (idx) {
        // console.log(idx);
        socket.broadcast.to(room).emit("new_fen", idx);
      });
      // user chat msg
      socket.on("user_chat_msg", function (msgObj) {
        rooms[room].chatMessages.push(msgObj);
        io.in(room).emit("user_chat_msg_received", msgObj);
      });

      socket.on("disconnect", function () {
        // delete users[socket.id];
        if (mediaPeer) {
          mediaPeer.close(peerName);
        }

        if (rooms[socket.userData.room] === undefined) return;

        let index = rooms[socket.userData.room].users.indexOf(
          socket.userData.userName
        );
        if (index > -1) {
          rooms[socket.userData.room].users.splice(index, 1);
          rooms[socket.userData.room].totalUser =
            rooms[socket.userData.room].totalUser - 1;

          if (rooms[socket.userData.room].totalUser == 0) {
            delete rooms[socket.userData.room];
          }
        }

        io.in(room).emit("user_left", {
          userName: socket.userData.userName,
        });
        // console.log("disconnected " + socket.id);
      });

      /**
       * Handles all mediaPeer events
       *
       * @param mediaPeer
       */
      const handleMediaPeer = (mediaPeer) => {
        mediaPeer.on("notify", (notification) => {
          // console.log("New notification for mediaPeer received:", notification);
          socket.emit("mediasoup-notification", notification);
        });

        mediaPeer.on("newtransport", (transport) => {
          // console.log("New mediaPeer transport:", transport.direction);
          transport.on("close", (originator) => {
            // console.log("Transport closed from originator:", originator);
          });
        });

        mediaPeer.on("newproducer", (producer) => {
          // console.log("New mediaPeer producer:", producer.kind);
          producer.on("close", (originator) => {
            // console.log("Producer closed from originator:", originator);
          });
        });

        mediaPeer.on("newconsumer", (consumer) => {
          // console.log("New mediaPeer consumer:", consumer.kind);
          consumer.on("close", (originator) => {
            // console.log("Consumer closed from originator", originator);
          });
        });

        // Also handle already existing Consumers.
        mediaPeer.consumers.forEach((consumer) => {
          // console.log("mediaPeer existing consumer:", consumer.kind);
          consumer.on("close", (originator) => {
            // console.log("Existing consumer closed from originator", originator);
          });
        });
      };
    }
  });
};
