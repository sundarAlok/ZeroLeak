# ZeroLeak

ZeroLeak is a modern React-based social media application designed for secure and private communication. It integrates Firebase for backend services, including authentication, real-time database, and cloud functions for enhanced functionality.

## Features

- **User Authentication**: Secure login and onboarding process with Firebase Auth.
- **Real-time Chat**: Instant messaging with friends and groups.
- **Favorites**: Save and manage your favorite posts or users.
- **Moments**: Share and view ephemeral content.
- **Profile Management**: Customize your profile with avatars and settings.
- **Premium Features**: Access to exclusive content and advanced functionalities.
- **Caching Strategy**: Optimized data caching for better performance.
- **Firebase Functions**: Serverless backend functions, including unread message counters.

## Tech Stack

- **Frontend**: React, CSS
- **Backend**: Firebase (Firestore, Auth, Functions)
- **Deployment**: Firebase Hosting
- **Build Tool**: Create React App

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/ZeroLeak.git
   cd ZeroLeak
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Firebase:
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/).
   - Enable Authentication, Firestore, and Functions.
   - Copy `.env.example` to `.env` and fill in the Firebase values from your project settings.
   - Do not commit `.env`; the Firebase web API key is client configuration, not an authorization boundary. Protect access with Firebase Security Rules and API key restrictions.
   - Deploy functions if needed: `firebase deploy --only functions`.

4. Start the development server:
   ```bash
   npm start
   ```

   Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

## Usage

- **Development**: Run `npm start` to start the development server.
- **Build**: Run `npm run build` to create a production build.
- **Test**: Run `npm test` to launch the test runner.
- **Deploy**: Use Firebase CLI to deploy: `firebase deploy`.

## Project Structure

- `src/`: Main application code
  - `components/`: Reusable UI components
  - `pages/`: Page components for different views
  - `context/`: React context for state management
  - `firebase/`: Firebase configuration and utilities
  - `utils/`: Utility functions and data seeding
- `functions/`: Firebase Cloud Functions
- `public/`: Static assets

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature-name`.
3. Commit your changes: `git commit -m 'Add some feature'`.
4. Push to the branch: `git push origin feature-name`.
5. Open a pull request.

## License

This project is private and proprietary.

## Support

For support or questions, please contact the development team.
