// VTU API - myfavor90/vtu-hub
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for frontend
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// In-memory storage (upgrade to MongoDB later)
const users = new Map();
const transactions = [];
let userIdCounter = 1;

function generateTransactionId() {
    return 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

// ==================== API ENDPOINTS ====================

// Health check
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'VTU API from myfavor90/vtu-hub!',
        version: '1.0.0',
        endpoints: {
            register: 'POST /api/register',
            login: 'POST /api/login',
            balance: 'GET /api/balance/:userId',
            airtime: 'POST /api/buy-airtime',
            data: 'POST /api/buy-data',
            networks: 'GET /api/networks',
            plans: 'GET /api/data-plans/:network',
            transactions: 'GET /api/transactions/:userId'
        }
    });
});

// Get networks
app.get('/api/networks', (req, res) => {
    const networks = [
        { id: 'mtn', name: 'MTN', code: '01', bonus: '5%', price: '100' },
        { id: 'glo', name: 'GLO', code: '02', bonus: '4%', price: '100' },
        { id: 'airtel', name: 'Airtel', code: '03', bonus: '4.5%', price: '100' },
        { id: '9mobile', name: '9mobile', code: '04', bonus: '3%', price: '100' }
    ];
    res.json({ success: true, networks });
});

// Get data plans
app.get('/api/data-plans/:network', (req, res) => {
    const plans = {
        mtn: [
            { id: 1, name: '500MB', price: 100, validity: '1 day' },
            { id: 2, name: '1GB', price: 300, validity: '7 days' },
            { id: 3, name: '2GB', price: 500, validity: '14 days' },
            { id: 4, name: '5GB', price: 1200, validity: '30 days' },
            { id: 5, name: '10GB', price: 2000, validity: '30 days' }
        ],
        glo: [
            { id: 1, name: '500MB', price: 120, validity: '1 day' },
            { id: 2, name: '1GB', price: 350, validity: '7 days' },
            { id: 3, name: '2GB', price: 600, validity: '14 days' },
            { id: 4, name: '4.5GB', price: 1000, validity: '30 days' }
        ],
        airtel: [
            { id: 1, name: '500MB', price: 110, validity: '1 day' },
            { id: 2, name: '1GB', price: 320, validity: '7 days' },
            { id: 3, name: '2GB', price: 550, validity: '14 days' },
            { id: 4, name: '6GB', price: 1500, validity: '30 days' }
        ],
        '9mobile': [
            { id: 1, name: '500MB', price: 130, validity: '1 day' },
            { id: 2, name: '1GB', price: 380, validity: '7 days' },
            { id: 3, name: '2GB', price: 650, validity: '14 days' }
        ]
    };
    
    res.json({ 
        success: true, 
        network: req.params.network,
        plans: plans[req.params.network] || [] 
    });
});

// Register user
app.post('/api/register', (req, res) => {
    try {
        const { email, password, phone, name, referralCode } = req.body;
        
        if (!email || !password || !phone || !name) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }
        
        // Check if user exists
        let existing = null;
        for (let user of users.values()) {
            if (user.email === email) {
                existing = user;
                break;
            }
        }
        
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }
        
        const userId = 'USER_' + (userIdCounter++);
        const referralCode_gen = userId.substring(0, 8);
        
        const newUser = {
            userId,
            email,
            name,
            phone,
            balance: 1000,
            referralCode: referralCode_gen,
            referredBy: referralCode || null,
            totalReferrals: 0,
            createdAt: new Date().toISOString()
        };
        
        users.set(userId, newUser);
        
        // Handle referral
        if (referralCode) {
            for (let user of users.values()) {
                if (user.referralCode === referralCode) {
                    user.balance += 500;
                    user.totalReferrals += 1;
                    break;
                }
            }
        }
        
        res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome bonus: ₦1000',
            userId,
            balance: newUser.balance,
            referralCode: referralCode_gen
        });
        
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Login
app.post('/api/login', (req, res) => {
    try {
        const { email, password } = req.body;
        
        let user = null;
        for (let u of users.values()) {
            if (u.email === email) {
                user = u;
                break;
            }
        }
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        res.json({
            success: true,
            message: 'Login successful',
            userId: user.userId,
            name: user.name,
            balance: user.balance,
            email: user.email
        });
        
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get balance
app.get('/api/balance/:userId', (req, res) => {
    const user = users.get(req.params.userId);
    
    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }
    
    res.json({
        success: true,
        balance: user.balance,
        currency: 'NGN'
    });
});

// Buy airtime
app.post('/api/buy-airtime', (req, res) => {
    try {
        const { userId, phone, network, amount } = req.body;
        
        const user = users.get(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        if (amount < 50) {
            return res.status(400).json({
                success: false,
                message: 'Minimum amount is ₦50'
            });
        }
        
        if (user.balance < amount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance'
            });
        }
        
        // Calculate bonus
        let bonus = 0;
        if (network === 'mtn') bonus = amount * 0.05;
        else if (network === 'glo') bonus = amount * 0.04;
        else if (network === 'airtel') bonus = amount * 0.045;
        else if (network === '9mobile') bonus = amount * 0.03;
        
        const finalAmount = amount - bonus;
        
        // Deduct balance
        user.balance -= finalAmount;
        users.set(userId, user);
        
        // Record transaction
        const transaction = {
            id: generateTransactionId(),
            userId,
            type: 'airtime',
            network,
            phone,
            amount: finalAmount,
            originalAmount: amount,
            bonus: bonus,
            status: 'completed',
            timestamp: new Date().toISOString()
        };
        
        transactions.push(transaction);
        
        res.json({
            success: true,
            message: `✅ Purchased ₦${amount} airtime for ${phone}`,
            bonus: `💰 You saved ₦${bonus.toFixed(2)}`,
            newBalance: user.balance,
            transactionId: transaction.id
        });
        
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Buy data
app.post('/api/buy-data', (req, res) => {
    try {
        const { userId, phone, network, planId, amount, dataSize } = req.body;
        
        const user = users.get(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        if (user.balance < amount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance'
            });
        }
        
        user.balance -= amount;
        users.set(userId, user);
        
        const transaction = {
            id: generateTransactionId(),
            userId,
            type: 'data',
            network,
            phone,
            dataSize,
            amount,
            status: 'completed',
            timestamp: new Date().toISOString()
        };
        
        transactions.push(transaction);
        
        res.json({
            success: true,
            message: `✅ Purchased ${dataSize} data for ${phone}`,
            newBalance: user.balance,
            transactionId: transaction.id
        });
        
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get transaction history
app.get('/api/transactions/:userId', (req, res) => {
    const userTransactions = transactions.filter(t => t.userId === req.params.userId);
    
    res.json({
        success: true,
        transactions: userTransactions.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        ),
        total: userTransactions.length
    });
});

// Admin endpoints
app.get('/api/admin/users', (req, res) => {
    const allUsers = Array.from(users.values()).map(u => ({
        userId: u.userId,
        name: u.name,
        email: u.email,
        balance: u.balance,
        totalReferrals: u.totalReferrals,
        createdAt: u.createdAt
    }));
    
    res.json({ success: true, users: allUsers, total: allUsers.length });
});

app.post('/api/admin/fund-wallet', (req, res) => {
    const { userId, amount } = req.body;
    const user = users.get(userId);
    
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    user.balance += amount;
    users.set(userId, user);
    
    res.json({ success: true, message: `Added ₦${amount}`, newBalance: user.balance });
});

app.get('/api/admin/stats', (req, res) => {
    const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);
    
    res.json({
        success: true,
        stats: {
            totalUsers: users.size,
            totalTransactions: transactions.length,
            totalVolume: totalVolume
        }
    });
});

// Export for Vercel
module.exports = app;
