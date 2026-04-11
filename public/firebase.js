cat > ~/vtu-app/firebase.js << 'EOF'
const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');
const { getAuth } = require('firebase/auth');

// Your Firebase config from console
const firebaseConfig = {
  apiKey: "AIzaSyDJp5YTJJTKX3ZR-3NQ4vUtTQNcUFzgYEU",
  authDomain: "jjvtu-27340.firebaseapp.com",
  projectId: "jjvtu-27340",
  storageBucket: "jjvtu-27340.firebasestorage.app",
  messagingSenderId: "1032568067331",
  appId: "1:1032568067331:web:dabb7880b51d99b8b34536",
  measurementId: "G-4ZL3RB80MY"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

module.exports = { db, auth };
EOF
