// Create sample user via Firebase Auth REST API
const https = require('https');

const API_KEY = 'AIzaSyC52ptKsDQNdp6kHJB3KkE-9jrLRKpWdJk';
const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;

const data = JSON.stringify({
    email: 'admin@library.com',
    password: 'admin123',
    returnSecureToken: true
});

const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const urlObj = new URL(url);
options.hostname = urlObj.hostname;
options.path = urlObj.pathname + urlObj.search;

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        const result = JSON.parse(body);
        if (result.error) {
            if (result.error.message === 'EMAIL_EXISTS') {
                console.log('User already exists! Use these credentials:');
            } else {
                console.log('Error:', result.error.message);
                process.exit(1);
            }
        } else {
            console.log('Sample user created successfully!');
        }
        console.log('');
        console.log('  Email:    admin@library.com');
        console.log('  Password: admin123');
        console.log('');
        process.exit(0);
    });
});

req.on('error', (e) => {
    console.error('Request error:', e.message);
    process.exit(1);
});

req.write(data);
req.end();
