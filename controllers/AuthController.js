const sha1 = require('sha1');
const { v4: uuidv4 } = require('uuid');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

const getConnect = async (req, resp) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  const userInfo = header.split(' ')[1];
  const bufferObj = Buffer.from(userInfo, 'base64');
  const decodedInfo = bufferObj.toString('utf8');
  const [email, password] = decodedInfo.split(':');

  if (!email || !password) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  const hashedPassword = sha1(password);
  try {
    const foundUser = await dbClient.db.collection('users').findOne({ email });
    if (!foundUser || foundUser.password !== hashedPassword) {
      return resp.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    const key = `auth_${token}`;
    await redisClient.set(key, foundUser._id.toString(), 24 * 60 * 60);

    return resp.status(200).json({ token });
  } catch (err) {
    console.error('Error during authentication:', err);
    return resp.status(500).json({ error: 'Internal Server Error' });
  }
};

const getDisconnect = async (req, resp) => {
  const token = req.headers['x-token'];
  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const foundUser = await redisClient.get(`auth_${token}`);
    if (!foundUser) {
      return resp.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.del(`auth_${token}`);
    return resp.status(204).send();
  } catch (err) {
    console.error('Error during logout:', err);
    return resp.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { getConnect, getDisconnect };
