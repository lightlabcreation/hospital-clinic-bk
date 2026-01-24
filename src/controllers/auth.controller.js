// ====================================
// AUTH CONTROLLER
// ====================================
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { generateToken } = require('../config/jwt');
const { successResponse, errorResponse } = require('../utils/response.helper');

// ====================================
// LOGIN
// ====================================
const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        // Validate input
        if (!email || !password || !role) {
            return errorResponse(res, 'Email, password and role are required', 400);
        }

        // Find user by email and role
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ? AND role = ?',
            [email, role]
        );

        if (users.length === 0) {
            return errorResponse(res, 'Invalid credentials', 401);
        }

        const user = users[0];

        // Check if user is active
        if (user.status !== 'Active') {
            return errorResponse(res, 'Account is inactive. Contact admin.', 403);
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return errorResponse(res, 'Invalid credentials', 401);
        }

        // Get additional info based on role
        let additionalInfo = {};

        if (role === 'DOCTOR') {
            const [doctors] = await db.query(
                'SELECT id, specialization, qualification FROM doctors WHERE user_id = ?',
                [user.id]
            );
            if (doctors.length > 0) {
                additionalInfo = {
                    doctorId: doctors[0].id,
                    specialization: doctors[0].specialization,
                    qualification: doctors[0].qualification
                };
            }
        } else if (role === 'STAFF') {
            const [staffMembers] = await db.query(
                'SELECT id FROM staff WHERE user_id = ?',
                [user.id]
            );
            if (staffMembers.length > 0) {
                additionalInfo = { staffId: staffMembers[0].id };
            }
        }

        // Generate token
        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            ...additionalInfo
        });

        // Response
        successResponse(res, {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                ...additionalInfo
            }
        }, 'Login successful');

    } catch (error) {
        console.error('Login Error:', error);
        errorResponse(res, 'Login failed', 500, error.message);
    }
};

// ====================================
// GET CURRENT USER (ME)
// ====================================
const getMe = async (req, res) => {
    try {
        const user = req.user;

        // Get additional info based on role
        let additionalInfo = {};

        if (user.role === 'DOCTOR') {
            const [doctors] = await db.query(
                'SELECT id, specialization, qualification, mobile FROM doctors WHERE user_id = ?',
                [user.id]
            );
            if (doctors.length > 0) {
                additionalInfo = doctors[0];
            }
        } else if (user.role === 'STAFF') {
            const [staffMembers] = await db.query(
                'SELECT id, mobile FROM staff WHERE user_id = ?',
                [user.id]
            );
            if (staffMembers.length > 0) {
                additionalInfo = staffMembers[0];
            }
        }

        successResponse(res, {
            ...user,
            ...additionalInfo
        }, 'User fetched successfully');

    } catch (error) {
        console.error('Get Me Error:', error);
        errorResponse(res, 'Failed to fetch user', 500, error.message);
    }
};

// ====================================
// LOGOUT (Optional - Token based)
// ====================================
const logout = async (req, res) => {
    // Since we're using JWT, logout is handled on frontend
    // by removing the token from localStorage
    successResponse(res, null, 'Logged out successfully');
};

// ====================================
// UPDATE PROFILE
// ====================================
const updateProfile = async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.user.id;

        if (!name || name.trim() === '') {
            return errorResponse(res, 'Name is required', 400);
        }

        // Update user name
        await db.query('UPDATE users SET name = ? WHERE id = ?', [name.trim(), userId]);

        // Get updated user
        const [users] = await db.query('SELECT id, email, name, role FROM users WHERE id = ?', [userId]);

        if (users.length === 0) {
            return errorResponse(res, 'User not found', 404);
        }

        successResponse(res, users[0], 'Profile updated successfully');

    } catch (error) {
        console.error('Update Profile Error:', error);
        errorResponse(res, 'Failed to update profile', 500, error.message);
    }
};

// ====================================
// CHANGE PASSWORD
// ====================================
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return errorResponse(res, 'Current password and new password are required', 400);
        }

        if (newPassword.length < 6) {
            return errorResponse(res, 'New password must be at least 6 characters long', 400);
        }

        // Get current user
        const [users] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);

        if (users.length === 0) {
            return errorResponse(res, 'User not found', 404);
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);

        if (!isValidPassword) {
            return errorResponse(res, 'Current password is incorrect', 401);
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

        successResponse(res, null, 'Password changed successfully');

    } catch (error) {
        console.error('Change Password Error:', error);
        errorResponse(res, 'Failed to change password', 500, error.message);
    }
};

module.exports = {
    login,
    getMe,
    logout,
    updateProfile,
    changePassword
};
