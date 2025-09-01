import { Kafka } from "kafkajs";

const BROKERS = (process.env.KAFKA_BROKERS || "kafka:9092").split(",");
const TOPIC = process.env.TOPIC || "torneo";

async function main() {
  const kafka = new Kafka({ clientId: "tournament-consumer", brokers: BROKERS });
  const consumer = kafka.consumer({ groupId: "torneo-consumer" });

  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

  console.log(` Consumidor escuchando topic "${TOPIC}" en ${BROKERS.join(",")}`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      const val = message.value ? message.value.toString() : "";
      console.log("Mensaje recibido:", val);
    }
  });
}

main().catch(err => {
  console.error(" Error en consumer:", err);
  process.exit(1);
});
