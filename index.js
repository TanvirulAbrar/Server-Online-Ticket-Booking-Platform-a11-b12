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
    const bookedticketCollection = db.collection("bookedticket");
    const paymentCollection = db.collection("payments");

    //user
    app.get("/users", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      const cursor = await userCollection.find(query);
      const result = await cursor.toArray();
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
    app.patch("/users/:id/role", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const user = req.body;
      // console.log("hited user");
      const update = { $set: user };
      if (user?.role === "fraud") {
        await bookedticketCollection.updateMany(
          { createdBy: user.email },
          { $set: { state: "hidden" } }
        );

        await ticketsCollection.updateMany(
          { email: user.email },
          { $set: { state: "hidden" } }
        );
      } else {
        await bookedticketCollection.updateMany(
          { createdBy: user.email },
          { $set: { state: "pending" } }
        );

        await ticketsCollection.updateMany(
          { email: user.email },
          { $set: { state: "pending" } }
        );
      }

      const result = await userCollection.updateOne(query, update);
      res.send(result);
    });
    //bookedticket
    app.get("/booked-tickets", async (req, res) => {
      const TicketId = req.query.TicketId;
      const email = req.query.email;
      const createdBy = req.query.createdBy;
      const query = {};
      if (TicketId) {
        query.TicketId = TicketId;
      }
      if (email) {
        query.email = email;
      }
      if (createdBy) {
        query.createdBy = createdBy;
      }

      const cursor = await bookedticketCollection.find({
        ...query,
        state: { $ne: "hidden" },
      });
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/booked-tickets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log(id);
      const result = await bookedticketCollection.findOne(query);
      let user = {};

      if (result) {
        const email = result.email;
        user = await userCollection.findOne({ email });
      }
      if (user?.role === "fraud") {
        result.state = "hidden";
      }
      console.log(result);
      res.send(result);
    });

    app.post("/booked-tickets", async (req, res) => {
      const newBookedTicket = req.body;

      newBookedTicket.createdAt = new Date();
      // const TicketId = newBookedTicket.TicketId;
      // const userExists = await bookedticketCollection.findOne({ TicketId });

      // if (userExists) {
      //   return res.send({ message: "ticket exist" });
      // }

      const result = await bookedticketCollection.insertOne(newBookedTicket);
      console.log("book", result);
      res.send(result);
    });
    app.patch("/booked-tickets/:id", async (req, res) => {
      const id = req.params.id;
      const newBookedTicket = req.body;
      newBookedTicket.createdAt = new Date();

      const query = { _id: new ObjectId(id) };
      const update = {
        $set: newBookedTicket,
      };
      const result = await bookedticketCollection.updateOne(query, update);
      res.send(result);
    });
    app.delete("/booked-tickets/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      console.log("deleted", id);
      const result = await bookedticketCollection.deleteOne(query);

      res.send(result);
    });
    app.patch("/booked-tickets/:id/state", async (req, res) => {
      const id = req.params.id;
      const state = req.body.state;
      const query = { _id: new ObjectId(id) };
      console.log(id);

      const updateBookedTicket = {
        $set: {
          state: state,
        },
      };
      const result = await bookedticketCollection.updateOne(
        query,
        updateBookedTicket
      );

      // console.log(bookedticket);
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
      const state = req.query.state;
      const email = req.query.email;
      const query = {};
      if (state) {
        query.state = state;
      }
      if (email) {
        query.email = email;
      }

      const cursor = ticketsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/tickets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      // console.log(id);
      const result = await ticketsCollection.findOne(query);
      let user = {};

      if (result) {
        const email = result.email;
        user = await userCollection.findOne({ email });
      }
      if (user?.role === "fraud") {
        result.state = "hidden";
      }
      // console.log("tic", result);
      // console.log("tic", id);
      res.send(result);
    });
    app.post("/tickets", async (req, res) => {
      const ticket = req.body;

      ticket.state = "pending";

      const result = ticketsCollection.insertOne(ticket);
      // const result = await cursor.toArray();
      res.send(result);
    });
    app.patch("/tickets", async (req, res) => {
      const id = req.params.id;
      const email = req.body.email;

      // const query = { _id: new ObjectId(id) };
      const update = {
        $set: { state: "approved" },
      };
      const result = await ticketsCollection.updateMany(
        { email: email },
        update
      );
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
    app.delete("/tickets/:id", async (req, res) => {
      const id = req.params.id;
      // const newTicket = req.body;

      const query = { _id: new ObjectId(id) };
      // const update = {
      //   $set: newTicket,
      // };
      const result = await ticketsCollection.deleteOne(query);
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
