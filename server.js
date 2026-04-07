const express = require("express");
const { CosmosClient } = require("@azure/cosmos");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// 🔐 Environment variables
const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

if (!endpoint || !key) {
    console.error("❌ Cosmos DB env variables missing");
}

const client = new CosmosClient({ endpoint, key });
const database = client.database("EventDB");

// Containers
const container = database.container("Registrations");
const eventsContainer = database.container("Events");

// ✅ Test route
app.get("/", (req, res) => {
    res.send("Backend is working ✅");
});

// ✅ Get all events
app.get("/events", async (req, res) => {
    try {
        const { resources } = await eventsContainer.items.readAll().fetchAll();

        const formatted = resources.map(item => ({
            id: item.eventId || item.id,
            eventId: item.eventId,
            name: item.eventName,
        }));

        res.send(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// ✅ Get registrations
app.get("/registrations", async (req, res) => {
    try {
        const { resources } = await container.items.readAll().fetchAll();
        res.send(resources);
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// ✅ Register user
app.post("/register", async (req, res) => {
    try {
        let data = req.body;

        const eventQuery = {
            query: "SELECT * FROM c WHERE c.eventId = @eventId",
            parameters: [{ name: "@eventId", value: data.eventId }]
        };

        const { resources: eventData } = await eventsContainer.items.query(eventQuery).fetchAll();

        if (eventData.length === 0) {
            return res.status(400).send("Invalid Event ❌");
        }

        const event = eventData[0];
        data.eventName = event.eventName;

        const duplicateQuery = {
            query: "SELECT * FROM c WHERE c.email = @email AND c.eventId = @eventId",
            parameters: [
                { name: "@email", value: data.email },
                { name: "@eventId", value: data.eventId }
            ]
        };

        const { resources: duplicates } = await container.items.query(duplicateQuery).fetchAll();

        if (duplicates.length > 0) {
            return res.status(409).send("Already registered ❌");
        }

        await container.items.create(data);

        res.send("Registered Successfully ✅");

    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

// ✅ PORT (IMPORTANT for deployment)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});