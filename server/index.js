const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'DA6 Form Generator API is running' });
});

// DA6 form generation endpoint (placeholder)
app.post('/api/generate-da6', (req, res) => {
  // TODO: Implement DA6 form generation logic
  res.json({ 
    message: 'DA6 form generation endpoint',
    data: req.body 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

