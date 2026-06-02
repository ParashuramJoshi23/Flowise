import express from 'express'
import * as authController from '../../controllers/auth'
import { requireAuth, requireRole } from '../../middlewares/authentication'

const router = express.Router()

/** Public endpoints */
router.post('/login', authController.login)
router.post('/refresh', authController.refreshToken)

/** Authenticated endpoints */
router.get('/me', requireAuth, authController.me)

/** Admin-only user management */
router.get('/users', requireAuth, requireRole('admin'), authController.listUsers)
router.post('/users', requireAuth, requireRole('admin'), authController.createUser)
router.put('/users/:id', requireAuth, requireRole('admin'), authController.updateUser)
router.delete('/users/:id', requireAuth, requireRole('admin'), authController.deleteUser)

export default router
