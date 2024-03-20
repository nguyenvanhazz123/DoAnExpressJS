/* eslint-disable import/no-extraneous-dependencies */
const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    require: [true, 'Please tell us your name'],
  },
  email: {
    type: String,
    require: [true, 'Please tell us your email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  photo: {
    type: String,
    default: 'default.jpg',
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    require: [true, 'Please provide a valid password'],
    minlength: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    require: [true, 'Please provide a valid passwordConfirm'],
    validate: {
      validator: function (el) {
        return el === this.password;
      },
      message: 'Password are not the same',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;

  next();
});
userSchema.pre('save', async function (next) {
  //Kiểm tra trường password có được sửa đổi hay không, trả về true || false
  //Kiểm tra nếu trường password không được thay đổi hoặc đây là tài khoản mới thì next()
  if (!this.isModified('password') || this.isNew) return next();

  //Đôi khi 1 tk của user vừa đổi mật khẩu và vừa đăng nhập
  //cùng 1 lúc nên thời gian trùng nhau nên sau khi đổi mk vẫn đăng nhập được
  //nên cần trừ đi 1s để thời gian đăng nhập luôn lớn hơn thời gian đổi mật khẩu
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

//Kiểm tra khi có thao tác find() thì chỉ lọc các user có active = true
userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

//Hàm dùng để so sánh giữa password được mã hóa và password thực tế của người dùng
userSchema.methods.correctPassword = async function (
  candidatePassword, //password do người dùng nhập
  userPassword, //password đã được mã hóa và lưu trong db
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );
    console.log(changedTimestamp, JWTTimestamp);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  //Tạo chuỗi token
  const resetToken = crypto.randomBytes(32).toString('hex');

  //Mã hóa rồi lưu vào passwordResetToken của user
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  console.log({ resetToken }, this.passwordResetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('users', userSchema);

module.exports = User;
