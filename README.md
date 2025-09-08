
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

To deploy the application to Firebase Hosting:

```bash
# Build the application (if needed)
cd web
npm run build  # if you have a build script

# Deploy to Firebase
firebase deploy
```

The application will be available at `https://[YOUR-PROJECT-ID].web.app`

## License

This project is licensed under the ISC License.

## Author

- [@heyymateen](https://github.com/heyymateen)
