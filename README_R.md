

# Tournament Manager – API + Kafka Consumer

API en Node/Express/TypeScript que guarda torneos en MongoDB y publica el mismo registro en Kafka 
Un Job consumidor (otro contenedor) lee desde torneo e imprime el mensaje en consola.

# Requisitos

- Docker Desktop (con Docker Compose v2)
- Puertos usados: 3000 (API), 27017 (Mongo), 9092 (Kafka)

# Estructura principal
tournament-manager-api/
├─ consumer/                  # Job Node que consume desde Kafka
│  ├─ Dockerfile
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ src
|       └─ /index.ts
├─ src/                       # API
│  ├─ models/Tournament.ts
│  ├─ routes/registrar.ts     # (si usas rutas separadas)
│  ├─ kafka.ts                # (si usas cliente separado)
│  └─ index.ts                # punto de entrada (POST /registrar)
├─ docker-compose.yml
├─ Dockerfile
├─ package.json
└─ tsconfig.json

# ¿Qué servicios levanta docker-compose.yml?

- mongo → base de datos MongoDB (DB: tournament_designer)

- kafka → broker Kafka (Bitnami + KRaft, listener PLAINTEXT 9092)

- api → Express en Node/TS (puerto 3000)

- consumer → Job Node/TS que lee tópico torneo e imprime en consola

La API depende de que kafka esté healthy y mongo iniciado.

# Variables de entorno (compose)

MONGO_URI=mongodb://mongo:27017/tournament_designer

KAFKA_BROKERS=kafka:9092

PORT=3000

# Levantar el proyecto

# 1) Navega al proyecto
cd C:\ProyectosBases\tournament-manager\tournament-manager-api

# 2) Construir e iniciar servicios
docker compose up -d --build

# 3) Ver estado
docker compose ps

-> Deberías ver mongo, kafka, api y consumer Up.

# Puedes verificar logs en vivo:

docker compose logs -f kafka
docker compose logs -f api
docker compose logs -f consumer

Endpoints principales
GET / -> Verifica que la API esté arriba.

curl http://localhost:3000/

POST /registrar -> Guarda un torneo en Mongo y publica el mismo JSON en Kafka (tópico torneo).

# Ejemplo con curl (PowerShell)

Usa comillas simples para evitar problemas de escape en Windows.

curl -X POST http://localhost:3000/registrar `
  -H "Content-Type: application/json" `
  -d '{"title":"Liga TEC","type":"single","roster":[{"id":1,"name":"Ana","weight":60,"age":21}]}'


# Respuesta esperada (201):

{
  "ok": true,
  "data": {
    "_id": "...",
    "title": "Liga TEC",
    "type": "single",
    "roster": [{ "id": 1, "name": "Ana", "weight": 60, "age": 21, "_id": "..." }],
    "createdAt": "...",
    "updatedAt": "...",
    "__v": 0
  }
}

# GET /fetch-tournaments

-> Lista los torneos guardados.

curl http://localhost:3000/fetch-tournaments

# ¿Cómo veo el mensaje consumido?

El consumer imprime en sus logs cada mensaje recibido de torneo.

docker compose logs -f consumer


Deberías ver líneas como:

Mensaje recibido: {"_id":"...","title":"Liga TEC","type":"single","roster":[...], ...}

Consultar Mongo (opcional)

Abre Terminal del contenedor tournament-designer-db (desde Docker Desktop) y ejecuta:

mongosh --quiet --eval "db.getSiblingDB('tournament_designer').tournaments.countDocuments()"
mongosh --quiet --eval "db.getSiblingDB('tournament_designer').tournaments.find().pretty()"

Desarrollo local (hot reload de la API)

La API corre con ts-node-dev dentro del contenedor, por lo que los cambios en src/ se recargan solos.

Reiniciar solo la API:

docker compose restart api

# Troubleshooting

1) curl: (52) Empty reply from server

La API no respondió. Mira logs:

docker compose logs -f api


Verifica que responda el root:

curl -v http://localhost:3000/

2) KafkaJSConnectionError / ECONNREFUSED kafka:9092

Kafka aún no estaba listo. El compose usa healthcheck; si pasa, reinicia solo la API:

docker compose restart api

3) UNKNOWN_TOPIC_OR_PARTITION / group coordinator is not available

Mensajes transitorios al iniciar Kafka/consumer.

Si persiste, crea explícitamente el tópico en el contenedor kafka:

kafka-topics.sh --bootstrap-server localhost:9092 --create --topic torneo --partitions 1 --replication-factor 1


Luego reinicia el consumidor:

docker compose restart consumer

4) PowerShell y JSON

En Windows, usa comillas simples alrededor del JSON o un archivo body.json:

curl -X POST http://localhost:3000/registrar -H "Content-Type: application/json" -d "@body.json"

5) Ver/seguir logs
docker compose logs -f kafka
docker compose logs -f api
docker compose logs -f consumer

Apagar todo
docker compose down

Notas técnicas (para la entrega)

API: Express + TypeScript. Conexión a Mongo por Mongoose.
POST /registrar:

Inserta en tournaments (DB tournament_designer).

Publica el documento en Kafka (topic: torneo) usando KafkaJS.

Kafka: imagen bitnami/kafka:latest en modo KRaft (sin Zookeeper), listener PLAINTEXT://kafka:9092 y healthcheck.

Consumer: servicio Node/TS independiente (otro contenedor) que se suscribe a torneo con groupId torneo-consumer e imprime cada mensaje.


# #################   RESUMEN (SE QUE EL README ES LARGO) ############################

 --------Tournament Manager – Resumen de ejecución---------------

# Este proyecto levanta 4 servicios con Docker Compose:

API NodeJS → Inserta torneos en Mongo y publica en Kafka.
MongoDB → Base de datos para almacenar torneos.
Kafka → Cola de mensajes para los torneos registrados.
Job Node (consumer) → Lee mensajes del tópico torneo e imprime en consola.

1) Levantar los servicios

cd C:\ProyectosBases\tournament-manager\tournament-manager-api
docker compose up -d --build

a. Verifica que estén arriba:
docker compose ps

2) Probar la API
Verificar que responde
curl http://localhost:3000/

-> Debe devolver:

{"message":"Tournament Designer API is running!"}

Insertar un torneo
curl -X POST http://localhost:3000/registrar `
  -H "Content-Type: application/json" `
  -d '{"title":"Liga TEC","type":"single","roster":[{"id":1,"name":"Ana","weight":60,"age":21}]}'

3) Verificar en Mongo

En la terminal del contenedor tournament-designer-db:

mongosh --quiet --eval "db.getSiblingDB('tournament_designer').tournaments.find().pretty()"

4) Verificar en el consumidor

Revisar logs del Job Node (consumer):

docker compose logs -f consumer

Debe aparecer algo como:

Mensaje recibido: {"_id":"...","title":"Liga TEC","type":"single", ...}