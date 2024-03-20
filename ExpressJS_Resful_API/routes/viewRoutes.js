/* eslint-disable import/no-self-import */
const express = require('express');
const viewController = require('../controllers/viewController');
const authController = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

router.get(
  '/',
  bookingController.createBookingCheckout,
  authController.isLoggedIn,
  viewController.overview,
);
router.get('/tour/:slug', authController.isLoggedIn, viewController.getTour);
router.get('/signup', authController.isLoggedIn, viewController.getSignupForm);
router.get('/login', authController.isLoggedIn, viewController.getLoginForm);
router.get('/me', authController.protect, viewController.getAccount);
router.get('/my-tours', authController.protect, viewController.getMyTours);

// router.post(
//   '/submit-user-data',
//   authController.protect,
//   viewController.updateUserData,
// );

module.exports = router;
