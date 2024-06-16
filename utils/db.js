// utils/db.js

const { MongoClient } = require('mongodb');

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const DATABASE_URI = `mongodb://${host}:${port}/${database}`;

    this.client = new MongoClient(DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    this.client.connect()
      .then(() => {
        console.log('Connected to MongoDB');
        this.db = this.client.db(database);
      })
      .catch((err) => {
        console.error('Error connecting to MongoDB:', err);
      });
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    try {
      const count = await this.db.collection('users').countDocuments();
      return count;
    } catch (err) {
      console.error('Error counting users:', err);
      throw err;
    }
  }

  async nbFiles() {
    try {
      const count = await this.db.collection('files').countDocuments();
      return count;
    } catch (err) {
      console.error('Error counting files:', err);
      throw err;
    }
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
