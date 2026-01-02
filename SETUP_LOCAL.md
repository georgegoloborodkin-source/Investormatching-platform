# How to Run on Localhost

## Prerequisites

1. **Node.js** (version 18 or higher)
   - Download from: https://nodejs.org/
   - Or use nvm: https://github.com/nvm-sh/nvm

2. **npm** (comes with Node.js)

## Quick Start

### Step 1: Navigate to Project Directory

```bash
cd "remix-of-round-robin-meet"
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages (React, Vite, shadcn-ui, etc.)

### Step 3: Start Development Server

```bash
npm run dev
```

The server will start on **http://localhost:8080**

You should see output like:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:8080/
  ➜  Network: use --host to expose
```

### Step 4: Open in Browser

Open your browser and navigate to:
```
http://localhost:8080
```

---

## Available Scripts

```bash
# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Build for development
npm run build:dev

# Preview production build locally
npm run preview

# Run linter
npm run lint
```

---

## Environment Variables (Optional)

The project uses Supabase, but it works **without** it (uses localStorage as fallback).

If you want to use Supabase:

1. Create a `.env` file in the root directory:
```bash
# .env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
```

2. Get your Supabase credentials:
   - Go to https://supabase.com
   - Create a new project
   - Go to Settings > API
   - Copy the URL and anon/public key

**Note:** The app works fine without Supabase - it will use localStorage to store data locally in your browser.

---

## Troubleshooting

### Port 8080 Already in Use

If port 8080 is already taken, you can change it:

1. Edit `vite.config.ts`:
```typescript
server: {
  host: "::",
  port: 3000, // Change to any available port
},
```

2. Or run with a different port:
```bash
npm run dev -- --port 3000
```

### Node Version Issues

Make sure you have Node.js 18+:
```bash
node --version
```

If you need to upgrade, use nvm:
```bash
nvm install 18
nvm use 18
```

### Dependencies Won't Install

Try:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Build Errors

If you get TypeScript errors:
```bash
# Check TypeScript version
npx tsc --version

# Try rebuilding
npm run build
```

---

## Project Structure

```
remix-of-round-robin-meet/
├── src/
│   ├── components/     # React components
│   ├── pages/          # Page components
│   ├── utils/          # Utilities (matching algorithm)
│   ├── types/          # TypeScript types
│   └── App.tsx         # Main app component
├── public/             # Static files
├── package.json        # Dependencies
├── vite.config.ts      # Vite configuration
└── tsconfig.json       # TypeScript configuration
```

---

## First Time Setup Checklist

- [ ] Install Node.js (18+)
- [ ] Navigate to project directory
- [ ] Run `npm install`
- [ ] Run `npm run dev`
- [ ] Open http://localhost:8080
- [ ] (Optional) Set up Supabase for database

---

## What You'll See

When you open the app, you'll see:
- **Matchmaking Dashboard** with sample data
- **5 tabs**: Manage, Time Slots, Overview, Table View, Edit Schedule
- **Sample startups and investors** pre-loaded
- **Generate Matches** button to create matchings

The app stores data in your browser's localStorage, so it persists between sessions.

---

## Next Steps

1. **Try the matching algorithm**: Click "Generate Matches"
2. **Add participants**: Use the "Manage" tab
3. **Edit schedule**: Use the "Edit Schedule" tab
4. **Import CSV**: Use the import button in the header
5. **Export results**: Use the export button

---

## Need Help?

- Check the browser console for errors (F12)
- Check terminal for build errors
- Verify Node.js version: `node --version`
- Try clearing cache and reinstalling: `rm -rf node_modules && npm install`

