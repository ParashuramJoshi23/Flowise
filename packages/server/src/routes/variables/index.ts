import express from 'express'
import variablesController from '../../controllers/variables'
import { resolveWorkspace } from '../../middlewares/workspace'

const router = express.Router()

router.use(resolveWorkspace)

// CREATE
router.post('/', variablesController.createVariable)

// READ
router.get('/', variablesController.getAllVariables)

// UPDATE
router.put(['/', '/:id'], variablesController.updateVariable)

// DELETE
router.delete(['/', '/:id'], variablesController.deleteVariable)

export default router
