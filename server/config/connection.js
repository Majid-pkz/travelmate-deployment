const mongoose = require('mongoose');
const { requireEnvironment } = require('./environment');

const uri = requireEnvironment('MONGODB_URI');
if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) {
  throw new Error('MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme.');
}

mongoose.connect(uri);

module.exports = mongoose.connection;

