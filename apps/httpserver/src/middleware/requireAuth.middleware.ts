import { getAuth } from '@clerk/express'
import type { RequestHandler } from 'express'
import { AppError } from './error.middleware'
import { ERROR_CODES } from '@sketchspace/types'

export const requireAuth: RequestHandler = (req, _res, next) => {
  const { userId } = getAuth(req)
  if (!userId) {
    throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required')
  }
  next()
}