const { admin, db } = require('../config/firebase');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Create a Nodemailer transporter
let transporter;
const initMailer = async () => {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    } else {
        // Fallback to Ethereal for testing if no real SMTP is provided
        console.warn("No SMTP credentials provided. Falling back to Ethereal Email for testing.");
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
    }
};
initMailer();

exports.signup = async (req, res) => {
    try {
        // req.user is populated by authMiddleware because they just registered in Firebase Auth
        const { orgName } = req.body;
        const uid = req.user.uid;
        const email = req.user.email;

        if (!orgName) {
            return res.status(400).json({ error: 'Organization name is required' });
        }

        const staffDoc = await db.collection('staff').doc(uid).get();

        // Run in transaction
        await db.runTransaction(async (t) => {
            // Create Organization
            const orgRef = db.collection('organizations').doc();
            t.set(orgRef, {
                name: orgName,
                ownerId: uid,
                createdAt: new Date().toISOString()
            });

            // Create or Update Staff record
            const newStaffRef = db.collection('staff').doc(uid);
            
            if (staffDoc.exists) {
                const existingData = staffDoc.data();
                const newOrgs = [...(existingData.organizations || []), { id: orgRef.id, name: orgName, role: 'owner' }];
                t.update(newStaffRef, {
                    organizations: newOrgs,
                    activeOrganizationId: orgRef.id // Automatically switch to the newly created org
                });
            } else {
                t.set(newStaffRef, {
                    uid,
                    email,
                    activeOrganizationId: orgRef.id,
                    organizations: [{ id: orgRef.id, name: orgName, role: 'owner' }],
                    createdAt: new Date().toISOString()
                });
            }
        });

        res.status(201).json({ message: 'Organization created successfully' });
    } catch (error) {
        console.error('Signup Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.invite = async (req, res) => {
    try {
        // Only owners can invite
        if (req.user.role !== 'owner') {
            return res.status(403).json({ error: 'Only owners can send invites' });
        }

        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const organizationId = req.user.organizationId;

        // Generate secure token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

        const inviteRef = db.collection('invites').doc(token);
        await inviteRef.set({
            email,
            organizationId,
            status: 'pending',
            expiresAt,
            invitedBy: req.user.email,
            createdAt: new Date().toISOString()
        });

        // Send Email
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const inviteLink = `${frontendUrl}/join/${token}`;

        const info = await transporter.sendMail({
            from: '"Library App" <noreply@libraryapp.com>',
            to: email,
            subject: "You have been invited to join a Library Organization",
            text: `You have been invited to join a library organization by ${req.user.email}.\n\nClick the link to join: ${inviteLink}`,
            html: `<h3>Library App Invitation</h3>
                   <p>You have been invited to join a library organization by <b>${req.user.email}</b>.</p>
                   <p><a href="${inviteLink}">Click here to join</a></p>
                   <p>This link expires in 7 days.</p>`
        });

        console.log("Invite email sent. Message ID:", info.messageId);
        if (info.messageId.includes('ethereal')) {
            console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
        }

        res.status(200).json({ message: 'Invite sent successfully', previewUrl: nodemailer.getTestMessageUrl(info) });
    } catch (error) {
        console.error('Invite Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.acceptInvite = async (req, res) => {
    try {
        const { token } = req.body;
        const uid = req.user.uid;
        const email = req.user.email;

        if (!token) return res.status(400).json({ error: 'Invite token is required' });

        // Check token
        const inviteRef = db.collection('invites').doc(token);
        const inviteDoc = await inviteRef.get();

        if (!inviteDoc.exists) return res.status(404).json({ error: 'Invalid or expired invite token' });
        
        const inviteData = inviteDoc.data();
        if (inviteData.status !== 'pending') return res.status(400).json({ error: 'Invite has already been used' });
        if (new Date() > new Date(inviteData.expiresAt)) return res.status(400).json({ error: 'Invite has expired' });

        // Optionally enforce that the logged-in user matches the invited email
        if (inviteData.email.toLowerCase() !== email.toLowerCase()) {
            return res.status(403).json({ error: 'This invite was sent to a different email address' });
        }

        // Get Organization Name for the array
        const orgRef = db.collection('organizations').doc(inviteData.organizationId);
        const orgDoc = await orgRef.get();
        const orgName = orgDoc.exists ? orgDoc.data().name : 'Unknown Organization';

        // Check if user exists
        const staffDoc = await db.collection('staff').doc(uid).get();

        // Run transaction
        await db.runTransaction(async (t) => {
            // Mark invite as accepted
            t.update(inviteRef, { status: 'accepted', acceptedBy: uid, acceptedAt: new Date().toISOString() });

            // Create or Update Staff record
            const newStaffRef = db.collection('staff').doc(uid);
            
            if (staffDoc.exists) {
                const existingData = staffDoc.data();
                // Check if already in this org
                const isAlreadyMember = existingData.organizations?.some(org => org.id === inviteData.organizationId);
                if (!isAlreadyMember) {
                    const newOrgs = [...(existingData.organizations || []), { id: inviteData.organizationId, name: orgName, role: 'member' }];
                    t.update(newStaffRef, {
                        organizations: newOrgs,
                        activeOrganizationId: inviteData.organizationId // switch to new org
                    });
                }
            } else {
                t.set(newStaffRef, {
                    uid,
                    email,
                    activeOrganizationId: inviteData.organizationId,
                    organizations: [{ id: inviteData.organizationId, name: orgName, role: 'member' }],
                    createdAt: new Date().toISOString()
                });
            }
        });

        res.status(200).json({ message: 'Successfully joined organization' });
    } catch (error) {
        console.error('Accept Invite Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getTeam = async (req, res) => {
    try {
        const snapshot = await db.collection('staff').get();
        const team = snapshot.docs
            .map(doc => doc.data())
            .filter(staff => staff.organizations?.some(org => org.id === req.user.organizationId))
            .map(staff => {
                const orgInfo = staff.organizations.find(org => org.id === req.user.organizationId);
                return {
                    uid: staff.uid,
                    email: staff.email,
                    role: orgInfo.role,
                    createdAt: staff.createdAt
                };
            });
            
        res.status(200).json(team);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getMyOrgs = async (req, res) => {
    try {
        const staffDoc = await db.collection('staff').doc(req.user.uid).get();
        if (!staffDoc.exists) return res.status(200).json([]);
        res.status(200).json({
            organizations: staffDoc.data().organizations || [],
            activeOrganizationId: staffDoc.data().activeOrganizationId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.switchOrg = async (req, res) => {
    try {
        const { targetOrgId } = req.body;
        if (!targetOrgId) return res.status(400).json({ error: 'targetOrgId is required' });

        const staffRef = db.collection('staff').doc(req.user.uid);
        const staffDoc = await staffRef.get();
        if (!staffDoc.exists) return res.status(404).json({ error: 'User not found' });

        const staffData = staffDoc.data();
        const isMember = staffData.organizations?.some(org => org.id === targetOrgId);

        if (!isMember) {
            return res.status(403).json({ error: 'You are not a member of this organization' });
        }

        await staffRef.update({ activeOrganizationId: targetOrgId });
        res.status(200).json({ message: 'Switched organization successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
