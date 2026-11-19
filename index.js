import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import Stripe from "stripe";

const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const client =
  new MongoClient(`mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@ac-khznulz-shard-00-00.prdzdmt.mongodb.net:27017,ac-khznulz-shard-00-01.prdzdmt.mongodb.net:27017,ac-khznulz-shard-00-02.prdzdmt.mongodb.net:27017/?ssl=true&replicaSet=atlas-12cy19-shard-0&authSource=admin
`);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
const connectClient = await connectToMongoDB();
const database = connectClient.db("hire-loopDB");

const usersCollection = database.collection("user");
const jobsCollection = database.collection("jobs");
const applicationCollection = database.collection("applications");
const paymentCollection = database.collection("payments");

app.get("/", async (req, res) => {
  res.send({ msg: "The hireloop is fine!" });
});

// users related apis:
app.get("/users", async (req, res) => {
  const result = await usersCollection.find({}).toArray();
  res.send(result);
  // console.log(result, "The all users is...");
});
app.get("/users/:id/premium", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await usersCollection.findOne(query, {
    projection: { premium: 1 },
  });
  res.send(result);
});
app.patch('/users/:id/role', async(req, res) => {
  const id = req.params.id;
  const query = {_id: new ObjectId(id)};
  const updateUserRole = {
    $set:{role: req.body.role}
  }
  const result = await usersCollection.updateOne(query, updateUserRole)
  res.send(result)
  console.log(result, 'the update user role data is')
})

// jobs related apis:
app.post("/jobs", async (req, res) => {
  const jobs = req.body;
  const result = await jobsCollection.insertOne(jobs);
  res.send(result);
  // console.log(result, "the job post data is...");
});
app.get("/jobs", async (req, res) => {
  const query = {};
  // console.log(req.query);

  if (req.query) {
    if (req.query.type) {
      query.type = req.query.type;
    }
    if (req.query.category) {
      query.category = req.query.category;
    }
    if (req.query.recruiterId) {
      query.recruiterId = req.query.recruiterId;
    }

    // Search filter
    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: "i" } },
        { category: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
        { requirements: { $regex: req.query.search, $options: "i" } },
      ];
    }
  }

  const result = await jobsCollection.find(query).toArray();
  res.send(result);
});
app.get("/jobs/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await jobsCollection.findOne(query);
  res.send(result);
  console.log(result, "job detail data");
});

// brows-jobs:id
app.get("/jobs/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await jobsCollection.findOne(query);
  res.send(result);
  // console.log(result, "job detail data");
});
app.delete("/jobs/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await jobsCollection.deleteOne(query);
  res.send(result);
});
app.patch("/jobs/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const updatedData = req.body;
  const result = await jobsCollection.updateOne(query, { $set: updatedData });
  res.send(result);
  console.log(result, "patch api");
});

// applications related apis:
app.post("/applications", async (req, res) => {
  const data = {
    ...req.body,
    status: "applied", // recruiter can change it later from the applications page
    dateApplied: new Date().toISOString(),
  };
  const result = await applicationCollection.insertOne(data);
  res.send(result);
});
app.get("/applications", async (req, res) => {
  const query = {};
  if (req.query.applicantId) {
    query.userId = req.query.applicantId;
  }
  // recruiter side: dashboard/recruiter/jobs/[jobId]/applications filters by job
  if (req.query.jobId) {
    query.jobId = req.query.jobId;
  }

  const result = await applicationCollection.find(query).toArray();
  res.send(result);
  // console.log(result);
});
// count related apis:user koyta job a apply korse setar count dekhabe
app.get("/applications/count", async (req, res) => {
  const query = {};
  if (req.query.applicantId) {
    query.userId = req.query.applicantId;
  }
  const result = await applicationCollection.countDocuments(query);
  res.send({ count: result });
  console.log(result);
});
app.patch('/applications/:id', async(req, res) => {
  const id = req.params.id
  const query = {_id: new ObjectId(id)};
  const updateStatus = {
    $set:{status: req.body.status}
  }
  const result = await applicationCollection.updateOne(query, updateStatus)
  res.send(result)

  console.log(result, 'update status', query, updateStatus)
})

// stripe related apis:
app.post("/payments/payment-verify", async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.send({ success: false, message: "Session id is required!" });
  }

  const { status, customer_email, metadata, payment_intent, payment_status } =
    await stripe.checkout.sessions.retrieve(sessionId);

  // 1: is used this session
  // 2: check is the session id for the currently logged in user
  // 3: insert sessionId into the paymentCollection
  // 4: update user information as premium user

  if (status === "complete" && payment_status === "paid") {
    // 1. Check duplicate payment
    const sessionQuery = { sessionId };
    const existingQuery = await paymentCollection.findOne(sessionQuery);
    if (existingQuery) {
      return res.send({ success: false, message: "Payment already verifyed" });
    }
    // 2. Create payment object
    const payment = {
      sessionId, // IMPORTANT: Save sessionId
      status,
      customer_email,
      metadata: {
        userId: metadata.userId,
      },
      payment_date: new Date(),
      payment_intent,
      payment_status,
    };
    // updated the userId
    // 4. Update user as premium
    const query = { _id: new ObjectId(metadata.userId) };

    const updatedDoc = {
      $set: { premium: true },
    };

    const updateResult = await usersCollection.updateOne(query, updatedDoc);

    // 3. Insert payment
    const result = await paymentCollection.insertOne(payment);

    res.send({ success: true, result, updateResult });
    return;
  }
  res.send({ success: false, message: "payment varification failed!" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
