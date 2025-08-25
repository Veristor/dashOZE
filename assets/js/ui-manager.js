/**
 * Enspirion Dashboard - UI Manager
 * Zarządzanie interfejsem użytkownika
 */

class UIManager {
    constructor() {
        this.notifications = [];
        this.modals = new Map();
        this.activeView = 'overview';
        this.theme = 'light';
        
        console.log('🎨 UI Manager initialized');
    }

    /**
     * Initialize UI components
     */
    initialize() {
        this.setupTheme();
        this.setupResponsive();
        this.setupAccessibility();
        this.initializeTooltips();
        this.initializeModals();
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info', duration = 5000) {
        const id = window.Utils.generateId();
        const notification = {
            id,
            message,
            type,
            timestamp: new Date()
        };

        this.notifications.push(notification);
        this.renderNotification(notification);

        if (duration > 0) {
            setTimeout(() => this.removeNotification(id), duration);
        }

        return id;
    }

    /**
     * Render notification
     */
    renderNotification(notification) {
        // Check if container exists
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }

        const element = document.createElement('div');
        element.id = `notification-${notification.id}`;
        element.className = `notification notification-${notification.type} notification-enter`;
        
        const icon = this.getNotificationIcon(notification.type);
        const closeBtn = '<button class="notification-close" onclick="window.UIManager.removeNotification(\'' + notification.id + '\')">×</button>';
        
        element.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icon}</span>
                <span class="notification-message">${notification.message}</span>
            </div>
            ${closeBtn}
        `;

        container.appendChild(element);

        // Trigger animation
        setTimeout(() => {
            element.classList.remove('notification-enter');
        }, 10);
    }

    /**
     * Remove notification
     */
    removeNotification(id) {
        const element = document.getElementById(`notification-${id}`);
        if (element) {
            element.classList.add('notification-exit');
            setTimeout(() => {
                element.remove();
                this.notifications = this.notifications.filter(n => n.id !== id);
            }, 300);
        }
    }

    /**
     * Get notification icon
     */
    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    /**
     * Show loading overlay
     */
    showLoading(message = 'Ładowanie...') {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-message">${message}</div>
            </div>
        `;

        overlay.style.display = 'flex';
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * Show modal
     */
    showModal(id, options = {}) {
        const modal = document.getElementById(id);
        if (!modal) {
            console.error(`Modal ${id} not found`);
            return;
        }

        // Set options
        if (options.title) {
            const titleElement = modal.querySelector('.modal-title, h3');
            if (titleElement) titleElement.textContent = options.title;
        }

        if (options.content) {
            const contentElement = modal.querySelector('.modal-body');
            if (contentElement) contentElement.innerHTML = options.content;
        }

        // Show modal
        modal.style.display = 'flex';
        modal.classList.add('modal-open');

        // Store in active modals
        this.modals.set(id, modal);

        // Add backdrop click handler
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideModal(id);
            }
        });
    }

    /**
     * Hide modal
     */
    hideModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('modal-closing');
            setTimeout(() => {
                modal.style.display = 'none';
                modal.classList.remove('modal-open', 'modal-closing');
                this.modals.delete(id);
            }, 300);
        }
    }

    /**
     * Update view
     */
    updateView(viewName) {
        // Hide all sections
        document.querySelectorAll('.dashboard-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show target section
        const targetSection = document.getElementById(`${viewName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            this.activeView = viewName;
        }

        // Update navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.view === viewName) {
                tab.classList.add('active');
            }
        });
    }

    /**
     * Update status indicators
     */
    updateStatus(type, status, message) {
        const statusElements = {
            api: {
                dot: 'api-status-dot',
                text: 'api-status-text'
            },
            data: {
                dot: 'data-status-dot',
                text: 'last-update-text'
            }
        };

        const elements = statusElements[type];
        if (!elements) return;

        const dot = document.getElementById(elements.dot);
        const text = document.getElementById(elements.text);

        if (dot) {
            dot.className = `status-dot ${status}`;
        }

        if (text && message) {
            text.textContent = message;
        }
    }

    /**
     * Setup theme
     */
    setupTheme() {
        // Check for saved theme preference
        const savedTheme = localStorage.getItem('enspirion-theme') || 'light';
        this.setTheme(savedTheme);
    }

    /**
     * Set theme
     */
    setTheme(theme) {
        this.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('enspirion-theme', theme);
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        const newTheme = this.theme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    /**
     * Setup responsive behavior
     */
    setupResponsive() {
        // Handle resize events
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 250);
        });

        // Initial check
        this.handleResize();
    }

    /**
     * Handle window resize
     */
    handleResize() {
        const screenSize = window.Utils.getScreenSize();
        document.documentElement.setAttribute('data-screen', screenSize);

        // Adjust chart sizes for mobile
        if (screenSize === 'mobile') {
            this.adjustMobileLayout();
        } else {
            this.resetDesktopLayout();
        }
    }

    /**
     * Adjust mobile layout
     */
    adjustMobileLayout() {
        // Stack charts vertically on mobile
        const chartsGrid = document.querySelector('.charts-grid');
        if (chartsGrid) {
            chartsGrid.style.gridTemplateColumns = '1fr';
        }
    }

    /**
     * Reset desktop layout
     */
    resetDesktopLayout() {
        const chartsGrid = document.querySelector('.charts-grid');
        if (chartsGrid) {
            chartsGrid.style.gridTemplateColumns = '';
        }
    }

    /**
     * Setup accessibility
     */
    setupAccessibility() {
        // Skip navigation link
        this.createSkipLink();

        // Keyboard navigation
        this.setupKeyboardNavigation();

        // ARIA live regions
        this.setupAriaLiveRegions();
    }

    /**
     * Create skip link
     */
    createSkipLink() {
        const skipLink = document.createElement('a');
        skipLink.href = '#main';
        skipLink.className = 'skip-link';
        skipLink.textContent = 'Skip to main content';
        document.body.insertBefore(skipLink, document.body.firstChild);
    }

    /**
     * Setup keyboard navigation
     */
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Escape key closes modals
            if (e.key === 'Escape') {
                this.modals.forEach((modal, id) => {
                    this.hideModal(id);
                });
            }

            // Tab navigation for nav items
            if (e.key === 'Tab') {
                const activeElement = document.activeElement;
                if (activeElement.classList.contains('nav-tab')) {
                    // Handle tab navigation
                }
            }
        });
    }

    /**
     * Setup ARIA live regions
     */
    setupAriaLiveRegions() {
        // Status updates
        const statusElements = document.querySelectorAll('[id$="-status-text"]');
        statusElements.forEach(element => {
            element.setAttribute('role', 'status');
            element.setAttribute('aria-live', 'polite');
        });

        // Notifications
        const notificationContainer = document.getElementById('notification-container');
        if (notificationContainer) {
            notificationContainer.setAttribute('role', 'alert');
            notificationContainer.setAttribute('aria-live', 'assertive');
        }
    }

    /**
     * Initialize tooltips
     */
    initializeTooltips() {
        // Simple tooltip implementation
        document.addEventListener('mouseover', (e) => {
            const element = e.target;
            if (element.hasAttribute('data-tooltip')) {
                this.showTooltip(element);
            }
        });

        document.addEventListener('mouseout', (e) => {
            const element = e.target;
            if (element.hasAttribute('data-tooltip')) {
                this.hideTooltip();
            }
        });
    }

    /**
     * Show tooltip
     */
    showTooltip(element) {
        const text = element.getAttribute('data-tooltip');
        if (!text) return;

        const tooltip = document.createElement('div');
        tooltip.id = 'tooltip';
        tooltip.className = 'tooltip';
        tooltip.textContent = text;

        document.body.appendChild(tooltip);

        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';

        // Show animation
        setTimeout(() => {
            tooltip.classList.add('tooltip-visible');
        }, 10);
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        const tooltip = document.getElementById('tooltip');
        if (tooltip) {
            tooltip.classList.remove('tooltip-visible');
            setTimeout(() => {
                tooltip.remove();
            }, 200);
        }
    }

    /**
     * Initialize modals
     */
    initializeModals() {
        // Setup close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.hideModal(modal.id);
                }
            });
        });
    }

    /**
     * Confirm dialog
     */
    async confirm(message, options = {}) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal confirm-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${options.title || 'Potwierdzenie'}</h3>
                    </div>
                    <div class="modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="action-btn btn-primary" onclick="window.UIManager.confirmResolve(true)">
                            ${options.confirmText || 'Tak'}
                        </button>
                        <button class="action-btn btn-secondary" onclick="window.UIManager.confirmResolve(false)">
                            ${options.cancelText || 'Nie'}
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            modal.style.display = 'flex';

            this.confirmResolve = (result) => {
                modal.remove();
                resolve(result);
            };
        });
    }

    /**
     * Update progress bar
     */
    updateProgress(progress, message) {
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('loading-text');

        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }

        if (progressText && message) {
            progressText.textContent = message;
        }
    }

    /**
     * Format display values
     */
    formatValue(value, type = 'number') {
        return window.Utils.formatNumber(value, type);
    }

    /**
     * Update element text content safely
     */
    updateElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }

    /**
     * Toggle element visibility
     */
    toggleElement(elementId, show) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.display = show ? '' : 'none';
        }
    }

    /**
     * Add/remove CSS class
     */
    toggleClass(elementId, className, add) {
        const element = document.getElementById(elementId);
        if (element) {
            if (add) {
                element.classList.add(className);
            } else {
                element.classList.remove(className);
            }
        }
    }
}

// Create global UI manager instance
window.UIManager = new UIManager();

// Export for modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
}

console.log('✅ UI Manager loaded successfully');