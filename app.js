const express = require("express");
const fileUpload = require("express-fileupload");
const expressLayouts = require("express-ejs-layouts");
const mongoose = require("mongoose");
const passport = require("passport");
const flash = require("connect-flash");
const session = require("express-session");

const app = express();
const server = require("http").createServer(app);
let io = require("socket.io")(server);

// Passport Config
require("./config/passport")(passport);

// DB Config
const db = require("./config/keys").mongoURI;

// Connect to MongoDB
mongoose.set("useFindAndModify", false);
mongoose
  .connect(db, { useUnifiedTopology: true, useNewUrlParser: true })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// EJS
app.use(expressLayouts);
app.set("view engine", "ejs");

//set static
app.use(express.static(__dirname + "/public"));

// Express body parser
app.use(express.urlencoded({ extended: true }));

app.use(fileUpload({})); // file upload option

// Express session
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Connect flash
app.use(flash());

// Global variables
app.use(async function(req, res, next) {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");

  // global menu pages
  const Page = require("./models/Page");
  let allPages = await Page.find({ menu: "Yes", status: "Active" });
  const pagesMenuObj = [];
  allPages.forEach((p, i) => {
    pagesMenuObj.push({
      title: p.title,
      slug: p.slug
    });
  });
  res.locals.pageMenu = pagesMenuObj;

  next();
});

// Routes
app.use("/", require("./routes/index.js"));
app.use("/users", require("./routes/users.js"));
app.use("/pages", require("./routes/pages.js"));
app.use("/rooms", require("./routes/rooms.js"));

require("./socket/socket")(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, console.log(`Server started on port ${PORT}`));
