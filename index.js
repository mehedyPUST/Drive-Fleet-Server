const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
const dotenv = require('dotenv')
dotenv.config()
const uri = process.env.MONGODB_URI;
const app = express();
const PORT = process.env.PORT;
app.use(cors())
app.use(express.json())




const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const db = client.db('Drive-Fleet')
        const carCollection = db.collection('cars')

        app.get('/cars', async (req, res) => {
            const result = await carCollection.find().toArray()
            res.json(result)
        })

        app.post('/car', async (req, res) => {
            const carData = req.body
            const result = carCollection.insertOne(carData)
            res.json(result)
        })


        app.get('/cars/:id', async (req, res) => {
            const { id } = req.params
            const result = await carCollection.findOne({ _id: new ObjectId(id) })
            res.json(result)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);






app.get('/', (req, res) => {
    res.send('Server is running Fine !')
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})