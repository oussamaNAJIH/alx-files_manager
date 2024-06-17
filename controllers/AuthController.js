const sha1 = require('sha1');
const { uuid } = require('uuidv4');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

const getConnect = async (req, resp) => {
  const header = req.headers.Authorization;
  const userInfo = header.split(' ')[1];
  const bufferObj = Buffer.from(userInfo, 'base64');
  const decodedInfo = bufferObj.toString('utf8');
  const email = decodedInfo.split(':')[0];
  const password = decodedInfo.split(':')[1];
  const hashedPassword = sha1(password);
  const foundUser = await dbClient.db.collection('users').findOne({ email });
  if (!foundUser || foundUser.password !== hashedPassword) return resp.status(401).json({ error: 'Unauthorized' });
  const token = uuid();
  const key = `auth_${token}`;
  await redisClient.setAsync(key, foundUser, 24 * 60 * 60 * 1000);
  return resp.status(200).json({ token });
};

const getDisconnect = async (req, resp) => {
  const token = req.headers['X-Token'];
  const foundUser = await redisClient.get(`auth_${token}`);
  if (!foundUser) return resp.status(401).json({ error: 'Unauthorized' });
  await redisClient.del(`auth_${token}`);
  return resp.status(204);
};

module.exports = { getConnect, getDisconnect };
