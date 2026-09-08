import mongoose from 'mongoose';
import config from '../config.js';

const mode = config.MODE;

const devDbUri = `mongodb://${config.DEV_MONGO_DB_USER}:${config.DEV_MONGO_DB_PASS}@${config.DEV_MONGO_DB_HOST}/${config.DEV_MONGO_DB_NAME}`;
const prodDbUri = `mongodb://${config.PROD_MONGO_DB_USER}:${config.PROD_MONGO_DB_PASS}@${config.PROD_MONGO_DB_HOST}/${config.PROD_MONGO_DB_NAME}`;

mongoose.set('strictQuery', true);

if (mode === 'production') {
  mongoose.connect(`mongodb://${config.PROD_MONGO_DB_HOST}/`, {
    user: config.PROD_MONGO_DB_USER,
    pass: config.PROD_MONGO_DB_PASS,
    dbName: config.PROD_MONGO_DB_NAME,
    connectTimeoutMS: 10000,
    retryWrites: true,
    w: 'majority',
  });
}
if (mode === 'development') {
  mongoose.connect(`mongodb://${config.DEV_MONGO_DB_HOST}/`, {
    user: config.DEV_MONGO_DB_USER,
    pass: config.DEV_MONGO_DB_PASS,
    dbName: config.DEV_MONGO_DB_NAME,
    connectTimeoutMS: 10000,
    retryWrites: true,
    w: 'majority',
  });
}
const { connection: db } = mongoose;

db.on('connected', () => {
  console.log(`Database connected: ${db.host} - ${db.name}`);
});

db.on('disconnected', () => {
  console.log('Database disconnected');
});

db.on('error', (err) => {
  console.error(err);
});

export default db;