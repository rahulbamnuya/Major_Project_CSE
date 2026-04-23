const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const Vehicle = require('../models/Vehicle');

async function migrate() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/logistics-vrp';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for migration...');

    const vehicles = await Vehicle.find({});
    console.log(`Found ${vehicles.length} vehicles to re-classify.`);

    let count = 0;
    for (const vehicle of vehicles) {
      const oldType = vehicle.vehicle_type;
      
      // Re-apply classification logic
      if (vehicle.capacity <= 1000) vehicle.vehicle_type = 'SMALL';
      else if (vehicle.capacity <= 4000) vehicle.vehicle_type = 'MEDIUM';
      else vehicle.vehicle_type = 'LARGE';

      if (oldType !== vehicle.vehicle_type) {
        await vehicle.save();
        console.log(`Updated ${vehicle.name}: ${oldType || 'None'} -> ${vehicle.vehicle_type}`);
        count++;
      }
    }

    console.log(`Migration complete! Updated ${count} vehicles.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
