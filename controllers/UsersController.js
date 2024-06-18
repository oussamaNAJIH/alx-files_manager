const sha1 = require('sha1');
const { ObjectId } = require('mongodb');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

const postNew = async (req, resp) => {
  const { email, password } = req.body;
  if (!email) return resp.status(400).json({ error: 'Missing email' });
  if (!password) return resp.status(400).json({ error: 'Missing password' });

  try {
    const foundUser = await dbClient.db.collection('users').findOne({ email });
    if (foundUser) return resp.status(400).json({ error: 'Already exist' });

    const hashedPassword = sha1(password);
    const newUser = { email, password: hashedPassword };
    const result = await dbClient.db.collection('users').insertOne(newUser);

    const { insertedId } = result;
    return resp.status(201).json({ email, id: insertedId });
  } catch (err) {
    console.error('Error creating user:', err);
    return resp.status(500).json({ error: 'Internal Server Error' });
  }
};

const getMe = async (req, resp) => {
  const token = req.headers['x-token'];
  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return resp.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return resp.status(401).json({ error: 'Unauthorized' });
    }

    return resp.json({ email: user.email, id: user._id });
  } catch (err) {
    console.error('Error retrieving user:', err);
    return resp.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { postNew, getMe };
