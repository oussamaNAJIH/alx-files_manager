const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { ObjectId } = require('mongodb');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

const postUpload = async (req, resp) => {
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

    const {
      name, type, parentId = '0', isPublic = false, data,
    } = req.body;

    if (!name) return resp.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return resp.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return resp.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== '0') {
      const parent = await dbClient.db.collection('files').findOne({ _id: new ObjectId(parentId) });
      if (!parent) return resp.status(400).json({ error: 'Parent not found' });
      if (parent.type !== 'folder') return resp.status(400).json({ error: 'Parent is not a folder' });
    }
    
    const fileData = {
      userId: user._id,
      name,
      type,
      isPublic,
      parentId: parentId === '0' ? '0' : new ObjectId(parentId),
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(fileData);
      return resp.status(201).json(result);
    }
    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    await fs.mkdir(folderPath, { recursive: true });
    const localPath = path.join(folderPath, uuidv4());
    await fs.writeFile(localPath, Buffer.from(data, 'base64').toString('utf8'));

    fileData.localPath = localPath;
    const result = await dbClient.db.collection('files').insertOne(fileData);
    return resp.status(201).json({ id: result.insertedId, ...fileData });
  } catch (err) {
    console.error('Error creating file:', err);
    return resp.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { postUpload };
