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

    // Validation
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
      userId: new ObjectId(user._id),
      name,
      type,
      isPublic,
      parentId: parentId === '0' ? '0' : new ObjectId(parentId),
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(fileData);
      return resp.status(201).json({
        id: result.insertedId,
        ...fileData,
      });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) await fs.mkdir(folderPath, { recursive: true });
    const localPath = path.resolve(folderPath, uuidv4());

    try {
      // Decode Base64 and write the binary data to the file
      await fs.writeFile(localPath, Buffer.from(data, 'base64'));
    } catch (err) {
      console.error('Error writing file:', err);
      return resp.status(500).json({ error: 'Error writing file to disk' });
    }

    fileData.localPath = localPath;
    const result = await dbClient.db.collection('files').insertOne(fileData);
    return resp.status(201).json({
      id: result.insertedId,
      ...fileData,
    });
  } catch (err) {
    console.error('Error creating file:', err);
    return resp.status(500).json({ error: 'Internal Server Error' });
  }
};

const getShow = async (req, resp) => {
  const fileId = req.params.id;
  const token = req.headers['x-token'];

  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return resp.status(401).json({ error: 'Unauthorized' });
    }

    const file = await dbClient.db.collection('files').findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    });
    if (!file) {
      return resp.status(404).json({ error: 'Not found' });
    }

    return resp.json(file);
  } catch (err) {
    console.error('Error retrieving file:', err);
    return resp.status(500).json({ error: 'Internal Server Error' });
  }
};

const getIndex = async (req, resp) => {
  const token = req.headers['x-token'];
  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return resp.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page, 10) || 0;
    const limit = 20;
    const skip = page * limit;

    const files = await dbClient.db.collection('files').aggregate([
      {
        $match: {
          userId: new ObjectId(userId),
          parentId: parentId === '0' ? '0' : new ObjectId(parentId),
        },
      },
      { $skip: skip },
      { $limit: limit },
    ]).toArray();

    return resp.status(200).json(files);
  } catch (err) {
    console.error('Error retrieving files:', err);
    return resp.status(500).json({ error: 'Internal Server Error' });
  }
};

const putPublish = async (req, resp) => {
  const fileId = req.params.id;
  const token = req.headers['x-token'];

  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return resp.status(401).json({ error: 'Unauthorized' });
    }

    const file = await dbClient.db.collection('files').findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    });

    if (!file) {
      return resp.status(404).json({ error: 'Not found' });
    }

    await dbClient.db.collection('files').updateOne(
      { _id: new ObjectId(fileId) },
      { $set: { isPublic: true } },
    );

    // Retrieve the updated file document
    const updatedFile = await dbClient.db.collection('files').findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    });

    return resp.status(200).json(updatedFile);
  } catch (err) {
    console.error('Error updating file to public:', err);
    return resp.status(500).json({ error: 'Internal Server Error' });
  }
};

const putUnpublish = async (req, resp) => {
  const fileId = req.params.id;
  const token = req.headers['x-token'];

  if (!token) {
    return resp.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return resp.status(401).json({ error: 'Unauthorized' });
    }

    const file = await dbClient.db.collection('files').findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    });

    if (!file) {
      return resp.status(404).json({ error: 'Not found' });
    }

    await dbClient.db.collection('files').updateOne(
      { _id: new ObjectId(fileId) },
      { $set: { isPublic: false } },
    );

    // Retrieve the updated file document
    const updatedFile = await dbClient.db.collection('files').findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    });

    return resp.status(200).json(updatedFile);
  } catch (err) {
    console.error('Error updating file to private:', err);
    return resp.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  postUpload, getShow, getIndex, putPublish, putUnpublish,
};
