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
		origin: ["http://localhost:5173", "https://planetcare-bd.web.app"],
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
		const eventsCollection = database.collection("events");
		const donationsCollections = database.collection("donations");

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

		// ! events api

		// get all events
		app.get("/events", async (req, res) => {
			const result = await eventsCollection.find().toArray();
			res.send(result);
		});

		// get one event
		app.get("/events/:id", async (req, res) => {
			try {
				const { id } = req.params;
				const result = await eventsCollection.findOne({
					_id: new ObjectId(id),
				});
				if (!result) {
					return res.status(404).send({ message: "Event not found" });
				}
				res.send(result);
			} catch (error) {
				res
					.status(500)
					.send({ message: "Internal Server Error", error: error.message });
			}
		});

		// add user email to the volunteers array
		app.patch("/events/volunteer/:id", async (req, res) => {
			const { id } = req.params;
			const { email } = req.body;
			const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
			// check if the email is already in the volunteers array
			if (event.volunteers.includes(email)) {
				return res.status(400).send({ message: "You are already a volunteer" });
			}
			const result = await eventsCollection.updateOne(
				{ _id: new ObjectId(id) },
				{ $push: { volunteers: email } }
			);
			res.send(result);
		});

		// get all events a user volunteered for
		app.get("/events/volunteered/:email", async (req, res) => {
			const { email } = req.params;
			const events = await eventsCollection
				.find({ volunteers: email })
				.toArray();
			res.send(events);
		});

		// ! users api

		// create user
		app.post("/users", async (req, res) => {
			const user = req.body;
			const isNew = await userCollection.findOne({ email: user.email });
			if (!isNew) {
				const result = await userCollection.insertOne(user);
				res.send(result);
			} else {
				res.send({ message: "User already exists!", insertedId: null });
			}
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

		//! donations api

		// create payment intent
		app.post("/create-payment-intent", async (req, res) => {
			const { amount } = req.body;
			const amountInt = parseInt(amount) * 100;
			const paymentIntent = await stripe.paymentIntents.create({
				amount: amountInt,
				currency: "bdt",
				payment_method_types: ["card"],
			});
			res.send({
				clientSecret: paymentIntent.client_secret,
			});
		});

		// add donation data
		app.post("/donations", async (req, res) => {
			const donation = req.body;
			const result = await donationsCollections.insertOne(donation);
			res.send(result);
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
