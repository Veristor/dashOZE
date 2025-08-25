/**
 * Enspirion Dashboard - Utility Functions
 * Funkcje pomocnicze używane w całej aplikacji
 */

// Namespace for utilities
window.EnspirionUtils = {
    /**
     * Format number with Polish locale
     */
    formatNumber(value, type = 'number', decimals = 2) {
        if (value === null || value === undefined || isNaN(value)) {
            return '--';
        }

        const options = {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        };

        switch (type) {
            case 'currency':
                return new Intl.NumberFormat('pl-PL', {
                    style: 'currency',
                    currency: 'PLN',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }).format(value);
            
            case 'percentage':
                return new Intl.NumberFormat('pl-PL', {
                    style: 'percent',
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                }).format(value / 100);
            
            case 'power':
                return new Intl.NumberFormat('pl-PL', options).format(value);
            
            default:
                return new Intl.NumberFormat('pl-PL', options).format(value);
        }
    },

    /**
     * Format date/time
     */
    formatDateTime(date, format = 'short') {
        if (!date) return '--';
        
        const dateObj = date instanceof Date ? date : new Date(date);
        
        switch (format) {
            case 'time':
                return dateObj.toLocaleTimeString('pl-PL', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            
            case 'date':
                return dateObj.toLocaleDateString('pl-PL');
            
            case 'short':
                return dateObj.toLocaleString('pl-PL', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            
            case 'full':
                return dateObj.toLocaleString('pl-PL');
            
            default:
                return dateObj.toISOString();
        }
    },

    /**
     * Calculate time difference
     */
    getTimeDifference(date1, date2 = new Date()) {
        const diff = Math.abs(date2 - date1);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} dni`;
        if (hours > 0) return `${hours} godz.`;
        return `${minutes} min`;
    },

    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Deep clone object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Object) {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    },

    /**
     * Get cookie value
     */
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    },

    /**
     * Set cookie
     */
    setCookie(name, value, days = 365) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = `expires=${date.toUTCString()}`;
        document.cookie = `${name}=${value};${expires};path=/`;
    },

    /**
     * Parse query string
     */
    parseQueryString(queryString) {
        const params = {};
        const searchParams = new URLSearchParams(queryString);
        for (const [key, value] of searchParams) {
            params[key] = value;
        }
        return params;
    },

    /**
     * Build query string
     */
    buildQueryString(params) {
        return Object.keys(params)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');
    },

    /**
     * Calculate percentage
     */
    calculatePercentage(value, total, decimals = 2) {
        if (!total || total === 0) return 0;
        return ((value / total) * 100).toFixed(decimals);
    },

    /**
     * Linear interpolation
     */
    lerp(start, end, amount) {
        return start + (end - start) * amount;
    },

    /**
     * Clamp value between min and max
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    /**
     * Generate unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Check if mobile device
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    /**
     * Check if touch device
     */
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },

    /**
     * Get screen size category
     */
    getScreenSize() {
        const width = window.innerWidth;
        if (width < 768) return 'mobile';
        if (width < 1024) return 'tablet';
        if (width < 1440) return 'desktop';
        return 'large';
    },

    /**
     * Download data as file
     */
    downloadFile(data, filename, mimeType = 'application/json') {
        const blob = new Blob([data], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    },

    /**
     * Convert CSV to JSON
     */
    csvToJson(csv, delimiter = ',') {
        const lines = csv.split('\n');
        const headers = lines[0].split(delimiter).map(h => h.trim());
        const result = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            const obj = {};
            const currentLine = lines[i].split(delimiter);

            headers.forEach((header, index) => {
                obj[header] = currentLine[index]?.trim() || '';
            });

            result.push(obj);
        }

        return result;
    },

    /**
     * Convert JSON to CSV
     */
    jsonToCsv(json, delimiter = ',') {
        if (!json || json.length === 0) return '';

        const headers = Object.keys(json[0]);
        const csvHeaders = headers.join(delimiter);
        
        const csvRows = json.map(row => {
            return headers.map(header => {
                const value = row[header];
                return typeof value === 'string' && value.includes(delimiter) 
                    ? `"${value}"` 
                    : value;
            }).join(delimiter);
        });

        return [csvHeaders, ...csvRows].join('\n');
    },

    /**
     * Retry function with exponential backoff
     */
    async retry(fn, retries = 3, delay = 1000, backoff = 2) {
        try {
            return await fn();
        } catch (error) {
            if (retries === 0) throw error;
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.retry(fn, retries - 1, delay * backoff, backoff);
        }
    },

    /**
     * Group array by key
     */
    groupBy(array, key) {
        return array.reduce((result, item) => {
            const group = item[key];
            if (!result[group]) result[group] = [];
            result[group].push(item);
            return result;
        }, {});
    },

    /**
     * Calculate moving average
     */
    movingAverage(data, windowSize) {
        if (windowSize <= 0 || windowSize > data.length) return [];
        
        const result = [];
        for (let i = 0; i <= data.length - windowSize; i++) {
            const window = data.slice(i, i + windowSize);
            const average = window.reduce((sum, val) => sum + val, 0) / windowSize;
            result.push(average);
        }
        
        return result;
    },

    /**
     * Calculate standard deviation
     */
    standardDeviation(values) {
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
        const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
        return Math.sqrt(avgSquaredDiff);
    },

    /**
     * Check if value is in range
     */
    inRange(value, min, max) {
        return value >= min && value <= max;
    },

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Validate email
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    /**
     * Get contrast color (black or white) based on background
     */
    getContrastColor(hexColor) {
        // Convert hex to RGB
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);
        
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }
};

// Shorthand
window.Utils = window.EnspirionUtils;

console.log('✅ Utils loaded successfully');