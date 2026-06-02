import express from 'express'
import toolsController from '../../controllers/tools'
import { resolveWorkspace } from '../../middlewares/workspace'

const router = express.Router()

router.use(resolveWorkspace)

// CREATE
router.post('/', toolsController.createTool)

// READ
router.get('/', toolsController.getAllTools)
router.get(['/', '/:id'], toolsController.getToolById)

// UPDATE
router.put(['/', '/:id'], toolsController.updateTool)

// DELETE
router.delete(['/', '/:id'], toolsController.deleteTool)

export default router
