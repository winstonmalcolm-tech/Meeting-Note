import { Router, Request, Response } from 'express'
import { Polar } from '@polar-sh/sdk'
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks'
import { authMiddleware } from '../middleware/auth'
import { User } from '../models/user'

const router = Router()

function makePolar() {
  return new Polar({
    accessToken: process.env.POLAR_TOKEN!,
    server: process.env.POLAR_SANDBOX === 'true' ? 'sandbox' : 'production'
  })
}

// ── Checkout ─────────────────────────────────────────────────────────────────

router.post('/polar/checkout', authMiddleware, async (req: Request, res: Response) => {
  const { plan } = req.body as { plan?: string }
  const validPlans = ['starter', 'pro', 'power']
  if (!plan || !validPlans.includes(plan)) {
    res.status(400).json({ error: 'Invalid plan' })
    return
  }

  const productId = process.env[`POLAR_PRODUCT_${plan.toUpperCase()}`]
  if (!productId) {
    res.status(500).json({ error: 'Product not configured' })
    return
  }

  try {
    const checkout = await makePolar().checkouts.create({
      products: [productId],
      customerEmail: req.user!.email,
      metadata: { userId: req.user!.userId },
      successUrl: `${process.env.FRONTEND_URL}/dashboard?checkout=success`
    })
    res.json({ checkoutUrl: checkout.url })
  } catch (err) {
    console.error('[Polar] checkout failed:', err)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// ── Cancel subscription (at period end) ──────────────────────────────────────

router.post('/polar/cancel', authMiddleware, async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId)
  if (!user?.polarSubscriptionId) {
    res.status(400).json({ error: 'No active subscription found' })
    return
  }
  try {
    const sub = await makePolar().subscriptions.update({
      id: user.polarSubscriptionId,
      subscriptionUpdate: { cancelAtPeriodEnd: true }
    })
    await User.findByIdAndUpdate(user._id, {
      cancelAtPeriodEnd: true,
      subscriptionEndsAt: sub.endsAt ?? sub.currentPeriodEnd
    })
    res.json({ ok: true, endsAt: sub.endsAt ?? sub.currentPeriodEnd })
  } catch (err) {
    console.error('[Polar] cancel failed:', err)
    res.status(500).json({ error: 'Failed to cancel subscription' })
  }
})

// ── Resume subscription (uncancel) ───────────────────────────────────────────

router.post('/polar/resume', authMiddleware, async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId)
  if (!user?.polarSubscriptionId) {
    res.status(400).json({ error: 'No subscription found' })
    return
  }
  try {
    await makePolar().subscriptions.update({
      id: user.polarSubscriptionId,
      subscriptionUpdate: { cancelAtPeriodEnd: false }
    })
    await User.findByIdAndUpdate(user._id, {
      cancelAtPeriodEnd: false,
      subscriptionEndsAt: null
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('[Polar] resume failed:', err)
    res.status(500).json({ error: 'Failed to resume subscription' })
  }
})

// ── Customer portal (update payment method) ───────────────────────────────────

router.get('/polar/customer-portal', authMiddleware, async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId)
  if (!user?.polarCustomerId) {
    res.status(400).json({ error: 'No billing account found' })
    return
  }
  try {
    const session = await makePolar().customerSessions.create({
      customerId: user.polarCustomerId
    })
    res.json({ portalUrl: session.customerPortalUrl })
  } catch (err) {
    console.error('[Polar] customer portal failed:', err)
    res.status(500).json({ error: 'Failed to open billing portal' })
  }
})

// ── Webhook ───────────────────────────────────────────────────────────────────

router.post('/polar/webhook', async (req: Request, res: Response) => {
  const secret = process.env.POLAR_SECRET
  if (!secret) {
    res.status(500).json({ error: 'Webhook secret not configured' })
    return
  }

  let event
  try {
    event = validateEvent(
      req.body as Buffer,
      req.headers as Record<string, string>,
      secret
    )
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      res.status(403).json({ error: 'Invalid webhook signature' })
      return
    }
    res.status(400).json({ error: 'Bad request' })
    return
  }

  try {
    const type = event.type

    if (
      type === 'subscription.active' ||
      type === 'subscription.created' ||
      type === 'subscription.updated' ||
      type === 'subscription.uncanceled'
    ) {
      const sub = event.data as {
        id: string
        productId: string
        customerId: string
        cancelAtPeriodEnd: boolean
        endsAt?: Date | null
        currentPeriodEnd?: Date
        metadata?: Record<string, unknown>
      }
      const userId = sub.metadata?.userId as string | undefined
      if (userId) {
        const plan = planFromProductId(sub.productId)
        if (plan) {
          await User.findByIdAndUpdate(userId, {
            plan,
            planStatus: 'active',
            polarSubscriptionId: sub.id,
            polarCustomerId: sub.customerId,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
            subscriptionEndsAt: sub.endsAt ?? null,
            ...(type === 'subscription.active' || type === 'subscription.created'
              ? { usageSeconds: 0, usagePeriodStart: new Date() }
              : {})
          })
        }
      }
    } else if (type === 'subscription.revoked' || type === 'subscription.canceled') {
      const sub = event.data as { metadata?: Record<string, unknown> }
      const userId = sub.metadata?.userId as string | undefined
      if (userId) {
        await User.findByIdAndUpdate(userId, { planStatus: 'cancelled', plan: null })
      }
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('[polar webhook] event processing failed:', err)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

function planFromProductId(productId: string): 'starter' | 'pro' | 'power' | null {
  if (productId === process.env.POLAR_PRODUCT_STARTER) return 'starter'
  if (productId === process.env.POLAR_PRODUCT_PRO) return 'pro'
  if (productId === process.env.POLAR_PRODUCT_POWER) return 'power'
  return null
}

export default router
