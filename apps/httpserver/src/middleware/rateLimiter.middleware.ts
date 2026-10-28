import { dataClient } from '../lib/redis'
import { AppError } from './error.middleware'
import { ERROR_CODES } from '@sketchspace/types'

interface BucketConfig {
  maxTokens:  number
  refillRate: number  
  keyPrefix:  string
}

export function createRateLimiter(cfg: BucketConfig) {
  return async (key: string): Promise<void> => {
    const now       = Date.now()
    const bucketKey = `ratelimit:${cfg.keyPrefix}:${key}`

    const results = await dataClient
      .pipeline()
      .hget(bucketKey, 'tokens')
      .hget(bucketKey, 'lastRefill')
      .exec() as [[null, string | null], [null, string | null]]

    const currentTokens  = results[0][1] ? parseFloat(results[0][1]) : cfg.maxTokens
    const lastRefillTime = results[1][1] ? parseFloat(results[1][1]) : now

    const elapsed  = (now - lastRefillTime) / 1000
    const refilled = Math.min(cfg.maxTokens, currentTokens + elapsed * cfg.refillRate)

    if (refilled < 1) {
      throw new AppError(429, ERROR_CODES.RATE_LIMITED, 'Too many requests')
    }

    await dataClient
      .pipeline()
      .hset(bucketKey, 'tokens',     (refilled - 1).toString())
      .hset(bucketKey, 'lastRefill', now.toString())
      .expire(bucketKey, 3600)
      .exec()
  }
}

// Configured instances
export const apiRateLimiter = createRateLimiter({
  maxTokens:  100,
  refillRate: 10,
  keyPrefix:  'api',
})

export const socketRateLimiter = createRateLimiter({
  maxTokens:  300,
  refillRate: 30,    
  keyPrefix:  'socket',
})

export function rateLimitMiddleware(
  limiter: ReturnType<typeof createRateLimiter>,
  keyFn: (req: any) => string,
) {
  return async (req: any, _res: any, next: any) => {
    try {
      await limiter(keyFn(req))
      next()
    } catch (err) {
      next(err)
    }
  }
}