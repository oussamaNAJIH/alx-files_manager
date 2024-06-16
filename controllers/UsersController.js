const sha1 = require('sha1');
const dbClient = require('../utils/db');

const postNew = async (req, resp) => {
  const { email } = req.body;
  if (!email) return resp.status(400).json({ error: 'Missing email' });

  const { password } = req.body;
  if (!password) return resp.status(400).json({ error: 'Missing password' });

  try {
    // Check if the user already exists
    const foundUser = await dbClient.db.collection('users').findOne({ email });
    if (foundUser) return resp.status(400).json({ error: 'Already exist' });

    // Hash the password and create the new user
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

module.exports = { postNew };
