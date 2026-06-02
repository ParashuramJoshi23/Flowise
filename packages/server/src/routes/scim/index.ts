/**
 * SCIM 2.0 routes — RFC 7644.
 *
 * Secured by API key (Bearer token in Authorization header).
 * The SCIM token should be a dedicated API key issued to the IdP,
 * separate from the regular Flowise API keys.
 *
 * Mount point: /api/v1/scim/v2
 */
import express from 'express'
import * as scimController from '../../controllers/scim'
import { requireScimAuth } from '../../middlewares/scimAuth'

const router = express.Router()

router.use(requireScimAuth)

router.get('/ServiceProviderConfig', scimController.serviceProviderConfig)
router.get('/Users', scimController.listUsers)
router.post('/Users', scimController.createUser)
router.get('/Users/:id', scimController.getUser)
router.put('/Users/:id', scimController.replaceUser)
router.patch('/Users/:id', scimController.patchUser)
router.delete('/Users/:id', scimController.deleteUser)

export default router
