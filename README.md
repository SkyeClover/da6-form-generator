# DA6 Form Generator

Web application for generating Army DA6 forms (Duty Roster) with proper formatting and validation.

## Features

- Intuitive web interface for DA6 form generation
- Form validation and compliance checking
- PDF generation with proper formatting
- Template support for common configurations

## Tech Stack

- **Frontend**: React 18
- **Backend**: Node.js with Express
- **PDF Generation**: TBD

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install all dependencies (root and client):
```bash
npm run install-all
```

Or manually:
```bash
npm install
cd client && npm install
```

### Development

Start both the server and client in development mode:
```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend React app on `http://localhost:3000`

Or run them separately:
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run client
```

### Project Structure

```
DA6 Form Gen/
├── client/          # React frontend application
│   ├── public/
│   ├── src/
│   └── package.json
├── server/          # Express backend API
│   └── index.js
├── package.json     # Root package.json
└── README.md
```

## API Endpoints

- `GET /api/health` - Health check endpoint
- `POST /api/generate-da6` - Generate DA6 form (TODO)

## Development Status

🚧 **In Development** - This project is currently under active development.

## License

MIT

