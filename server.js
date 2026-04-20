const express = require("express");
const cors = require("cors");
const { CosmosClient } = require("@azure/cosmos");

const app = express();

// ✅ MIDDLEWARE (correct order)
app.use(cors({
    origin: "*"
}));
app.use(express.json());

// 🔐 Environment variables
const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

if (!endpoint || !key) {
    console.error("❌ Cosmos DB env variables missing");
}

// ✅ Cosmos DB connection
const client = new CosmosClient({ endpoint, key });
const database = client.database("EventDB");

// Containers
const container = database.container("Registrations");
const eventsContainer = database.container("Events");

// ================= ROUTES =================

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
            date: item.date || "TBD",
            location: item.location || "TBD"
        }));

        res.send(formatted);
    } catch (err) {
        console.error("❌ Events Error:", err);
        res.status(500).send(err.message);
    }
});

// ✅ Get registrations
app.get("/registrations", async (req, res) => {
    try {
        const { resources } = await container.items.readAll().fetchAll();
        res.send(resources);
    } catch (err) {
        console.error("❌ Registration Fetch Error:", err);
        res.status(500).send(err.message);
    }
});

// ✅ Register user
app.post("/register", async (req, res) => {
    try {
        let data = req.body;

        // 🔍 Get event details
        const eventQuery = {
            query: "SELECT * FROM c WHERE c.eventId = @eventId",
            parameters: [{ name: "@eventId", value: data.eventId }]
        };

        const { resources: eventData } = await eventsContainer.items
            .query(eventQuery)
            .fetchAll();

        if (eventData.length === 0) {
            return res.status(400).send("Invalid Event ❌");
        }

        const event = eventData[0];

        // ✅ FIX: Store eventName properly
        data.eventName = event.eventName;

        // 🔁 Check duplicate
        const duplicateQuery = {
            query: "SELECT * FROM c WHERE c.email = @email AND c.eventId = @eventId",
            parameters: [
                { name: "@email", value: data.email },
                { name: "@eventId", value: data.eventId }
            ]
        };

        const { resources: duplicates } = await container.items
            .query(duplicateQuery)
            .fetchAll();

        if (duplicates.length > 0) {
            return res.status(409).send("Already registered ❌");
        }

        // ✅ Ensure ID exists
        data.id = Date.now().toString();

        await container.items.create(data);

        res.send("Registered Successfully ✅");

    } catch (err) {
        console.error("❌ Register Error:", err);
        res.status(500).send(err.message);
    }
});

// ================= SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});