const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const passport = require("passport");
// Load User model
const User = require("../models/User");

// Load Room model
const Room = require("../models/Room");

const { ensureAuthenticated } = require("../config/auth");

// Add room
router.post("/add", ensureAuthenticated, (req, res) => {
  const { name, accessKey } = req.body;

  if (name && accessKey) {
    let newRoom = new Room({
      name: name,
      accessKey: accessKey
    });

    newRoom.save(() => {
      req.flash("success_msg", "New room has been created");
      res.redirect("/rooms");
    });
  }
});

router.get("/delete/:id", ensureAuthenticated, (req, res) => {
  let _get = req.params;
  if (_get.id) {
    Room.deleteOne({
      _id: _get.id
    })
      .then(doc => {
        req.flash("success_msg", "Room has been deleted");
        res.redirect("/rooms");
      })
      .catch(err => console.log(err.message));
  }
});

router.get("/join/:id", ensureAuthenticated, async (req, res) => {
  try {
    let _get = req.params;
    let roomObj = await Room.findById(_get.id);

    if (roomObj) {
      res.render("join", {
        user: req.user,
        roomObj
      });
    } else {
      res.status(400).send("Room is not found in the database");
    }
  } catch (err) {
    console.error(err);
  }
});

router.post("/join/:id", ensureAuthenticated, (req, res) => {
  let _get = req.params;
  let body = req.body;

  let roomId = body.id;
  let accessKey = body.accessKey;

  if (accessKey) {
    Room.findById(roomId).then(doc => {
      if (doc.accessKey == accessKey) {
        req.session.room = doc;
        res.redirect("/game");
      } else {
        req.flash("error_msg", "Wrong access key, please try again.");
        res.redirect(`/rooms/join/${roomId}`);
      }
    });
  } else {
    req.flash("error_msg", "Please enter the valid access key");
    res.redirect(`/rooms/join/${roomId}`);
  }
});
module.exports = router;
