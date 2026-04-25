const express = require('express');
const router = express.Router();
const { signup, invite, acceptInvite, getTeam, getMyOrgs, switchOrg } = require('../controllers/orgController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/signup', verifyToken, signup);
router.post('/invite', verifyToken, invite);
router.post('/accept-invite', verifyToken, acceptInvite);
router.get('/team', verifyToken, getTeam);
router.get('/my-orgs', verifyToken, getMyOrgs);
router.post('/switch', verifyToken, switchOrg);

module.exports = router;
