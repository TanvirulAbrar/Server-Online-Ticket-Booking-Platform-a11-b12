const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(express.json());
app.use(cors());

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    console.log("decoded in the token", decoded);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

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
    const revenueCollection = db.collection("revenues");

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }

      next();
    };
    const verifyVendor = async (req, res, next) => {
      const email = req.decoded_email;
      const query = { email };
      const user = await userCollection.findOne(query);

      if (!user || user.role !== "vendor") {
        return res.status(403).send({ message: "forbidden access" });
      }

      next();
    };

    //user
    app.get("/users", verifyFBToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      const cursor = await userCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/users/:id/role", verifyFBToken, async (req, res) => {
      const email = req.params.id;
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
    app.patch(
      "/users/:id/role",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
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
      }
    );
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
      //console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await bookedticketCollection.findOne(query);
      let user = {};

      if (result) {
        const email = result.email;
        user = await userCollection.findOne({ email });
      }
      if (user?.role === "fraud") {
        result.state = "hidden";
      }
      //console.log(result);
      res.send(result);
    });

    app.post("/booked-tickets", verifyFBToken, async (req, res) => {
      const newBookedTicket = req.body;

      newBookedTicket.createdAt = new Date();
      // const TicketId = newBookedTicket.TicketId;
      // const userExists = await bookedticketCollection.findOne({ TicketId });

      // if (userExists) {
      //   return res.send({ message: "ticket exist" });
      // }

      const result = await bookedticketCollection.insertOne(newBookedTicket);
      //console.log("book", result);
      res.send(result);
    });
    app.patch("/booked-tickets/:id", verifyFBToken, async (req, res) => {
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
    app.delete("/booked-tickets/:id", verifyFBToken, async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      //console.log("deleted", id);
      const result = await bookedticketCollection.deleteOne(query);

      res.send(result);
    });
    app.patch("/booked-tickets/:id/state", verifyFBToken, async (req, res) => {
      const id = req.params.id;
      const state = req.body.state;
      const query = { _id: new ObjectId(id) };
      //console.log(id);

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
    app.get("/payments", verifyFBToken, async (req, res) => {
      const customerEmail = req.query.email;
      const query = {};
      if (customerEmail) {
        query.customerEmail = customerEmail;
      }
      const cursor = await paymentCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.post("/payment-checkout-session", verifyFBToken, async (req, res) => {
      const ticketInfo = req.body;
      const amount = parseInt(ticketInfo.cost * 100);
      //console.log("got it");
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: {
                name: `please pay for: ${ticketInfo.title}`,
              },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        metadata: {
          ticketId: ticketInfo.ticketId,
          bookedTicketId: ticketInfo.bookedTicketId,
          quantity: ticketInfo.quantity,
          title: ticketInfo.title,
        },
        customer_email: ticketInfo.email,
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });

      res.send({ url: session.url });
    });
    app.patch("/payment-success", verifyFBToken, async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const amount = parseInt(session.amount_total / 100);

      const transactionId = session.payment_intent;
      // console.log("session retrieve --", session);
      //console.log("session retrieve --", session.payment_intent);

      const query = { transactionId: transactionId };

      const paymentExist = await paymentCollection.findOne(query);
      // console.log(session.metadata);
      if (paymentExist) {
        return res.send({
          message: "already exists",
          transactionId,
          trackingId: paymentExist._id,
          bookedTicketId: paymentExist.bookedTicketId,
        });
      }

      const trackingId = session.metadata.ticketId;
      const bookedTicketId = session.metadata.bookedTicketId;
      const ticketId = session.metadata.ticketId;
      const ticket = await ticketsCollection.findOne({
        _id: new ObjectId(ticketId),
      });
      const revenueData = await revenueCollection.findOne({
        email: ticket.email,
      });

      if (session.payment_status === "paid") {
        const id = session.metadata.bookedTicketId;
        const idb = session.metadata.ticketId;
        const query = { _id: new ObjectId(id) };
        const queryb = { _id: new ObjectId(idb) };
        const update = {
          $set: {
            state: "paid",
          },
        };
        const updateb = {
          $set: {
            quantity: Number(ticket.quantity - session.metadata.quantity),
            revenue: Number(ticket?.revenue) + Number(amount),
          },
        };

        // console.log(
        //   "recived 1",
        //   session.metadata.quantity,
        //   transactionId,
        //   paymentExist ? "true" : "false"
        // );
        const result = await bookedticketCollection.updateOne(query, update);
        const resultb = await ticketsCollection.updateOne(queryb, updateb);
        // console.log(amount);
        if (revenueData) {
          const revenueUpdate = {
            $set: {
              amount: Number(revenueData.amount + amount),
              quantity: Number(
                Number(revenueData.quantity) + Number(session.metadata.quantity)
              ),
              // revenue: Number(ticket?.revenue) + Number(amount),
            },
          };
          const revenueResult = await revenueCollection.updateOne(
            { email: ticket.email },
            revenueUpdate
          );
        } else {
          const newRevenue = {
            email: ticket.email,
            amount: amount,
            // ticketId: ticket._id,
            quantity: Number(session.metadata.quantity),
          };

          const revenueResult = await revenueCollection.insertOne(newRevenue);
        }

        const payment = {
          amount: amount,
          quantity: session.metadata.quantity,
          currency: session.currency,
          customerEmail: session.customer_email,
          ticketId: session.metadata.ticketId,
          title: session.metadata.title,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
          trackingId: trackingId,
        };

        const resultPayment = await paymentCollection.insertOne(payment);

        return res.send({
          success: true,
          modify: result,
          _id: trackingId,
          transactionId: session.payment_intent,
          paymentInfo: resultPayment,
        });
      }
      return res.send({ success: false });
    });

    // revenue
    app.get("/revenues", verifyFBToken, verifyVendor, async (req, res) => {
      // const state = req.query.state;
      const email = req.query.email;
      const query = {};
      // if (state) {
      //   query.state = state;
      // }
      if (email) {
        query.email = email;
      }

      const cursor = revenueCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // ticket
    app.get("/tickets", async (req, res) => {
      const state = req.query.state;
      const email = req.query.email;
      const from = req.query.from;
      const to = req.query.to;
      const advertise = req.query.advertise;
      const query = {};
      if (state) {
        query.state = state;
      }
      if (email) {
        query.email = email;
      }
      if (advertise) {
        query.advertise = advertise;
        // console.log("got it");
      }
      if (from && to) {
        query.$or = [
          { from: { $regex: from, $options: "i" } },
          { to: { $regex: to, $options: "i" } },
        ];
        // query.from = from;
        // query.to = to;
      }

      const cursor = ticketsCollection.find(query).sort({ createdAt: -1 });

      const result = await cursor.toArray();
      res.send(result);
    });
    app.get("/tickets/all/:id", async (req, res) => {
      const limit = 7;

      const id = Math.abs(req.params.id);

      console.log(req.query);
      const title = req.query.title;
      const transportType = req.query.transportType;
      const priceSort = req.query.price;
      // let price = 0;
      const state = req.query.state;
      const email = req.query.email;
      const from = req.query.from;
      const to = req.query.to;
      const advertise = req.query.advertise;
      const query = {};
      // console.log(price);
      const sort = {};

      if (priceSort) {
        if (priceSort === "high") {
          sort.price = -1;
        }
        if (priceSort === "low") {
          sort.price = 1;
        }
      }

      if (transportType) {
        query.transportType = transportType;
      }
      if (state) {
        query.state = state;
      }
      if (email) {
        query.email = email;
      }
      if (advertise) {
        query.advertise = advertise;
        // console.log("got it");
      }
      if (title) {
        query.$or = [{ title: { $regex: title, $options: "i" } }];
        // query.from = from;
        // query.to = to;
      }
      if (from && to) {
        query.$or = [
          { from: { $regex: from, $options: "i" } },
          { to: { $regex: to, $options: "i" } },
        ];
        // query.from = from;
        // query.to = to;
      }
      console.log(sort);
      console.log(query);

      const cursor = await ticketsCollection
        .find(query)
        .sort(sort)
        .skip(limit * id)
        .limit(limit);

      const result = await cursor.toArray();

      const cursorall = await ticketsCollection.find(query);
      const resultall = await cursorall.toArray();

      const pageNum = Math.round(resultall.length / limit);
      let pageArray = [];
      for (let i = 0; i < pageNum; i++) {
        pageArray.push(i + 1);
      }
      res.send({ tickets: result, pages: pageArray });
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
      console.log("tic", id);
      res.send(result);
    });
    app.post("/tickets", verifyFBToken, async (req, res) => {
      const ticket = req.body;

      ticket.state = "pending";
      ticket.createdAt = new Date();

      ticket.revenue = 0;

      const result = ticketsCollection.insertOne(ticket);
      // const result = await cursor.toArray();
      res.send(result);
    });

    // app.post("/tickets/all", verifyAdmin, verifyVendor, async (req, res) => {
    //   const ticketsArray = req.body;

    //   // Insert all the tickets at once
    //   const result = await ticketsCollection.insertMany(ticketsArray);

    //   res.status(201).send(result);
    // });

    // app.patch("/tickets", async (req, res) => {
    //   const id = req.params.id;
    //   const email = req.body.email;

    //   // const query = { _id: new ObjectId(id) };
    //   const update = {
    //     $set: { state: "approved" },
    //   };
    //   const result = await ticketsCollection.updateMany(
    //     { email: email },
    //     update
    //   );
    //   res.send(result);
    // });
    // app.patch("/tickets", async (req, res) => {
    //   const email = req.body.email;

    //   const update = {
    //     $set: {
    //       // state: "approved",
    //       revenue: 0,
    //     },
    //   };

    //   const result = await ticketsCollection.updateMany(
    //     { email: email },
    //     update
    //   );
    //   res.send(result);
    // });

    app.patch("/tickets/:id", verifyFBToken, verifyVendor, async (req, res) => {
      const id = req.params.id;
      const newTicket = req.body;

      const query = { _id: new ObjectId(id) };
      const update = {
        $set: newTicket,
      };
      const result = await ticketsCollection.updateOne(query, update);
      res.send(result);
    });

    app.patch(
      "/tickets/:id/admin",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const newTicket = req.body;
        const tickets = await ticketsCollection.find(newTicket);
        const ticketsArray = await tickets.toArray();
        if (ticketsArray.length >= 6) {
          return res.send({ message: "full" });
        }
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: newTicket,
        };
        const result = await ticketsCollection.updateOne(query, update);
        res.send(result);
      }
    );
    app.patch(
      "/tickets/:id/admin-state",
      verifyFBToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const newTicket = req.body;

        const query = { _id: new ObjectId(id) };
        const update = {
          $set: newTicket,
        };
        const result = await ticketsCollection.updateOne(query, update);
        res.send(result);
      }
    );
    app.delete(
      "/tickets/:id",
      verifyFBToken,
      verifyVendor,
      async (req, res) => {
        const id = req.params.id;
        // const newTicket = req.body;

        const query = { _id: new ObjectId(id) };
        // const update = {
        //   $set: newTicket,
        // };
        const result = await ticketsCollection.deleteOne(query);
        res.send(result);
      }
    );

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
