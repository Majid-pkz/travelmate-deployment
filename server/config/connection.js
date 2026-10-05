const dns = require('node:dns');
const { isIP } = require('node:net');
const mongoose = require('mongoose');
const { requireEnvironment } = require('./environment');

const uri = requireEnvironment('MONGODB_URI');
if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) {
  throw new Error('MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme.');
}

// Override Node DNS only when explicitly configured for this environment.
const dnsServers = process.env.DNS_SERVERS?.trim();
if (dnsServers) {
  const servers = dnsServers.split(',').map((server) => server.trim());
  if (servers.some((server) => !isIP(server))) {
    throw new Error('DNS_SERVERS must be a comma-separated list of IP addresses.');
  }
  dns.setServers(servers);
}

mongoose.connect(uri);

module.exports = mongoose.connection;

