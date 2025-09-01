import { Kafka, logLevel } from 'kafkajs';

const brokers = (process.env.KAFKA_BROKERS || 'kafka:9092').split(',');

export const kafka = new Kafka({
  clientId: 'tournament-api',
  brokers,
  logLevel: logLevel.NOTHING,
});

export const producer = kafka.producer();

export async function connectKafka() {
  await producer.connect();
}

export async function sendToKafka(topic: string, payload: unknown) {
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(payload) }],
  });
}
