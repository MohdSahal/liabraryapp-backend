const { admin, db } = require('../config/firebase');

const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Fetch staff record to get organization details
        const staffDoc = await db.collection('staff').doc(decodedToken.uid).get();
        
        if (!staffDoc.exists) {
            // For signup/create org, we might not have a staff record yet.
            if (req.originalUrl.includes('/api/org/signup') || req.originalUrl.includes('/api/org/accept-invite')) {
                req.user = decodedToken;
                return next();
            }
            return res.status(403).json({ error: 'Unauthorized: User is not assigned to an organization.' });
        }

        const staffData = staffDoc.data();
        const activeOrgId = staffData.activeOrganizationId;
        const orgInfo = staffData.organizations?.find(org => org.id === activeOrgId);

        req.user = {
            ...decodedToken,
            organizationId: activeOrgId,
            role: orgInfo ? orgInfo.role : null,
            organizations: staffData.organizations || []
        };
        
        next();
    } catch (error) {
        console.error("Token verification failed:", error);
        return res.status(403).json({ error: 'Unauthorized: Invalid token', details: error.message, code: error.code });
    }
};

module.exports = { verifyToken };
