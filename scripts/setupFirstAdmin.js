
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const bcrypt = require('bcryptjs');

dotenv.config();

const setupFirstAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const adminEmail = 'irorunhomesng@gmail.com';
    const adminPassword = 'irorunhomes@12345';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('Super Admin already exists:', existingAdmin.email);
      await mongoose.disconnect();
      return;
    }


    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create super admin (plain password; pre-save hook will hash it)
    const superAdmin = new User({
      fullName: 'Super Administrator',
      email: adminEmail,
      password: hashedPassword,
      role: 'super_admin',
      isVerified: true,
      isEmailVerified: true,
      kycVerified: true,
      accountStatus: 'active'
    });

    await superAdmin.save();

    console.log('=========================================');
    console.log('SUPER ADMIN CREATED SUCCESSFULLY!');
    console.log('=========================================');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('Role: super_admin');
    console.log('=========================================');
    console.log('IMPORTANT: Change the password immediately after first login!');
    console.log('=========================================');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Setup error:', error);
    process.exit(1);
  }
};

setupFirstAdmin();
