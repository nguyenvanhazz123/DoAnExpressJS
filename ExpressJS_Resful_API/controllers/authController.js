/* eslint-disable arrow-body-style */
// eslint-disable-next-line import/no-extraneous-dependencies
const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

// eslint-disable-next-line arrow-body-style
// Đăng ký token và thời hạn của token
const signToken = (id) => {
  return jwt.sign({ id: id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPRIES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  //remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user: user },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create(req.body);

  const url = `${req.protocol}://${req.get('host')}/me`;
  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //1.Kiểm tra thông tin email và password
  if (!email || !password) {
    return next(new AppError('Email hoặc password không tồn tại!', 400));
  }
  //2.Kiểm tra nếu user tồn tại và password đúng
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Email hoặc password không đúng', 401));
  }

  //3.Nếu tất cả ok thì gửi token đến khách hàng
  createSendToken(user, 200, res);
});

exports.logout = (req, res, next) => {
  res.cookie('jwt', 'logout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({
    status: 'success',
  });
};

exports.protect = catchAsync(async (req, res, next) => {
  //1.Lay token va kiem tra neu co
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1]; // lay ra chuoi thu 2
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new AppError('Bạn chưa đăng nhập. Vui lòng đăng nhập', 401));
  }

  //2.Kiểm tra token và giải mã token trả về data có id
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // console.log(decoded);

  //3.Kiem tra user con ton tai khong
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('Không tìm thấy người dùng', 401));
  }

  //4.Kiểm tra người dùng đã thay đổi password trước khi token đăng nhập được trả về
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        'Tài khoản đã thay đổi mật khẩu, Vui lòng đăng nhập lại',
        401,
      ),
    );
  }

  req.user = currentUser;
  res.locals.user = currentUser; //trả về user để sử dụng ở template
  next();
});

//Hàm kiểm tra đã đăng nhập trên trình duyệt
exports.isLoggedIn = async (req, res, next) => {
  try {
    if (req.cookies.jwt) {
      //1. Kiểm tra token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET,
      );

      //2.Kiểm tra user có tồn tại không
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      //3.Kiểm tra người dùng đã thay đổi password trước khi token đăng nhập được trả về
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }
      //Nếu có 1 người dùng đã login
      res.locals.user = currentUser;
      return next();
    }
  } catch (error) {
    return next();
  }

  next();
};

//Hàm kiểm tra role của user có phải là admin hay lead-guide không
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    console.log(req.user.role);
    // role ['admin', 'lead-guide'] . role = 'user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Bạn không phải là role admin or lead-guide', 403),
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  //1. Lấy user từ email người dùng nhập
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(
      new AppError('Không tìm thấy người dùng với email bạn vừa nhập', 404),
    );
  }
  //2. Tạo mã token ngẫu nhiên
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  //3. Gửi qua email
  try {
    const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email',
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('Đã xảy ra lỗi khi gửi email. Vui lòng thử lại sau', 500),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1. Lấy user dựa vào token
  //1.1 mã hóa mã token trên url, để kiếm tra có giống với passwordResetToken nào của user không
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  //Kiểm tra và tìm user
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2. Nếu token chưa hết hạn và có 1 người dùng, set new password
  if (!user) {
    return next(new AppError('Không tìm thấy user, token đã hết hạn', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  // 3. Thay đổi lại giá trị của thuộc tính changedPasswordAt của user

  // 4.Đăng nhập user, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  //1. Lấy user
  const user = await User.findById(req.user.id).select('+password'); // lấy thêm trường password vì mặc định không trả về password

  //2. Kiểm tra mật khẩu cũ có đúng không
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Password cũ không đúng', 401));
  }

  //3. Update mật khẩu nếu đúng
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  //4. Đăng nhập lại người dùng, gửi về JWT token mới
  createSendToken(user, 200, res);
});
