// =====================================================================
// ELITE — Firebase configuration
// =====================================================================
// 1. Go to https://console.firebase.google.com
// 2. Create a new (free) project — call it "ELITE" or anything you like.
// 3. In the project, click the </> (Web) icon to register a web app.
// 4. Firebase will show you a config object that looks like the one
//    below. Copy YOUR values and paste them in here, replacing the
//    placeholders.
// 5. In the Firebase console, enable:
//      Build → Authentication → Sign-in method → Email/Password → Enable
//      Build → Firestore Database → Create database → Start in
//        "production mode" (we ship our own security rules, see
//        firestore.rules) → pick a location close to your users.
//
// Full step-by-step instructions with screenshots-in-words are in
// SETUP-GUIDE.md in this folder.
// =====================================================================

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
