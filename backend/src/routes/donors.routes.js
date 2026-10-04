import { Router } from 'express';
import { z } from 'zod';
import { authRequired as requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { donorCreateSchema } from '../schemas/donor.schema.js';
import {
  donorForgotPasswordSchema,
  donorLoginSchema,
  donorResetPasswordSchema,
} from '../schemas/auth.schema.js';
import {
  createDonor,
  listDonors,
  listDonorMap,
  loginDonor,
  refreshDonor,
  logoutDonor,
  meDonor,
  forgotDonorPassword,
  resetDonorPassword,
  requestRegisterOtp,
} from '../controllers/donors.controller.js';

const donorCreateWithVerificationSchema = donorCreateSchema.extend({
  // SUPABASE-PENDING: supabase keys kept for later resume. Backend `code` is primary now.
  supabaseAccessToken: z.string().min(10).max(10000).optional(),
  supabaseToken: z.string().min(10).max(10000).optional(),
  clerkToken: z.string().min(10, 'Verification is required').max(10000).optional(),
  code: z.string().length(6, 'code must be 6 characters').optional(),
  emailOtpCode: z.string().length(6, 'code must be 6 characters').optional(),
}).superRefine((v, ctx) => {
  if (!v.supabaseAccessToken && !v.supabaseToken && !v.clerkToken && !v.code && !v.emailOtpCode) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Verification is required', path: ['code'] });
  }
});

const donorResetWithVerificationSchema = donorResetPasswordSchema.extend({
  supabaseAccessToken: z.string().min(10).max(10000).optional(),
  supabaseToken: z.string().min(10).max(10000).optional(),
  code: z.string().length(6, 'code must be 6 characters').optional(),
}).superRefine((v, ctx) => {
  if (!v.supabaseAccessToken && !v.supabaseToken && !v.code) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Verification is required', path: ['code'] });
  }
});

const router = Router();

router.post('/', authLimiter, validate(donorCreateWithVerificationSchema), createDonor);
router.post(
  '/request-register-otp',
  authLimiter,
  validate(donorForgotPasswordSchema),
  requestRegisterOtp
);
router.get('/map', requireAuth, listDonorMap);
router.get('/', requireAuth, listDonors);
// Donor session (real account: email + password -> JWT + refresh cookie).
router.post('/login', authLimiter, validate(donorLoginSchema), loginDonor);
router.post('/refresh', refreshDonor);
router.post('/logout', logoutDonor);
router.get('/me', requireAuth, meDonor);
// Secure donor password reset (generic responses, hashed OTP, cooldown).
router.post(
  '/forgot-password',
  authLimiter,
  validate(donorForgotPasswordSchema),
  forgotDonorPassword
);
router.post(
  '/reset-password',
  authLimiter,
  validate(donorResetWithVerificationSchema),
  resetDonorPassword
);

export default router;
