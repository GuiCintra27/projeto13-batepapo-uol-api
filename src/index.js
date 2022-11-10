import express from 'express';
import cors from 'cors';
import { MongoClient } from "mongodb";
import dotenv from 'dotenv';
import Joi from 'joi';
import dayjs from 'dayjs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
await mongoClient.connect();
const db = mongoClient.db("bate-papo-uol");
const participants = db.collection("participants");
const messages = db.collection("messages");

setInterval(async () => {
  try {
    const interval = Date.now() - 10000;
    const date = dayjs().format('HH:mm:ss');

    const deletedParticipants = await participants
      .find({ lastStatus: { $lt: interval } })
      .toArray();

    if (deletedParticipants) {
      deletedParticipants.forEach(async (participant) => {
        try {
          await participants.deleteOne({ id: participant.id });

          messages.insertOne({
            from: participant.name,
            to: 'Todos',
            text: 'Sai da sala...',
            type: 'status',
            time: date
          });
        } catch (err) {

          console.log(err);
          res.sendStatus(500);
        }
      })
    }
  } catch (err) {

    console.log(err);
    res.sendStatus(500);
  }
}, 15000)

app.post('/participants', async (req, res, next) => {
  const { name } = req.body;
  const date = dayjs().format('HH:mm:ss');

  const schema = Joi.object({
    name: Joi.string()
      .required(),
  });

  const result = schema.validate(req.body);

  if (result.error) {
    return res.status(400).send('Preencha todos os campos!');
  }

  try {
    const user = await participants.findOne({ name: name });

    if (user) {
      return res.status(409).send(`O nome ${name} já está em uso!`);
    }

    participants.insertOne({
      name,
      lastStatus: Date.now()
    });

    messages.insertOne({
      from: name,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: date
    });

    return res.sendStatus(201);
  } catch (err) {

    console.log(err);
    res.sendStatus(500);
  }
});

app.get('/participants', async (req, res) => {
  try {

    const activeParticipants = await participants.find().toArray();
    res.send(activeParticipants);
  } catch (err) {

    console.log(err);
    res.sendStatus(500);
  }
})

app.post('/messages', async (req, res, next) => {
  const { to, text, type } = req.body;
  const user = req.headers.user;
  const date = dayjs().format('HH:mm:ss');

  const schema = Joi.object({
    to: Joi.string()
      .required(),
    text: Joi.string()
      .required(),
    type: Joi.string().valid('message', 'private_message').required(),
  });

  const result = schema.validate(req.body);

  try {
    const isLogged = await participants.findOne({ name: user });

    if (result.error || !isLogged) {
      return res.sendStatus(422);
    } else {
      messages.insertOne({
        from: user,
        to,
        text,
        type,
        time: date
      });
    }

    return res.sendStatus(201);
  } catch (err) {

    console.log(err);
    return res.sendStatus(500);
  };
});

app.get('/messages', async (req, res) => {

  try {
    const limit = parseInt(req.query.limit);
    const user = req.headers.user;

    if (!limit) {
      const chatMessages = await messages.find({ $or: [{ from: user }, { to: "Todos" }, { to: user }, { type: "message" }] }).toArray();
      return res.send(chatMessages);
    }

    const chatMessages = await messages
      .find({ $or: [{ from: user }, { to: "Todos" }, { to: user }, { type: "message" }] })
      .sort({ $natural: -1 })
      .limit(limit)
      .toArray();

    return res.send(chatMessages.reverse());
  } catch (err) {

    console.log(err);
    res.sendStatus(500);
  }
})

app.post('/status', async (req, res, next) => {
  try {
    const user = req.headers.user;
    const isLogged = await participants.updateOne({ name: user }, { $set: { lastStatus: Date.now() } });

    if (isLogged.modifiedCount === 1) {
      return res.sendStatus(200);
    }

    return res.sendStatus(404);
  } catch (err) {

    console.log(err);
    res.sendStatus(500);
  }
})

app.listen(5000, console.log('Server running in port: 5000'));