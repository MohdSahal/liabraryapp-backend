const { db } = require('../config/firebase');
const fs = require('fs');
const path = require('path');

const collection = db.collection('books');

// Helper to upload image
// Helper to upload image (Local Storage)
const uploadImage = async (file) => {
    if (!file) return null;

    // Create uploads directory if not exists
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
    const filePath = path.join(uploadDir, fileName);

    // Save buffer to file
    fs.writeFileSync(filePath, file.buffer);

    // Return the URL relative to the server
    // Assuming the server is running on the same host (localhost or deployed)
    // The frontend will need to prepend the API base URL or server host if it's just a path
    // But since the frontend uses full URLs for images usually, let's return a path that the frontend can use.
    // If the frontend accesses images directly, it needs the full URL.
    // For now, let's return the full URL assuming localhost:5000 or relative path if handled by frontend.
    // Better: Return the full URL if we knew the host. 
    // SAFEST: Return the path `/uploads/${fileName}` and ensure frontend handles it.
    // Actually, `http://localhost:5000/uploads/...` is best for immediate fix.

    const baseUrl = process.env.API_URL || 'http://localhost:5000'; // Default to localhost
    return `${baseUrl}/uploads/${fileName}`;
};

exports.createBook = async (req, res) => {
    try {
        const { name, category, language, description, isAvailable } = req.body;
        const file = req.file;

        let imageUrl = '';
        if (file) {
            console.log('File received:', file.originalname, file.mimetype);
            imageUrl = await uploadImage(file);
            console.log('Generated Signed URL:', imageUrl);
        } else {
            console.log('No file received in request');
        }

        const newBook = {
            name,
            category,
            language,
            description,
            isAvailable: isAvailable === 'true' || isAvailable === true,
            imageUrl,
            organizationId: req.user.organizationId,
            createdAt: new Date().toISOString()
        };

        const docRef = await collection.add(newBook);
        console.log('Book created with ID:', docRef.id);
        res.status(201).json({ id: docRef.id, ...newBook });
    } catch (error) {
        console.error('Error creating book:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getBooks = async (req, res) => {
    try {
        const { category, language, search } = req.query;
        let query = collection.where('organizationId', '==', req.user.organizationId);

        if (category) query = query.where('category', '==', category);
        if (language) query = query.where('language', '==', language);

        const snapshot = await query.get();
        const books = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (search) {
            // Client-side search for simplicity as Firestore doesn't support full-text search natively easily
            const searchLower = search.toLowerCase();
            const filteredBooks = books.filter(book =>
                book.name.toLowerCase().includes(searchLower)
            );
            return res.status(200).json(filteredBooks);
        }

        res.status(200).json(books);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getBookById = async (req, res) => {
    try {
        const doc = await collection.doc(req.params.id).get();
        if (!doc.exists || doc.data().organizationId !== req.user.organizationId) {
            return res.status(404).json({ error: 'Book not found' });
        }
        res.status(200).json({ id: doc.id, ...doc.data() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateBook = async (req, res) => {
    try {
        const { name, category, language, description, isAvailable, removeImage } = req.body;
        const file = req.file;

        let updates = { ...req.body };
        
        const doc = await collection.doc(req.params.id).get();
        if (!doc.exists || doc.data().organizationId !== req.user.organizationId) {
            return res.status(404).json({ error: 'Book not found' });
        }

        // Handle image updates or removal
        if (file) {
            updates.imageUrl = await uploadImage(file);
        } else if (removeImage === 'true') {
            updates.imageUrl = '';
        }

        // Clean up flags from database updates
        delete updates.removeImage;

        if (isAvailable !== undefined) {
            updates.isAvailable = isAvailable === 'true' || isAvailable === true;
        }

        await collection.doc(req.params.id).update(updates);
        res.status(200).json({ id: req.params.id, ...updates });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteBook = async (req, res) => {
    try {
        const doc = await collection.doc(req.params.id).get();
        if (!doc.exists || doc.data().organizationId !== req.user.organizationId) {
            return res.status(404).json({ error: 'Book not found' });
        }
        await collection.doc(req.params.id).delete();
        res.status(200).json({ message: 'Book deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.bulkCreateBooks = async (req, res) => {
    try {
        const { books } = req.body;
        if (!Array.isArray(books)) {
            return res.status(400).json({ error: 'Expected an array of books' });
        }

        const batch = db.batch();
        const createdBooks = [];

        books.forEach(book => {
            const { name, category, language, description, isAvailable } = book;
            if (!name || !category || !language) return;

            const docRef = collection.doc();
            const newBook = {
                name,
                category,
                language,
                description: description || '',
                isAvailable: isAvailable === undefined ? true : (isAvailable === 'true' || isAvailable === true),
                imageUrl: '', // Bulk import doesn't support images for now
                organizationId: req.user.organizationId,
                createdAt: new Date().toISOString()
            };
            batch.set(docRef, newBook);
            createdBooks.push({ id: docRef.id, ...newBook });
        });

        await batch.commit();
        res.status(201).json({ message: `Successfully imported ${createdBooks.length} books`, count: createdBooks.length });
    } catch (error) {
        console.error('Error in bulkCreateBooks:', error);
        res.status(500).json({ error: error.message });
    }
};
