cat > ~/vtu-app/server.js << 'EOF'
const express = require('express');
const { db, auth } = require('./firebase');
const { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, 
  query, where, addDoc, deleteDoc, orderBy, limit 
} = require('firebase/firestore');
const { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail 
} = require('firebase/auth');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static('public'));

// ==================== HELPER FUNCTIONS ====================

// Add transaction to user's history
async function addTransaction(userId, transaction) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const user = userSnap.data();
    const transactions = user.transactions || [];
    transactions.push({
      id: Date.now(),
      ...transaction,
      date: new Date().toISOString()
    });
    await updateDoc(userRef, { transactions });
  }
}

// Get user by email
async function getUserByEmail(email) {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', email));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) return null;
  
  const doc = querySnapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

// Get user by ID
async function getUserById(userId) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return null;
  return { id: userSnap.id, ...userSnap.data() };
}

// Update user balance
async function updateBalance(userId, newBalance) {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { balance: newBalance });
}

// ==================== API ROUTES ====================

// Root endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'VTU API is running with Firebase',
    version: '1.0.0',
    endpoints: [
      '/api/networks',
      '/api/data-plans/:network',
      '/api/register',
      '/api/login',
      '/api/send-money',
      '/api/buy-airtime',
      '/api/buy-data',
      '/api/transactions/:userId',
      '/api/admin/stats'
    ]
  });
});

// Get available networks
app.get('/api/networks', (req, res) => {
  res.json({
    networks: [
      { id: 'mtn', name: 'MTN', code: '01' },
      { id: 'glo', name: 'GLO', code: '02' },
      { id: 'airtel', name: 'Airtel', code: '03' },
      { id: '9mobile', name: '9mobile', code: '04' }
    ]
  });
});

// Get data plans by network
app.get('/api/data-plans/:network', (req, res) => {
  const plans = {
    mtn: [
      { plan: '500MB', price: 150, validity: '1 day' },
      { plan: '1GB', price: 300, validity: '7 days' },
      { plan: '2GB', price: 550, validity: '14 days' },
      { plan: '5GB', price: 1200, validity: '30 days' },
      { plan: '10GB', price: 2200, validity: '30 days' }
    ],
    glo: [
      { plan: '500MB', price: 120, validity: '1 day' },
      { plan: '1GB', price: 250, validity: '7 days' },
      { plan: '3GB', price: 600, validity: '14 days' },
      { plan: '6GB', price: 1100, validity: '30 days' },
      { plan: '11GB', price: 2000, validity: '30 days' }
    ],
    airtel: [
      { plan: '500MB', price: 140, validity: '1 day' },
      { plan: '1GB', price: 280, validity: '7 days' },
      { plan: '2.5GB', price: 500, validity: '14 days' },
      { plan: '4.5GB', price: 1000, validity: '30 days' },
      { plan: '15GB', price: 2500, validity: '30 days' }
    ],
    '9mobile': [
      { plan: '500MB', price: 130, validity: '1 day' },
      { plan: '1GB', price: 270, validity: '7 days' },
      { plan: '2GB', price: 520, validity: '14 days' },
      { plan: '4GB', price: 1000, validity: '30 days' },
      { plan: '8GB', price: 1800, validity: '30 days' }
    ]
  };
  
  res.json({ plans: plans[req.params.network] || [] });
});

// Register user
app.post('/api/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  
  try {
    // Check if user exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.json({ success: false, message: 'User already exists' });
    }
    
    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', userId), {
      name,
      email,
      phone,
      balance: 1000,
      role: 'user',
      transactions: [],
      createdAt: new Date().toISOString()
    });
    
    // Add welcome bonus transaction
    await addTransaction(userId, {
      type: 'registration_bonus',
      amount: 1000,
      description: 'Welcome bonus'
    });
    
    res.json({ 
      success: true, 
      message: 'Registration successful!', 
      userId, 
      balance: 1000 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.json({ success: false, message: error.message });
  }
});

// Login user
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userId = userCredential.user.uid;
    
    // Get user data from Firestore
    const user = await getUserById(userId);
    
    if (!user) {
      return res.json({ success: false, message: 'User data not found' });
    }
    
    // Create session token (simple for demo)
    const sessionToken = Buffer.from(`${userId}:${Date.now()}`).toString('base64');
    
    res.json({
      success: true,
      message: 'Login successful',
      sessionToken,
      user: {
        userId,
        name: user.name,
        email: user.email,
        balance: user.balance,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.json({ success: false, message: 'Invalid email or password' });
  }
});

// Send money
app.post('/api/send-money', async (req, res) => {
  const { fromUserId, toEmail, amount } = req.body;
  
  try {
    // Get sender
    const sender = await getUserById(fromUserId);
    if (!sender) {
      return res.json({ success: false, message: 'Sender not found' });
    }
    
    // Get recipient
    const recipient = await getUserByEmail(toEmail);
    if (!recipient) {
      return res.json({ success: false, message: 'Recipient not found' });
    }
    
    // Check balance
    if (sender.balance < amount) {
      return res.json({ success: false, message: 'Insufficient balance' });
    }
    
    // Update balances
    await updateBalance(fromUserId, sender.balance - amount);
    await updateBalance(recipient.id, recipient.balance + amount);
    
    // Add transactions
    await addTransaction(fromUserId, {
      type: 'send_money',
      amount: -amount,
      to: toEmail,
      description: `Sent to ${recipient.name}`
    });
    
    await addTransaction(recipient.id, {
      type: 'receive_money',
      amount: amount,
      from: sender.email,
      description: `Received from ${sender.name}`
    });
    
    res.json({ 
      success: true, 
      message: `Sent ₦${amount} to ${recipient.name}`, 
      newBalance: sender.balance - amount 
    });
  } catch (error) {
    console.error('Send money error:', error);
    res.json({ success: false, message: 'Transaction failed' });
  }
});

// Buy airtime
app.post('/api/buy-airtime', async (req, res) => {
  const { userId, phone, amount, network } = req.body;
  
  try {
    const user = await getUserById(userId);
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }
    
    if (user.balance < amount) {
      return res.json({ success: false, message: 'Insufficient balance' });
    }
    
    await updateBalance(userId, user.balance - amount);
    
    await addTransaction(userId, {
      type: 'airtime_purchase',
      amount: -amount,
      network,
      phone,
      description: `Airtime purchase for ${phone} on ${network.toUpperCase()}`
    });
    
    res.json({ 
      success: true, 
      message: `Purchased ₦${amount} airtime for ${phone}`, 
      newBalance: user.balance - amount 
    });
  } catch (error) {
    console.error('Buy airtime error:', error);
    res.json({ success: false, message: 'Purchase failed' });
  }
});

// Buy data
app.post('/api/buy-data', async (req, res) => {
  const { userId, phone, network, dataPlan, amount } = req.body;
  
  try {
    const user = await getUserById(userId);
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }
    
    if (user.balance < amount) {
      return res.json({ success: false, message: 'Insufficient balance' });
    }
    
    await updateBalance(userId, user.balance - amount);
    
    await addTransaction(userId, {
      type: 'data_purchase',
      amount: -amount,
      network,
      dataPlan,
      phone,
      description: `Data purchase: ${dataPlan} for ${phone} on ${network.toUpperCase()}`
    });
    
    res.json({ 
      success: true, 
      message: `Purchased ${dataPlan} data for ${phone}`, 
      newBalance: user.balance - amount 
    });
  } catch (error) {
    console.error('Buy data error:', error);
    res.json({ success: false, message: 'Purchase failed' });
  }
});

// Get transactions
app.get('/api/transactions/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const user = await getUserById(userId);
    if (!user) {
      return res.json({ transactions: [] });
    }
    
    res.json({ transactions: user.transactions || [] });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.json({ transactions: [] });
  }
});

// Admin stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    const users = [];
    let totalBalance = 0;
    
    querySnapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        userId: doc.id,
        name: data.name,
        email: data.email,
        balance: data.balance,
        role: data.role
      });
      totalBalance += data.balance;
    });
    
    res.json({
      stats: {
        totalUsers: users.length,
        totalBalance,
        users
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.json({ stats: { totalUsers: 0, totalBalance: 0, users: [] } });
  }
});

// Forgot password
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  try {
    await sendPasswordResetEmail(auth, email);
    res.json({ 
      success: true, 
      message: 'Password reset email sent. Check your inbox.' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.json({ 
      success: false, 
      message: 'Email not found or error sending reset email' 
    });
  }
});

// Check users (debug)
app.get('/api/check-users', async (req, res) => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    const users = [];
    
    querySnapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        userId: doc.id,
        name: data.name,
        email: data.email,
        balance: data.balance,
        role: data.role
      });
    });
    
    res.json({ users });
  } catch (error) {
    console.error('Check users error:', error);
    res.json({ users: [] });
  }
});

// ==================== SERVER START ====================

// For local development
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ VTU Backend running on http://localhost:${PORT}`);
    console.log(`📡 API available at /api/...`);
    console.log(`🔥 Firebase connected`);
  });
}

// For Vercel serverless deployment
module.exports = app;
EOF
