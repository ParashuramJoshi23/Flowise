import express from 'express'
import * as idpController from '../../controllers/idp'
import { requireAuth, requireRole } from '../../middlewares/authentication'

const router = express.Router()

// ---- Identity Provider management (admin only) ----
router.get('/providers', requireAuth, requireRole('admin'), idpController.listProviders)
router.post('/providers', requireAuth, requireRole('admin'), idpController.createProvider)
router.get('/providers/:id', requireAuth, requireRole('admin'), idpController.getProvider)
router.put('/providers/:id', requireAuth, requireRole('admin'), idpController.updateProvider)
router.delete('/providers/:id', requireAuth, requireRole('admin'), idpController.deleteProvider)

// ---- OIDC flow (public — redirects to IdP) ----
router.get('/oidc/:id/login', idpController.oidcLogin)
router.get('/oidc/callback', idpController.oidcCallback)

// ---- SAML flow (public — redirects to IdP) ----
router.get('/saml/:id/login', idpController.samlLogin)
router.post('/saml/:id/callback', idpController.samlCallback)
router.get('/saml/:id/metadata', idpController.samlMetadata)

export default router
