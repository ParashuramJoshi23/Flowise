import express from 'express'
import credentialsController from '../../controllers/credentials'
import { resolveWorkspace } from '../../middlewares/workspace'
const router = express.Router()

router.use(resolveWorkspace)

// CREATE
router.post('/', credentialsController.createCredential)

// READ
router.get('/', credentialsController.getAllCredentials)
router.get(['/', '/:id'], credentialsController.getCredentialById)

// UPDATE
router.put(['/', '/:id'], credentialsController.updateCredential)

// DELETE
router.delete(['/', '/:id'], credentialsController.deleteCredentials)

export default router
