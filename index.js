const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

let app = express();
app.use(cors());
app.use(express.json());

const { DATABASE_URL } = import.meta.env.VITE_DATABASE_URL;

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

async function getPostgresVersion() {
    const client = await pool.connect();
    try {
        const res = await client.query("SELECT version()");
        console.log(res.rows[0]);
    } catch (error) {
        console.error("Error", error.message);
    }
}

getPostgresVersion();

//fetch all room types
app.get("/roomtypes", async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query("SELECT * FROM rooms");
        res.json({
            status: "success",
            data: result.rows,
            message: "All rooms fetched successfully",
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: error.message });
    } finally {
        client.release();
    }
});

//create new booking
app.post("/bookings", async (req, res) => {
    const {
        title,
        description,
        date,
        start_time,
        duration,
        phone_number,
        user_email,
        room_id,
    } = req.body;
    const client = await pool.connect();

    try {
        if (
            title &&
            description &&
            date &&
            start_time &&
            duration &&
            phone_number &&
            user_email &&
            room_id
        ) {
            const result = await client.query(
                "INSERT INTO bookings (title, description, date, start_time, end_time, duration, phone_number, user_email, room_id) VALUES ($1, $2, DATE($3), $4, $5 + ($6 || ' hours')::INTERVAL, $7, $8, $9, $10) RETURNING *",
                [
                    title,
                    description,
                    date,
                    start_time,
                    start_time,
                    duration,
                    duration,
                    phone_number,
                    user_email,
                    room_id,
                ],
            );
            res.json({
                status: "success",
                data: result.rows[0],
                message: "New booking added successfully",
            });
        } else {
            res.json({
                status: "failed",
                message: "All fields are required",
            });
        }
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: error.message });
    } finally {
        client.release();
    }
});

//get upcoming bookings
app.post("/bookings/upcoming", async (req, res) => {
    const client = await pool.connect();
    const { user_email } = req.body;

    try {
        const result = await client.query(
            "SELECT bookings.id, bookings.title, bookings.description, bookings.date, bookings.start_time, bookings.end_time, bookings.user_email, bookings.phone_number, rooms.type FROM bookings INNER JOIN rooms ON bookings.room_id = rooms.id WHERE bookings.user_email = $1 AND bookings.date >= CURRENT_DATE",
            [user_email],
        );

        if (result.rows.length > 0) {
            res.json({
                status: "success",
                data: result.rows,
                message: "Bookings fetched successfully",
            });
        } else {
            res.json({
                status: "failed",
                message: "There are no upcoming bookings",
            });
        }
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    } finally {
        client.release();
    }
});

//get all bookings by user email
app.get("/bookings/:user_email", async (req, res) => {
    const client = await pool.connect();
    const { user_email } = req.params;
    try {
        const result = await client.query(
            "SELECT bookings.id, bookings.title, bookings.description, bookings.date, bookings.start_time, bookings.end_time, bookings.user_email, bookings.phone_number, rooms.type FROM bookings INNER JOIN rooms ON bookings.room_id = rooms.id WHERE bookings.user_email = $1",
            [user_email],
        );

        if (result.rows.length > 0) {
            res.json({
                status: "success",
                data: result.rows,
                message: "Bookings fetched successfully",
            });
        } else {
            res.json({
                status: "failed",
                message: "There are no bookings",
            });
        }
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    } finally {
        client.release();
    }
});

//delete booking
app.delete("/bookings/:id", async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        const result = await client.query("DELETE FROM bookings WHERE id = $1", [
            id,
        ]);
        res.json({
            status: "success",
            message: "Booking deleted successfully",
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    } finally {
        client.release();
    }
});

//update booking information
app.put("/bookings/:id", async (req, res) => {
    const { id } = req.params;
    const { start_time, duration, date } = req.body;
    const client = await pool.connect();

    try {
        const result = await client.query(
            "UPDATE bookings SET start_time = $1, duration = $2, date = DATE($3), end_time = $4 + ($5 || ' hours')::INTERVAL WHERE id = $6",
            [start_time, duration, date, start_time, duration, id],
        );
        res.json({
            status: "success",
            message: "Booking updated successfully",
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: error.message });
    } finally {
        client.release();
    }
});

//filtered bookings by date
app.get("/bookings/:date/:email", async (req, res) => {
    const { date, email } = req.params;
    const client = await pool.connect();

    try {
        const result = await client.query(
            `SELECT bookings.id, bookings.title, bookings.description, bookings.date, bookings.start_time, bookings.end_time, bookings.user_email, bookings.phone_number, rooms.type FROM bookings INNER JOIN rooms ON bookings.room_id = rooms.id WHERE bookings.date = $1 AND user_email = $2`,
            [date, email],
        );
        if (result.rows.length > 0) {
            res.json({
                status: "success",
                data: result.rows,
                message: "Bookings fetched successfully",
            });
        } else {
            res.json({
                status: 'failed',
                message: "No bookings found"
            });
        }
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.get("/", (req, res) => {
    res.send("Welcome to the Coworking space bookings API!");
});

app.listen(5000, () => {
    console.log("Express server initialized.");
});
