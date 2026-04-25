const { admin } = require('./src/config/firebase');

async function createTestUser() {
    try {
        const userRecord = await admin.auth().createUser({
            email: 'admin@library.com',
            password: 'password123',
            displayName: 'Admin User'
        });
        console.log('Successfully created new user:', userRecord.uid);
    } catch (error) {
        if (error.code === 'auth/email-already-exists') {
            console.log('User admin@library.com already exists. Updating password to password123...');
            try {
                const user = await admin.auth().getUserByEmail('admin@library.com');
                await admin.auth().updateUser(user.uid, {
                    password: 'password123'
                });
                console.log('Password updated successfully!');
            } catch (updateError) {
                console.error('Error updating user:', updateError);
            }
        } else {
            console.error('Error creating new user:', error);
        }
    } finally {
        process.exit();
    }
}

createTestUser();
