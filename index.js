const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
const dotenv = require('dotenv');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

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
    },
    readPreference: 'primary'
});

const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
)

const verifyToken = async (req, res, next) => {
    const authHeader = req?.headers.authorization
    if (!authHeader) {
        return res.status(401).json({ message: 'Unauthorized' })
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' })
    }

    try {
        const { payload } = await jwtVerify(token, JWKS)
        console.log(payload)
        next()
    } catch (error) {
        return res.status(403).json({ message: 'Forbidden' })
    }
};

async function run() {
    try {

        const db = client.db('Drive-Fleet')
        const carCollection = db.collection('cars')
        const bookingCollection = db.collection('bookings')

        app.get('/cars', async (req, res) => {
            const result = await carCollection.find().toArray()
            res.json(result)
        })

        app.post('/car', async (req, res) => {
            const carDataWithUser = req.body
            const result = await carCollection.insertOne(carDataWithUser)

            const newCar = await carCollection.findOne({ _id: result.insertedId })
            res.json(newCar)
        })

        app.get('/cars/:id', verifyToken, async (req, res) => {
            const { id } = req.params
            const result = await carCollection.findOne({ _id: new ObjectId(id) })
            res.json(result)
        })

        app.patch('/car/:id', verifyToken, async (req, res) => {
            const { id } = req.params
            const updatedData = req.body

            const result = await carCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updatedData }
            )

            res.json(result)
        });

        app.delete('/car/:id', verifyToken, async (req, res) => {
            const { id } = req.params
            const result = await carCollection.deleteOne({ _id: new ObjectId(id) })
            res.json(result)
        })

        // =========================
        // BOOKING CREATE (FIXED SAFE)
        // =========================
        app.post('/booking', verifyToken, async (req, res) => {
            const bookingData = req.body;

            // 3. car exist check (FIX)
            const car = await carCollection.findOne({
                _id: new ObjectId(bookingData.carId)
            });

            if (!car) {
                return res.status(404).json({ message: "Car not found" });
            }

            // 1. insert booking
            const result = await bookingCollection.insertOne(bookingData);

            // 2. increase booking count in car
            await carCollection.updateOne(
                { _id: new ObjectId(bookingData.carId) },
                {
                    $inc: { booking_count: 1 }
                }
            );

            res.json(result);
        });

        app.get('/booking/:userId', verifyToken, async (req, res) => {
            const { userId } = req.params;
            const result = await bookingCollection.find({ userId }).toArray();
            res.json(result);
        });

        app.get('/cars/user/:userId', verifyToken, async (req, res) => {
            const { userId } = req.params;
            const result = await carCollection.find({ addedBy: userId }).toArray();
            res.json(result);
        });

        // =========================
        // DELETE BOOKING (FIXED SAFE)
        // =========================
        app.delete('/booking/:bookingId', verifyToken, async (req, res) => {
            const { bookingId } = req.params;

            const booking = await bookingCollection.findOne({
                _id: new ObjectId(bookingId)
            });

            if (!booking) {
                return res.status(404).json({ message: 'Booking not found' });
            }

            // 2. delete booking (FIXED await)
            const result = await bookingCollection.deleteOne({
                _id: new ObjectId(bookingId)
            });

            // 3. decrease booking count safely (NO negative)
            await carCollection.updateOne(
                {
                    _id: new ObjectId(booking.carId),
                    booking_count: { $gt: 0 }
                },
                {
                    $inc: { booking_count: -1 }
                }
            );

            res.json(result);
        });

        console.log("MongoDB Connected Successfully!");

    } finally {
        // keep connection open
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Server is running Fine !')
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})