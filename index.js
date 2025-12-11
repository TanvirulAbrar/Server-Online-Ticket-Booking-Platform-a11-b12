const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const db = client.db("oticket");

    const userCollection = db.collection("users");
    const ticketsCollection = db.collection("tickets");
    const paymentCollection = db.collection("payments");

    //user
    app.get("/users", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      const result = await userCollection.findOne(query);
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      user.createdAt = new Date();
      const email = user.email;
      const userExists = await userCollection.findOne({ email });

      if (userExists) {
        return res.send({ message: "user exists" });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    //bookedticket
    app.post("/booked-tickets", async (req, res) => {
      const newBookedTicket = req.body;

      newBookedTicket.createdAt = new Date();
      const email = newBookedTicket.email;
      const userExists = await userCollection.findOne({ email });

      if (userExists) {
        return res.send({ message: "user exists" });
      }

      const result = await userCollection.insertOne(newBookedTicket);
      res.send(result);
    });

    //payments
    app.get("/payments", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      const cursor = await userCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // ticket
    app.get("/tickets", async (req, res) => {
      const cursor = ticketsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/tickets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log(id);
      const result = await ticketsCollection.findOne(query);
      res.send(result);
    });
    app.patch("/tickets/:id", async (req, res) => {
      const id = req.params.id;
      const newTicket = req.body;

      const query = { _id: new ObjectId(id) };
      const update = {
        $set: newTicket,
      };
      const result = await ticketsCollection.updateOne(query, update);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("hello!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
