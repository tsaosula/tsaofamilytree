
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const SERVER_VERSION = "2.5.0-static"; 

// --- MIDDLEWARE ---
// Request Logger
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
});

// ==========================================
// STATIC SERVING
// ==========================================
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA Catch-all
app.get('*', (req, res) => {
    // Prevent index.html serving for missing assets
    if (req.url.includes('.') && !req.url.includes('index.html')) {
        return res.status(404).send('Not Found');
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    
    if (fs.existsSync(path.join(distPath, 'index.html'))) {
        res.sendFile(path.join(distPath, 'index.html'));
    } else {
        res.status(404).send("Application building... Please refresh shortly.");
    }
});

app.listen(PORT, () => {
  console.log("================================================");
  console.log(`Server Online: ${PORT} (v${SERVER_VERSION})`);
  console.log(`Mode: Static Client-Side Only`);
  console.log("================================================");
});
