const { Schema, model } = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new Schema(
  {
    firstname: {
      type: String,
      required: true,
      trim:true
    },
    lastname: {
      type: String,
      required: true,
      trim:true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/.+@.+\..+/, 'Must use a valid email address'],
  },
  password: {
      type: String,
      required: true,
      select: false,
      minlength: 8,
      validate: (value) => Buffer.byteLength(value, 'utf8') <= 72,
  },
  tokenVersion: {
    type: Number,
    default: 0,
    select: false,
  },


    isAdmin: {
      type: Boolean,
      required: true,
      default: false,
    },
   
  }
 
);

// hash user password
userSchema.pre('save', async function () {
  if (this.isNew || this.isModified('password')) {
    const saltRounds = 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
  }

});

// custom method to compare and validate password for logging in
userSchema.methods.isCorrectPassword = async function (password) {
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72 || !this.password) return false;
  return bcrypt.compare(password, this.password);
};



const User = model('User', userSchema);

module.exports = User;
