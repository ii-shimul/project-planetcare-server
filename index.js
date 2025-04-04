require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
	res.send("Events loading...");
});

app.listen(port,() => {
  console.log(`Events coming in ${port}`);
})
