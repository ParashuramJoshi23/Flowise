import express from 'express'
import * as workspacesController from '../../controllers/workspaces'
import { requireAuth, requireRole } from '../../middlewares/authentication'

const router = express.Router()

/** All workspace endpoints require authentication when SSO is active. */
router.use(requireAuth)

// Workspace CRUD
router.get('/', workspacesController.listWorkspaces)
router.post('/', workspacesController.createWorkspace)
router.get('/:id', workspacesController.getWorkspace)
router.put('/:id', requireRole('admin', 'owner' as any), workspacesController.updateWorkspace)
router.delete('/:id', requireRole('admin'), workspacesController.deleteWorkspace)

// Membership management
router.get('/:id/members', workspacesController.listMembers)
router.post('/:id/members', requireRole('admin', 'owner' as any), workspacesController.addMember)
router.put('/:id/members/:email', requireRole('admin', 'owner' as any), workspacesController.updateMemberRole)
router.delete('/:id/members/:email', requireRole('admin', 'owner' as any), workspacesController.removeMember)

export default router
