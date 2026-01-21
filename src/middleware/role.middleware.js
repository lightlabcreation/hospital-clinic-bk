// ====================================
// ROLE-BASED ACCESS MIDDLEWARE
// ====================================

// Check if user has required role
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required.'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
            });
        }

        next();
    };
};

// Middleware for Admin only
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin only.'
        });
    }
    next();
};

// Middleware for Staff only
const isStaff = (req, res, next) => {
    if (req.user.role !== 'STAFF') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Staff only.'
        });
    }
    next();
};

// Middleware for Doctor only
const isDoctor = (req, res, next) => {
    if (req.user.role !== 'DOCTOR') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Doctor only.'
        });
    }
    next();
};

module.exports = {
    authorizeRoles,
    isAdmin,
    isStaff,
    isDoctor
};
