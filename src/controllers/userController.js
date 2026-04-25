const { db } = require('../config/firebase');

const collection = db.collection('users');
const fs = require('fs');
const path = require('path');

// Helper to upload image (Same as bookController)
const uploadImage = async (file) => {
    if (!file) return null;
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);
    const baseUrl = process.env.API_URL || 'http://localhost:5000';
    return `${baseUrl}/uploads/${fileName}`;
};

exports.createUser = async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const file = req.file;

        // Check if email exists in this organization
        const snapshot = await collection.where('email', '==', email).where('organizationId', '==', req.user.organizationId).get();
        if (!snapshot.empty) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        let imageUrl = '';
        if (file) {
            imageUrl = await uploadImage(file);
        }

        const newUser = {
            name,
            email,
            phone,
            imageUrl,
            organizationId: req.user.organizationId,
            createdAt: new Date().toISOString()
        };

        const docRef = await collection.add(newUser);
        res.status(201).json({ id: docRef.id, ...newUser });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const { search } = req.query;
        const snapshot = await collection.where('organizationId', '==', req.user.organizationId).get();
        let users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (search) {
            const searchLower = search.toLowerCase();
            users = users.filter(user =>
                user.name.toLowerCase().includes(searchLower) ||
                user.email.toLowerCase().includes(searchLower)
            );
        }

        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const doc = await collection.doc(req.params.id).get();
        if (!doc.exists || doc.data().organizationId !== req.user.organizationId) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json({ id: doc.id, ...doc.data() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { name, email, phone, removeImage } = req.body;
        const file = req.file;

        let updates = { ...req.body };

        const doc = await collection.doc(req.params.id).get();
        if (!doc.exists || doc.data().organizationId !== req.user.organizationId) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (file) {
            updates.imageUrl = await uploadImage(file);
        } else if (removeImage === 'true') {
            updates.imageUrl = '';
        }

        delete updates.removeImage;

        await collection.doc(req.params.id).update(updates);
        res.status(200).json({ id: req.params.id, ...updates });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const doc = await collection.doc(req.params.id).get();
        if (!doc.exists || doc.data().organizationId !== req.user.organizationId) {
            return res.status(404).json({ error: 'User not found' });
        }
        await collection.doc(req.params.id).delete();
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.bulkCreateUsers = async (req, res) => {
    try {
        const { users } = req.body;
        if (!Array.isArray(users)) {
            return res.status(400).json({ error: 'Expected an array of users' });
        }

        // Fetch existing emails to avoid duplicates
        const snapshot = await collection.where('organizationId', '==', req.user.organizationId).get();
        const existingEmails = new Set(snapshot.docs.map(doc => doc.data().email));

        const batch = db.batch();
        let count = 0;

        users.forEach(user => {
            const { name, email, phone } = user;
            if (!name || !email || existingEmails.has(email)) return;

            const docRef = collection.doc();
            batch.set(docRef, {
                name,
                email,
                phone: phone || '',
                organizationId: req.user.organizationId,
                createdAt: new Date().toISOString()
            });
            existingEmails.add(email); // Add to local set for this batch's sake
            count++;
        });

        if (count > 0) {
            await batch.commit();
        }

        res.status(201).json({ message: `Successfully imported ${count} users`, count });
    } catch (error) {
        console.error('Error in bulkCreateUsers:', error);
        res.status(500).json({ error: error.message });
    }
};
