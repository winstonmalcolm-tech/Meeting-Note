import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/user'
import { authMiddleware } from '../middleware/auth'
import { PLAN_LIMITS_SECONDS } from '../utils/plan-limits'
import { Polar } from '@polar-sh/sdk'

const router = Router()

function signToken(user: { _id: unknown; email: string; plan: string | null; planStatus: string }): string {
  return jwt.sign(
    {
      userId: String(user._id),
      email: user.email,
      plan: user.plan,
      planStatus: user.planStatus
    },
    process.env.JWT_SECRET!,
    { expiresIn: '30d' }
  )
}

router.post('/auth/signup', async (req: Request, res: Response) => {
  try {
    const { name, email, password, plan } = req.body as {
      name?: string; email?: string; password?: string; plan?: string
    }
    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ error: 'name, email and password are required' })
      return
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' })
      return
    }
    const validPlans = ['starter', 'pro', 'power']
    if (plan && !validPlans.includes(plan)) {
      res.status(400).json({ error: 'Invalid plan' })
      return
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() })
    if (existing) {
      res.status(409).json({ error: 'Email already registered' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), passwordHash })
    const token = signToken(user)

    const productIdKey = `POLAR_PRODUCT_${(plan ?? '').toUpperCase()}` as keyof NodeJS.ProcessEnv
    const productId = plan ? process.env[productIdKey] : null
    if (!productId) {
      res.status(400).json({ error: 'Invalid plan or plan not configured' })
      return
    }

    let checkoutUrl: string
    try {
      const polar = new Polar({ accessToken: process.env.POLAR_TOKEN!, server: process.env.POLAR_SANDBOX === 'true' ? 'sandbox' : 'production' })
      const checkout = await polar.checkouts.create({
        products: [productId],
        customerEmail: user.email,
        metadata: { userId: String(user._id) },
        successUrl: `${process.env.FRONTEND_URL}/dashboard?checkout=success`
      })
      checkoutUrl = checkout.url
    } catch (err) {
      console.error('[Polar] checkout creation failed:', err)
      // User was created — still return token so they can retry billing from dashboard
      res.status(201).json({ token, checkoutUrl: null, checkoutError: 'Payment setup failed. You can activate your plan from the dashboard.' })
      return
    }

    res.status(201).json({ token, checkoutUrl })
  } catch (err) {
    console.error('[signup] unexpected error:', err)
    res.status(500).json({ error: 'Signup failed. Please try again.' })
  }
})

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string }
    if (!email?.trim() || !password) {
      res.status(400).json({ error: 'email and password are required' })
      return
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const token = signToken(user)
    res.json({ token })
  } catch (err) {
    console.error('[login] unexpected error:', err)
    res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

router.get('/auth/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId).select('-passwordHash')
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    const limit = user.plan ? (PLAN_LIMITS_SECONDS[user.plan] ?? 0) : 0
    const remaining = Math.max(limit - user.usageSeconds, 0)

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      planStatus: user.planStatus,
      usageSeconds: user.usageSeconds,
      usageLimitSeconds: limit,
      remainingSeconds: remaining,
      usagePeriodStart: user.usagePeriodStart,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd ?? false,
      subscriptionEndsAt: user.subscriptionEndsAt ?? null,
      createdAt: user.createdAt
    })
  } catch (err) {
    console.error('[auth/me] unexpected error:', err)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

export default router
