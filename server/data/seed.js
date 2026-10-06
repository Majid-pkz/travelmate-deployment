const mongoose = require('mongoose');
const { Interest, TripType } = require('../models');

async function seedCatalogue() {
  let added = 0;
  for (const label of ['Hiking', 'Camping', 'Beach', 'Culture', 'Food', 'Photography']) {
    const result = await Interest.updateOne(
      { label: [label] }, { $setOnInsert: { label: [label] } }, { upsert: true },
    );
    added += result.upsertedCount;
  }
  for (const tripType of ['Road trip', 'Weekend getaway', 'City break', 'Nature adventure']) {
    const result = await TripType.updateOne(
      { tripType }, { $setOnInsert: { tripType } }, { upsert: true },
    );
    added += result.upsertedCount;
  }
  return added;
}
if (require.main === module) {
  (async () => {
    await require('../config/connection').ready;
    const added = await seedCatalogue();
    console.log('Catalogue ready. Added ' + added + ' interests/trip types.');
    await mongoose.disconnect();
  })().catch(async () => {
    console.error('Could not initialize the catalogue. Check database configuration.');
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}
module.exports = { seedCatalogue };
