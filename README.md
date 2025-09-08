
# Group-Cart

Group-Cart is a collaborative shopping cart application that allows users to create and manage shared shopping lists in real-time.

## Features

- Real-time collaborative shopping lists
- Firebase integration for data storage and authentication
- Web-based user interface
- WebSocket support for live updates
- Express.js backend server

## Project Structure

```
Group-Cart/
├─ server/          # Backend server
│  ├─ index.js      # Server entry point
│  └─ package.json  # Server dependencies
└─ web/            # Frontend application
   ├─ app.js       # Frontend logic
   ├─ index.html   # Main HTML file
   ├─ styles.css   # Styling
   └─ assets/      # Static assets
      ├─ logo.svg
      └─ user.svg
```

## Technologies Used

### Backend
- Node.js
- Express.js
- Socket.IO
- Firebase Admin SDK
- CORS
- UUID

### Frontend
- HTML5
- CSS3
- JavaScript
- HTTP Server (for development)

## Getting Started

### Prerequisites
- Node.js (Latest LTS version recommended)
- npm or yarn package manager
- Firebase account and project setup
- Firebase CLI (`npm install -g firebase-tools`)

### Firebase Setup

1. Create a new Firebase project:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Add Project"
   - Follow the setup wizard to create your project

2. Configure Firebase in the project:
   ```bash
   # Login to Firebase
   firebase login

   # Initialize Firebase in the project root
   firebase init
   ```
   Select the following options:
   - Choose "Hosting" when prompted for features
   - Select your newly created project
   - Use "web" as your public directory
   - Configure as a single-page app: Yes
   - Set up automatic builds and deploys: No

3. Set up Firebase Admin SDK:
   - Go to Project Settings > Service Accounts in Firebase Console
   - Generate a new private key
   - Save the generated JSON file as `serviceAccountKey.json` in the `server` directory
   - Add this file to `.gitignore`

4. Update environment variables:
   Create a `.env` file in the `server` directory with:
   ```
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY=your-private-key
   FIREBASE_CLIENT_EMAIL=your-client-email
   ```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/heyymateen/Group-Cart.git
cd Group-Cart
```

2. Install server dependencies:
```bash
cd server
npm install
```

3. Install web dependencies:
```bash
cd ../web
npm install
```

### Running the Application

1. Start the server:
```bash
cd server
npm run dev
```

2. Start the web application:
```bash
cd web
npm run dev
```

The web application will be available at `http://localhost:5173`

### Deployment

#### Frontend (Render Static Site)

To deploy the frontend on Render as a Static Site:

1. From your Render dashboard:
   - Click "New +"
   - Select "Static Site"
   - Connect your GitHub repository
   - Select the Group-Cart repository

2. Configure the Static Site:
   - Name: `group-cart` (or your preferred name)
   - Root Directory: `web`
   - Build Command: empty
   - Publish Directory: `.` (if you have a build script, use your build output directory)
   - Select branch to deploy (e.g., `main`)

3. Click "Create Static Site"

Your frontend will be available at `https://your-site-name.onrender.com`

#### Backend (Render Web Service)

To deploy the backend server on Render:

1. From your Render dashboard:
   - Click "New +"
   - Select "Web Service"
   - Connect your GitHub repository (if not already done)
   - Select the Group-Cart repository

2. Configure the Web Service:
   - Name: `group-cart-api` (or your preferred name)
   - Root Directory: `server`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Select the appropriate instance type (Free tier is available)

3. Add Environment Variables:
   - Click on "Environment"
   - Add the following variables:
     ```
     FIREBASE_PROJECT_ID=your-project-id
     FIREBASE_PRIVATE_KEY=your-private-key
     FIREBASE_CLIENT_EMAIL=your-client-email
     ```
   - Add any other environment variables your application needs

4. Click "Create Web Service"

Your backend API will be available at `https://your-api-name.onrender.com`

#### Connecting Frontend to Backend

After both services are deployed:

1. Update your frontend Socket.IO client configuration:
   ```javascript
   // --- Socket.io Client ---
   const socket = io("https://your-api-name.onrender.com", {
     withCredentials: true
   });
   ```

2. Update your backend CORS and allowed origins configuration in `server/index.js`:
   ```javascript
   const allowedOrigins = [
     "http://localhost:5173",
     "https://your-frontend-site-name.onrender.com",   // ✅ your frontend
     "https://groupcart-41b08.web.app",
     "https://groupcart-41b08.firebaseapp.com"
   ];

   app.use(
     cors({
       origin: (origin, callback) => {
         // allow non-browser clients or same-origin
         if (!origin || allowedOrigins.includes(origin)) {
           callback(null, true);
         } else {
           callback(new Error("CORS blocked for origin: " + origin));
         }
       },
       credentials: true,
     })
   );
   ```

3. Make sure your Socket.IO server is configured with the same CORS settings:
   ```javascript
   const io = new Server(server, {
     cors: {
       origin: allowedOrigins,
       methods: ["GET", "POST"],
       credentials: true,
     },
   });
   ```

Remember to:
- Replace `your-api-name.onrender.com` with your actual backend URL
- Replace `your-frontend-site-name.onrender.com` with your actual frontend URL
- Rebuild and redeploy your services after making these changes
- Ensure both `withCredentials` and CORS settings match to enable successful Socket.IO connections

## License

This project is licensed under the ISC License.

## Author

- [@heyymateen](https://github.com/heyymateen)
