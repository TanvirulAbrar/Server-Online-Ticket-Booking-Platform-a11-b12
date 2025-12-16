const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;
const stripe = require("stripe")(process.env.STRIPE_SECRET);

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
    const revenueCollection = db.collection("revenues");

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

    app.post("/booked-tickets", async (req, res) => {
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
      //console.log("deleted", id);
      const result = await bookedticketCollection.deleteOne(query);

      res.send(result);
    });
    app.patch("/booked-tickets/:id/state", async (req, res) => {
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
    app.get("/payments", async (req, res) => {
      const customerEmail = req.query.email;
      const query = {};
      if (customerEmail) {
        query.customerEmail = customerEmail;
      }
      const cursor = await paymentCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    app.post("/payment-checkout-session", async (req, res) => {
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
    app.patch("/payment-success", async (req, res) => {
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
    app.get("/revenues", async (req, res) => {
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
      ticket.revenue = 0;

      const result = ticketsCollection.insertOne(ticket);
      // const result = await cursor.toArray();
      res.send(result);
    });

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
    app.patch("/tickets", async (req, res) => {
      const email = req.body.email;

      const update = {
        $set: {
          // state: "approved",
          revenue: 0,
        },
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
