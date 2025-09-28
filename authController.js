const User = require('../modals/User');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
dotenv.config();
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        
        const user = await User.findOne({ email }).select('+password');
        
        if (!user) {
            console.log('Login failed: User not found for email', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Login failed: Invalid password for user', email);
            return res.status(401).json({ message: 'Invalid credentials' });
        }
    
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000, // 1 day
            domain: process.env.NODE_ENV === 'production' ? '.yourdomain.com' : undefined
        };

        return res
            .status(200)
            .cookie('jwt', token, cookieOptions)
            .json({ 
                message: 'Logged in successfully',
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name
                }
            });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            message: 'Server error during login',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
exports.logout = async (req, res) => {
    try {
        res.clearCookie('jwt', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
          });
        res.status(200).json({ message: 'Logged out successfully' });
      } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Server error' });
      }
}
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'User already exists with this email' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const user = await User.create({ 
            name, 
            email, 
            password: hashedPassword 
        });

      
        // Prepare user data for response
        const userData = {
            id: user._id,
            name: user.name,
            email: user.email
        };

        // Set JWT in HTTP-only cookie and send response
        return res
            .status(200)
            .json({ 
                message: 'User registered successfully',
                user: userData
            });
        
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ 
            message: 'Server error during registration',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

exports.checkAuth = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        const user = await User.findById(req.user.userId).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            authenticated: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ 
            message: 'Server error during authentication check',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
