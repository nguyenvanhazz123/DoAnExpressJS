/* eslint-disable no-use-before-define */
/* eslint-disable import/prefer-default-export */
/* eslint-disable node/no-unsupported-features/es-syntax */
/* eslint-disable no-undef */
import axios from 'axios';
import { showAlert } from './alerts';

const stripe = Stripe(
  'pk_test_51OvqClBGQOPwYmHCTVR6GfmhkUqjWJEiPlobeKKlKpCLTbeywgcy9hrIf4NxKj7Nv2D6Ck0P9xumlr8v9M5CqWTf00RSNF4dMn',
);

export const bookTour = async (tourId) => {
  try {
    //1. Lấy phiên làm việc từ API
    const session = await axios(
      `http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourId}`,
    );
    console.log(session);
    //2. Tạo biểu mẫu thanh toán
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (error) {
    showAlert('error', error);
  }
};
