const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

const getStatus = (req, resp) => {
  const dbAlive = dbClient.isAlive();
  const redisAlive = redisClient.isAlive();
  return resp.status(200).json({ redis: redisAlive, db: dbAlive });
};

const getStats = async (req, resp) => {
  const usersCount = await dbClient.nbUsers();
  const filesCount = await dbClient.nbFiles();
  return resp.status(200).json({ users: usersCount, files: filesCount });
};

module.exports = { getStatus, getStats };
