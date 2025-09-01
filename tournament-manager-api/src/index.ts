import express from "express";
import mongoose, { model, Schema } from "mongoose";
import { Kafka, logLevel } from "kafkajs";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/tournament_designer";
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "kafka:9092").split(",");

// ---------- middlewares ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(function (_req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type,Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});

// ---------- Mongo (tu mismo esquema) ----------
const tournamentSchema = new Schema(
  {
    title: { type: String, required: true },
    type: { type: String, required: true },
    roster: [
      {
        id: { type: Number, required: true },
        name: { type: String, required: true },
        weight: { type: Number, required: true },
        age: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true, collection: "tournaments" }
);
const Tournament = model("Tournament", tournamentSchema);

// ---------- Kafka ----------
const kafka = new Kafka({
  clientId: "tournament-api",
  brokers: KAFKA_BROKERS,
  logLevel: logLevel.NOTHING,
});
const producer = kafka.producer();

/** Intenta conectar a Kafka con reintentos (para no matar la API si Kafka tarda) */
async function connectKafkaWithRetry(maxRetries = 10) {
  let attempt = 0;
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  while (attempt < maxRetries) {
    try {
      await producer.connect();
      console.log("✅ Producer Kafka listo (brokers:", KAFKA_BROKERS.join(","), ")");
      return;
    } catch (e) {
      attempt++;
      const waitMs = Math.min(5000, 500 * attempt); // backoff simple
      console.warn(`⚠️  No se pudo conectar a Kafka (intento ${attempt}/${maxRetries}). Reintentando en ${waitMs}ms...`);
      await delay(waitMs);
    }
  }
  console.warn("⚠️  No se logró conectar a Kafka. La API seguirá funcionando; los POST intentarán publicar y si falla, solo guardarán en Mongo.");
}

// ---------- Rutas existentes ----------
app.post("/upload-data", async (req, res) => {
  const data = req.body;
  console.log("Data received:", data);
  await Tournament.insertMany(req.body);
  res.status(201).json({ message: `Inserted ${req.body.length} tournaments!` });
});

app.get("/fetch-tournaments", async (_req, res) => {
  const tournaments = await Tournament.find();
  res.status(200).json(tournaments);
});

app.get("/", (_req, res) => {
  res.json({ message: "Tournament Designer API is running!" });
});

// ---------- NUEVO: POST /registrar ----------
app.post("/registrar", async (req, res) => {
  try {
    const { title, type, roster } = req.body || {};
    if (!title || !type || !Array.isArray(roster)) {
      return res.status(400).json({ error: "Faltan campos: title, type, roster[]" });
    }

    // 1) Guardar en Mongo
    const doc = await Tournament.create({ title, type, roster });

    // 2) Publicar el mismo registro en Kafka (si el producer ya está conectado)
    try {
      await producer.send({
        topic: "torneo",
        messages: [{ value: JSON.stringify(doc.toObject()) }],
      });
    } catch (e) {
      console.warn("⚠️  No se pudo publicar en Kafka en este momento. Se guardó en Mongo igual.");
    }

    return res.status(201).json({ ok: true, data: doc });
  } catch (err: any) {
    console.error("Error en /registrar:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- Bootstrap ----------
async function start() {
  try {
    // Mongo
    await mongoose.connect(MONGO_URI);
    console.log("✅ Conectado a MongoDB");

    // Kafka (no detiene la app si falla)
    connectKafkaWithRetry();

    // Server
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ Error al iniciar:", err);
    process.exit(1);
  }
}
start();
