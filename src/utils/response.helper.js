// ====================================
// RESPONSE HELPER UTILITIES
// ====================================

// Success Response
const successResponse = (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

// Error Response
const errorResponse = (res, message = 'Error', statusCode = 500, error = null) => {
    const response = {
        success: false,
        message
    };

    if (error && process.env.NODE_ENV === 'development') {
        response.error = error;
    }

    return res.status(statusCode).json(response);
};

// Pagination Helper
const paginate = (page = 1, limit = 10) => {
    const offset = (parseInt(page) - 1) * parseInt(limit);
    return {
        limit: parseInt(limit),
        offset
    };
};

// Format Date for MySQL
const formatDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().split('T')[0];
};

// Format Time for MySQL
const formatTime = (time) => {
    if (!time) return null;
    // Handle various time formats
    if (time.includes('AM') || time.includes('PM')) {
        // Convert 12-hour to 24-hour format
        const [timeStr, modifier] = time.split(' ');
        let [hours, minutes] = timeStr.split(':');
        hours = parseInt(hours);

        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;

        return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
    }
    return time;
};

module.exports = {
    successResponse,
    errorResponse,
    paginate,
    formatDate,
    formatTime
};
