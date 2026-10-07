import { z } from 'zod'

export const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number')

export const usernameSchema = z
  .string()
  .min(3, 'Minimum 3 characters')
  .max(30, 'Maximum 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores')

export const passwordSchema = z
  .string()
  .min(4, 'Minimum 4 characters')

export const aadhaarSchema = z
  .string()
  .regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits')
  .optional()
  .or(z.literal(''))

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export const createOwnerSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: phoneSchema,
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  username: usernameSchema,
  password: passwordSchema.default('system'),
})

export const createBusinessSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters'),
  city: z.string().optional().default('Default'),
  address: z.string().optional(),
  phone: z.string().optional(),
  receiptPrefix: z
    .string()
    .max(5, 'Maximum 5 characters')
    .regex(/^[A-Z]+$/, 'Only uppercase letters')
    .optional(),
  collectionType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  defaultCollectionDay: z
    .enum([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ])
    .optional(),
  interestModel: z.enum(['ADDON', 'UPFRONT']).default('ADDON'),
  collectionDays: z.string().default("MON,TUE,WED,THU,FRI,SAT,SUN"),
  repaymentMultiplierDailyWeekly: z.number().min(1).max(5).optional(),
  repaymentMultiplierMonthly: z.number().min(1).max(5).optional(),
  villages: z.array(z.string().min(1)).min(1, 'At least one location is required'),
})

export const createCustomerSchema = z.object({
  customerId: z.string().optional(),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  age: z.number().int().min(18).max(100).optional(),
  phone: phoneSchema.optional().or(z.literal('')),
  altPhone: phoneSchema.optional().or(z.literal('')),
  villageId: z.string().min(1, 'Location is required'),
  address: z.string().optional(),
  aadhaar: aadhaarSchema,
  jobType: z.string().optional(),
  guarantorName: z.string().optional(),
  guarantorPhone: phoneSchema.optional().or(z.literal('')),
  notes: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  photoPath: z.string().optional(),
})

export const createLoanSchema = z.object({
  customerId: z.string().min(1),
  loanNumber: z.string().optional(),
  loanAmount: z.number().int().positive('Loan amount must be positive'),
  interestAmount: z.number().int().min(0, 'Interest cannot be negative'),
  interestModel: z.enum(['ADDON', 'UPFRONT']).default('ADDON'),
  collectionType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  collectionDay: z
    .enum([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ])
    .optional(),
  installmentAmount: z.number().int().positive('Installment must be positive'),
  numberOfInstallments: z.number().int().positive('Must have at least 1 installment'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  agentId: z.string().optional(),
  notes: z.string().optional(),
  renewFromLoanId: z.string().optional(),
  documents: z.array(z.object({
    filePath: z.string(),
    originalName: z.string(),
    mimeType: z.string(),
  })).optional(),
})

export const createPaymentSchema = z.object({
  loanId: z.string().min(1),
  amount: z.number().int().positive('Amount must be positive'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  note: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
})

export const bulkPaymentSchema = z.object({
  villageId: z.string().min(1),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(
    z.object({
      loanId: z.string().min(1),
      customerId: z.string().min(1),
      amount: z.number().int().min(0),
    })
  ),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
})

export const createUserSchema = z.object({
  fullName: z.string().min(2),
  phone: phoneSchema,
  email: z.string().email().nullable().optional(),
  username: usernameSchema,
  password: passwordSchema.default('system'),
  role: z.enum(['BUSINESS_ADMIN', 'AGENT']),
  businessIds: z.array(z.string()).min(1, 'Assign at least one business'),
  villageIds: z.array(z.string()).optional(),
})

export const createExpenseSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
})

export const cashHandoverSchema = z.object({
  agentId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().int().positive(),
  note: z.string().optional(),
})

export const registrationSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: phoneSchema,
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  username: z.string()
    .min(4, 'Minimum 4 characters')
    .max(20, 'Maximum 20 characters')
    .regex(/^[a-zA-Z0-9._]+$/, 'Only letters, numbers, dots, and underscores'),
  password: z.string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^a-zA-Z0-9]/, 'Must contain a special character'),
  confirmPassword: z.string(),
  businessName: z.string().min(2, 'Business name must be at least 2 characters').optional(),
  city: z.string().min(2, 'City is required').optional(),
  villages: z.array(z.string().min(1)).min(1, 'At least one location is required').optional(),
  collectionType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  defaultCollectionDay: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']).optional(),
  declaration: z.literal(true, { errorMap: () => ({ message: 'You must accept the declaration' }) }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const rejectRegistrationSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
})

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, 'Username or phone number is required'),
})

export const resolvePasswordResetSchema = z.object({
  newPassword: z.string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^a-zA-Z0-9]/, 'Must contain a special character'),
  note: z.string().optional(),
})

export const cancelPasswordResetSchema = z.object({
  note: z.string().optional(),
})
