import express from 'express';
import cors from 'cors';
import { MongoClient } from "mongodb";
import dotenv from 'dotenv';
import Joi from 'joi';
import dayjs from 'dayjs';

dotenv.config();
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db, participants, messages;

const app = express();
app.use(cors());
app.use(express.json());

mongoClient.connect().then(() => {
  db = mongoClient.db("bate-papo-uol");
  participants = db.collection("participants");
  messages = db.collection("messages");
});

app.post('/test', (req, res, next) => {
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

  participants
    .findOne({ name: name })
    .then(user => {
      if (user) {
        return res.status(409).send(`O nome ${name} já está em uso!`);
      } else {
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
      }
    })
    .catch(err => {
      console.log(err);
      res.sendStatus(500);
    });
});

app.get('/test', (req, res) => {
  participants
    .find()
    .toArray()
    .then((participants) => {
      res.send(participants);
    });
})

app.listen(5000, console.log('Server running in port: 5000'));