**Getting Started**
  1. cd into the directory where you want to keep your file
      - start a new terminal. type the command "ls". You might see Documents, Desktop, Downloads, etc. Let's say you want to keep this folder in your "Documents" directory.
      - enter the command "cd Documents". You are now in the Documents folder
  2. Clone repository
      - enter the command "git clone https://github.com/cssgunc/Parr-center-refactor.git" This will create a copy of the remote repository on your local machine (laptop)
  3. Move into the project folder
      - enter the command "cd Parr-center-refactor"
  4. Install dependencies
      - cd frontend
      - npm install (this will install all dependencies required for next js frontend)
  5. Set up environment variables
      - In the frontend directory, create a file called .env.local: command is touch .env.local
    
    Copy the environment variables (Firebase API keys, etc.) shared by the team into this file:
    
    NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here

  6. Run the development server
    - Still inside the frontend folder, start the server:
    - npm run dev

    Open your browser and go to http://localhost:3000
    . You should see the Next.js app running.

**Backend setup**

1. Move into the backend folder: cd ../backend
2. Install backend dependencies: npm install
3. Make sure you have Firebase CLI installed: npm install -g firebase-tools
4. Login to Firebase (if you haven’t already): firebase login
