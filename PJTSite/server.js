const http = require('http');
const url = require('url');

// In-memory user store (username -> password)
const users = {
  'Danielle': 'password123'
};

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/auth.php' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const input = JSON.parse(body);
        const { action, username, password } = input;

        if (!username || !password) {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: 'Username and password required' }));
          return;
        }

        if (action === 'login') {
          if (users[username] && users[username] === password) {
            res.writeHead(200);
            res.end(JSON.stringify({
              ok: true,
              username: username,
              token: 'fake-token-' + Date.now(),
              userId: Math.random().toString(36).substr(2, 9)
            }));
          } else {
            res.writeHead(401);
            res.end(JSON.stringify({ ok: false, error: 'Invalid username or password' }));
          }
        } else if (action === 'register') {
          if (users[username]) {
            res.writeHead(409);
            res.end(JSON.stringify({ ok: false, error: 'Username already exists' }));
          } else {
            users[username] = password;
            res.writeHead(201);
            res.end(JSON.stringify({
              ok: true,
              message: 'User registered successfully',
              username: username
            }));
          }
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: 'Invalid action' }));
        }
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ ok: false, error: 'Not found' }));
  }
});

const PORT = 8000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Test user: username=Danielle, password=password123');
});
