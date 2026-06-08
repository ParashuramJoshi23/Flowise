import express from 'express'
import chatflowsController from '../../controllers/chatflows'
import { resolveWorkspace } from '../../middlewares/workspace'

const router = express.Router()

// Resolve workspace from X-Workspace-ID header on all chatflow requests
router.use(resolveWorkspace)

// CREATE
router.post('/', chatflowsController.saveChatflow)
router.post('/importchatflows', chatflowsController.importChatflows)

// READ
router.get('/', chatflowsController.getAllChatflows)
router.get(['/', '/:id'], chatflowsController.getChatflowById)
router.get(['/apikey/', '/apikey/:apikey'], chatflowsController.getChatflowByApiKey)

// UPDATE
router.put(['/', '/:id'], chatflowsController.updateChatflow)

// DELETE
router.delete(['/', '/:id'], chatflowsController.deleteChatflow)

export default router
