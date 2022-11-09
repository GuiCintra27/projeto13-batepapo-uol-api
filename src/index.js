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

setInterval(() => {
  const interval = Date.now() - 10000;

  participants
  .deleteMany({lastStatus: {$lt: interval}});
}, 15000)

app.post('/participants', (req, res, next) => {
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

app.get('/participants', (req, res) => {
  participants
    .find()
    .toArray()
    .then((participants) => {
      res.send(participants);
    });
})

app.post('/messages', (req, res, next) => {
  const { to, text, type } = req.body;
  const user = req.headers.user;
  const date = dayjs().format('HH:mm:ss');
  let contador = 2;

  const schema = Joi.object({
    to: Joi.string()
      .required(),
    text: Joi.string()
      .required(),
    type: Joi.string().valid('message', 'private_message').required(),
  });

  const result = schema.validate(req.body);

  participants
    .findOne({ name: user })
    .then(participant => {
      if (result.error || !participant) {
        return res.sendStatus(422);
      } else {
        messages.insertOne({
          from: user,
          to,
          text: `mensagem ${contador}`,
          type,
          time: date
        });
        contador++
        return res.sendStatus(201);
      }
    })
    .catch(err => {
      console.log(err);
      return res.sendStatus(500);
    });
});

app.get('/messages', (req, res) => {
  const limit = parseInt(req.query.limit);
  const user = req.headers.user;
  
  if (!limit){
    messages
    .find({$or: [{from: user}, {to: "Todos"}, {to: user}]})
    .toArray()
    .then((messages) => {
      return res.send(messages);
    })
  }

  messages
    .find({$or: [{from: user}, {to: "Todos"}, {to: user}]})
    .sort({$natural:-1})
    .limit(limit)
    .toArray()
    .then((messages) => {
      return res.send(messages);
    })
})

app.post('/status', (req, res, next) => {
  const user = req.headers.user;
  participants
  .updateOne({ name: user},{$set :{lastStatus: Date.now()}})
  .then((updated) => {
    if(updated.modifiedCount === 1){
      return res.sendStatus(200);
    }

    return res.sendStatus(404);
  })
  .catch(err => console.log(err));
})

app.listen(5000, console.log('Server running in port: 5000'));