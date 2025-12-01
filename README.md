# DA6 Form Generator

Web application for generating Army DA6 forms (Duty Roster) with proper formatting and validation.

## Features

- ✅ User authentication with Google OAuth
- ✅ Secure user accounts and data storage
- ✅ Intuitive web interface for DA6 form generation
- ✅ Soldier/personnel management
- ✅ Form validation and compliance checking
- ✅ PDF generation with proper formatting (coming soon)
- ✅ Template support for common configurations (coming soon)

## Tech Stack

- **Frontend**: React 18 with React Router
- **Backend**: Node.js with Express
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with Google OAuth
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

2. Set up Supabase:
   - Create a Supabase project at [https://app.supabase.com](https://app.supabase.com)
   - Run the database schema from `database/schema.sql` in the Supabase SQL Editor
   - Configure Google OAuth in Supabase Dashboard → Authentication → Providers
   - Set up environment variables (see below)

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
├── client/                    # React frontend application
│   ├── public/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── contexts/          # React contexts (Auth)
│   │   └── lib/               # Utilities (Supabase client)
│   └── package.json
├── server/                    # Express backend API
│   ├── config/                # Configuration files
│   ├── middleware/            # Express middleware (auth)
│   └── index.js
├── database/                  # Database schema and migrations
│   └── schema.sql
├── package.json               # Root package.json
└── README.md
```

## API Endpoints

### Authentication
- `GET /api/auth/user` - Get current user profile (protected)

### DA6 Forms
- `GET /api/da6-forms` - Get all user's DA6 forms (protected)
- `GET /api/da6-forms/:id` - Get specific DA6 form (protected)
- `POST /api/da6-forms` - Create new DA6 form (protected)
- `PUT /api/da6-forms/:id` - Update DA6 form (protected)
- `DELETE /api/da6-forms/:id` - Delete DA6 form (protected)
- `POST /api/generate-da6` - Generate DA6 form PDF (protected, TODO)

### Soldiers/Personnel
- `GET /api/soldiers` - Get all user's soldiers (protected)
- `POST /api/soldiers` - Create new soldier (protected)
- `PUT /api/soldiers/:id` - Update soldier (protected)
- `DELETE /api/soldiers/:id` - Delete soldier (protected)

### Health
- `GET /api/health` - Health check endpoint

## Development Status

🚧 **In Development** - This project is currently under active development.

## Environment Variables

### Server (.env in root)
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Client (.env in client/)
```env
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## License

See [LICENSE](./LICENSE) file for details.

