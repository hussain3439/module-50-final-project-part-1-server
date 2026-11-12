import  express  from "express";
import  cors  from "cors";
import { MongoClient } from 'mongodb';
import "dotenv/config";


const PORT = process.env.PORT || 5000;

const app = express()

app.use(cors())
app.use(express.json());


const client = new MongoClient(`mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@ac-khznulz-shard-00-00.prdzdmt.mongodb.net:27017,ac-khznulz-shard-00-01.prdzdmt.mongodb.net:27017,ac-khznulz-shard-00-02.prdzdmt.mongodb.net:27017/?ssl=true&replicaSet=atlas-12cy19-shard-0&authSource=admin
`)


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
const database = connectClient.db('hire-loopDB');
const usersCollection = database.collection('user')

app.get('/', async(req, res) => {
    res.send({msg: 'The hireloop is fine!'})
})

app.get('/users', async(req, res) => {
    const result = await usersCollection.find({}).toArray();
    res.send(result)

    console.log(result, 'The all users is...');
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})