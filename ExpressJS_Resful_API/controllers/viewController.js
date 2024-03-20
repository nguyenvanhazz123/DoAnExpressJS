const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
// const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.overview = catchAsync(async (req, res, next) => {
  //1. Lấy tất cả tour
  const tours = await Tour.find();
  //2. Build template

  //3. Render từ data ở bước 1 ra template
  res.status(200).render('overview', {
    title: 'All Tours',
    tours,
  });
});
exports.getTour = catchAsync(async (req, res, next) => {
  const tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
  });

  if (!tour) {
    return next(new AppError('Không tồn tại tour cần tìm', 404));
  }

  res.status(200).render('tour', {
    title: `${tour.name} Tour`,
    tour,
  });
});
exports.getSignupForm = catchAsync(async (req, res, next) => {
  res.status(200).render('signup', {
    title: 'Signup',
  });
});

exports.getLoginForm = catchAsync(async (req, res, next) => {
  res.status(200).render('login', {
    title: 'Login',
  });
});

exports.getAccount = (req, res) => {
  res.status(200).render('account', {
    title: 'Your account',
  });
};

exports.getMyTours = catchAsync(async (req, res, next) => {
  //1.Lấy ra tất cả tour
  const bookings = await Booking.find({ userId: req.user.id });
  //2.Tìm tour với id của user
  const tourIds = bookings.map((el) => el.tourId); //Lấy danh sách tour id
  const tours = await Tour.find({ _id: { $in: tourIds } }); //Tìm các tour có id nằm trong danh sách trên

  res.status(200).render('overview', {
    title: 'My tours',
    tours,
  });
});

// exports.updateUserData = catchAsync(async (req, res, next) => {
//   const updateUser = await User.findByIdAndUpdate(
//     req.user.id,
//     {
//       name: req.body.name,
//       email: req.body.email,
//     },
//     {
//       new: true,
//       runValidators: true,
//     },
//   );
//   res.status(200).render('account', {
//     title: 'Your account',
//     user: updateUser,
//   });
// });
