const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Room = require("../models/Room");
const { ensureAuthenticated, forwardAuthenticated } = require("../config/auth");

// Welcome Page
router.get("/", forwardAuthenticated, (req, res) => res.render("welcome"));

// Dashboard
router.get("/dashboard", ensureAuthenticated, (req, res) => {
  if (req.user) {
    req.session.userInfo = req.user; //add user info to session
    global.currentUserRole = req.session.userInfo.role; //adding global variable
  }
  res.render("dashboard", {
    user: req.user
  });
});

//students admin page
router.get("/students", ensureAuthenticated, async (req, res) => {
  if (req.query.changeRole && req.query.id) {
    userRole = req.query.changeRole;

    userRoleUpdateTo = userRole == "teacher" ? "student" : "teacher";
    userId = req.query.id;
    await User.findByIdAndUpdate(userId, {
      role: userRoleUpdateTo
    });
    res.locals.success_msg = "User role change been changed.";
  }

  let allUser = User.find()
    .sort({ _id: -1 })
    .then(users => {
      // console.log(users);
      res.render("students", {
        loggedInUser: req.user,
        usersObj: users
      });
    })
    .catch(err => {
      if (err) throw err;
    });
});

// Edit
router.get("/edit_student/:id", ensureAuthenticated, (req, res) => {
  let userId = req.params.id;
  User.findOne({ _id: userId })
    .then(user => {
      if (user) {
        res.render("edit_student", {
          user
        });
      }
    })
    .catch(err => {
      if (err) {
        res.status(404).send("User not found");
      }
    });
});

// Update
router.post("/update_student", ensureAuthenticated, (req, res) => {
  let errors = [];
  const { _id, name, role, submitPage } = req.body;
  if (submitPage === "submited") {
    if (!_id || !name || !role) {
      errors.push({ msg: "Please enter all fields" });
    }
  } else {
    errors.push({ msg: "Please enter all fields" });
  }

  if (errors.length > 0) {
    req.flash("error_msg", "Please enter all fields");
    res.redirect(`/edit_student/${_id}`);
  } else {
    User.findByIdAndUpdate(_id, {
      name,
      role
    })
      .then(page => {
        req.flash("error_msg", "User has been updated");
        res.redirect("/students");
      })
      .catch(err => {
        if (err) {
          res.status(404).send("User not found.");
        }
      });
  }
});

//rooms admin page
router.get("/rooms", ensureAuthenticated, (req, res) => {
  let allRooms = Room.find()
    .sort({ _id: -1 })
    .then(rooms => {
      res.render("rooms", {
        user: req.user,
        rooms: rooms,
        data: req.session
      });
    })
    .catch(err => console.log(err));
});

router.get("/multiplayer", ensureAuthenticated, (req, res) => {
  if (req.query.roomId) {
    let roomId = req.query.roomId;

    let timer = req.query.min ? req.query.min : 0;
    let color = req.query.color ? req.query.color : "white";
    res.render("play", {
      user: req.user,
      roomId: roomId,
      timer: timer,
      color: color,
    });
  } else {
    let roomHash = Math.floor(Math.random() * 10000) + 1;
    let displayJoinLink = "false";
    let fullUrl =
      req.protocol +
      "://" +
      req.get("host") +
      "/multiplayer" +
      "?roomId=" +
      roomHash;

    let min = "";
    if (req.query.roomHash && req.query.submitPage) {
      displayJoinLink = "true";
      min = req.query.time;
    }
    res.render("multiplayer", {
      user: req.user,
      roomHash: roomHash,
      displayJoinLink: displayJoinLink,
      fullUrl: fullUrl, 
      min
    });
  }
});

router.get("/game", ensureAuthenticated, (req, res) => {
  // console.log(req.session.room);
  if (typeof req.session.room == "undefined") {
    req.flash("error_msg", "Wrong access key, please try again.");
    return res.redirect("/rooms");
  }
  // ALTER: WILL BE REMOVED LATER
  // req.session.userInfo = {
  //   role: "teacher", // teacher | student
  //   _id: "5dc4464e8265ae2312575778",
  //   name: "atif",
  //   email: "aatifbangash@gmail.com"
  // };

  // req.session.room = {
  //   _id: "5dcc248e91091b1321e2991c",
  //   name: "new",
  //   accessKey: "new"
  // };

  return res.render("game", {
    user: req.user,
    data: req.session
  });
});

router.get("/full", (req, res) => {
  res.render("full");
});

router.post("/upload", ensureAuthenticated, function(req, res) {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send("No files were uploaded.");
  }
  console.log(req.files);
  // The name of the input field (i.e. "sampleFile", default if "file") is used to retrieve the uploaded file
  let sampleFile = req.files.file;
  let picName = new Date().getTime();
  sampleFile.mv("./public/uploads/" + picName + ".jpg", function(err) {
    if (err) return res.status(500).send(err);

    let fullUrl =
      req.protocol + "://" + req.get("host") + "/uploads/" + picName + ".jpg";
    console.log(fullUrl, typeof fullUrl);
    res.json({ location: fullUrl });
  });
});
module.exports = router;
