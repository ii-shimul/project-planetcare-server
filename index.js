require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;


// middlewares
app.use(
	cors({
		origin: [
			"http://localhost:5173",
		],
		credentials: true,
	})
);
app.use(express.json());
app.use(cookieParser());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `${process.env.MONGODB_URI}`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
    const database = client.db("PlanetCare");
    const userCollection = database.collection("users");

		// jwt
		app.post("/jwt", (req, res) => {
			const user = req.body;
			const token = jwt.sign(user, process.env.ACCESS_SECRET_KEY, {
				expiresIn: "1d",
			});
			res.send({ token });
		});

		app.post("/logout", (req, res) => {
			res
				.clearCookie("token", {
					httpOnly: true,
					secure: process.env.NODE_ENV === "production",
					sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
				})
				.send("Cookie is cleared");
		});

		//! middlewares
		const verifyToken = (req, res, next) => {
			if (!req.headers.authorization) {
				return res.status(401).send("Unauthorized access");
			}

			const token = req.headers.authorization.split(" ")[1];

			jwt.verify(token, process.env.ACCESS_SECRET_KEY, (err, decoded) => {
				if (err) {
					return res.status(401).send("Unauthorized access");
				}
				req.decoded = decoded;
				next();
			});
		};

		const verifyAdmin = async (req, res, next) => {
			const email = req.decoded.email;
			const query = { email: email };
			const user = await userCollection.findOne(query);
			const isAdmin = user?.role === "admin";
			if (!isAdmin) {
				return res.status(403).send({ message: "forbidden access" });
			}
			next();
		};

		//! payments api
		app.post("/create-payment-intent", async (req, res) => {
			const { price } = req.body;
			const amount = parseInt(price) * 100;
			const paymentIntent = await stripe.paymentIntents.create({
				amount: amount,
				currency: "bdt",
				payment_method_types: ["card"],
			});
			res.send({
				clientSecret: paymentIntent.client_secret,
			});
		});


		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// await client.close();
	}
}
run().catch(console.dir);

app.get("/", (req, res) => {
	res.send("Events loading...");
});

app.listen(port, () => {
	console.log(`Events coming in ${port}`);
});
