/**
 * Enspirion Dashboard - Main Application
 * Główna aplikacja zarządzająca dashboardem energetycznym
 * 
 * @class EnspirionApp
 * @description Centralne zarządzanie aplikacją, danymi i stanem UI
 */

class EnspirionApp {
    constructor() {
        // Application state
        this.state = {
            isInitialized: false,
            currentView: 'monitoring',
            autoRefreshEnabled: true,
            isLoading: false,
            apiConnected: false
        };
        
        // Data storage
        this.data = {
            current: {},
            historical: {},
            forecast: {},
            lastUpdate: null
        };
        
        // Intervals and timeouts
        this.intervals = {
            autoRefresh: null,
            dataRefresh: null
        };
        
        // Configuration
        this.config = {
            refreshInterval: 30000, // 30 seconds (zmienione z 5s)
            apiTimeout: 10000,      // 10 seconds
            retryDelay: 2000       // 2 seconds
        };
        
        console.log('🚀 Enspirion Dashboard initializing...');
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            // Show loading screen
            this.showLoadingScreen('Inicjalizacja systemu...');
            
            // Step 1: Initialize UI Manager
            await this.initializeUI();
            this.updateProgress(20);
            
            // Step 2: Setup event listeners
            this.setupEventListeners();
            this.updateProgress(30);
            this.addClickListener('refresh-forecast', () => this.loadForecastData());
            this.addChangeListener('forecast-period', () => this.loadForecastData());
            this.addChangeListener('show-weekends', () => this.loadForecastData());
            // DODAJ TE LINIE dla kontrolek prognoz:
    this.addClickListener('refresh-forecast', () => this.loadForecastData());
    this.addChangeListener('forecast-period', () => this.loadForecastData());
    this.addChangeListener('show-weekends', () => this.loadForecastData());
            // Step 3: Initialize Chart Manager
            await this.initializeCharts();
            this.updateProgress(50);
            
            // Step 4: Test API connectivity
            const apiConnected = await this.testAPIConnectivity();
            this.state.apiConnected = apiConnected;
            this.updateProgress(70);
            
            // Step 5: Load initial data
            await this.loadInitialData();
            this.updateProgress(90);
            
            // Step 6: Start auto refresh
            if (this.state.autoRefreshEnabled) {
                this.startAutoRefresh();
            }
            
            // Step 7: Setup additional features
            this.setupAdditionalFeatures();
            this.updateProgress(100);
            
            // Complete initialization
            setTimeout(() => {
                this.hideLoadingScreen();
                this.state.isInitialized = true;
                console.log('✅ Enspirion Dashboard initialized successfully');
            }, 500);
            
        } catch (error) {
            console.error('❌ App initialization failed:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Initialize UI components
     */
    async initializeUI() {
        window.UIManager.initialize();
        console.log('✅ UI Manager initialized');
    }

    /**
 * Initialize charts
 */
async initializeCharts() {
    // Poczekaj aż ChartManager będzie dostępny
    if (!window.ChartManager) {
        console.warn('ChartManager not loaded yet, waiting...');
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (window.ChartManager) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }
    
    await window.ChartManager.initializeCharts();
    console.log('✅ Chart Manager initialized');
}
    /**
     * Test API connectivity
     */
    async testAPIConnectivity() {
        try {
            window.UIManager.updateStatus('api', 'connecting', 'Łączenie z PSE API...');
            
            const testUrl = 'https://apimpdv2-bmgdhhajexe8aade.a01.azurefd.net/api/pdgobpkd?$first=1';
            const response = await fetch(testUrl, { 
                signal: AbortSignal.timeout(this.config.apiTimeout) 
            });
            
            if (response.ok) {
                window.UIManager.updateStatus('api', 'connected', 'PSE API: Online');
                console.log('✅ PSE API connection successful');
                return true;
            } else {
                throw new Error(`API response: ${response.status}`);
            }
        } catch (error) {
            console.warn('⚠️ PSE API connection failed:', error);
            window.UIManager.updateStatus('api', 'error', 'PSE API: Offline');
            window.UIManager.showNotification(
                'Brak połączenia z PSE API. Używam danych testowych.', 
                'warning'
            );
            return false;
        }
    }

    /**
     * Setup additional features
     */
    setupAdditionalFeatures() {
        // Chart hover effects for PV distribution
        const chartEl = document.getElementById('pv-distribution-chart');
        const statsBox = document.getElementById('pv-stats-box');

        if (chartEl && statsBox) {
            chartEl.addEventListener('mouseenter', () => {
                statsBox.style.opacity = '0';
            });
            chartEl.addEventListener('mouseleave', () => {
                statsBox.style.opacity = '1';
            });
        }
    }

    // ========================================
    // DATA LOADING
    // ========================================

    /**
     * Load initial data
     */
    async loadInitialData() {
        try {
            this.showChartLoading();
            this.state.isLoading = true;
            
            // Fetch all dashboard data
            const data = await window.PSEApiService.getAllDashboardData();
            this.data.current = data;
            this.data.lastUpdate = new Date();
            
            // Process additional data
            await this.processData(data);
            
            // Update UI components
            this.updateUI(data);
            
            // Load forecast data
            await this.loadForecastData();
            
            this.hideChartLoading();
            this.state.isLoading = false;
            
        } catch (error) {
            console.error('❌ Failed to load initial data:', error);
            this.handleDataError(error);
        }
    }

    /**
     * Process fetched data
     */
    async processData(data) {
        // Calculate portfolio analysis
        if (window.PortfolioCalculator && data.pvGeneration) {
            const portfolioAnalysis = await window.PortfolioCalculator.getPortfolioAnalysis(
                data.pvGeneration,
                data.systemLoad,
                data.prices,
                data.constraints
            );
            this.data.portfolioAnalysis = portfolioAnalysis;
        }
        
        // Calculate risk heatmap
        if (window.RiskCalculator && data.constraints) {
            const riskData = window.RiskCalculator.calculateRiskHeatmap(
                [],
                data.constraints || [],
                {
                    pvGeneration: data.pvGeneration || [],
                    systemLoad: data.systemLoad || []
                }
            );
            this.data.riskHeatmap = riskData;
        }
    }

    /**
     * Update all UI components
     */
    updateUI(data) {
        // Update indicators
        this.updateRealTimeIndicators(data);
        
        // Update charts
        this.updateCharts(data);
        
        // Update data table
        this.updateDataTable(data);
        
        // Update constraints
        this.updateConstraints(data.constraints);
        
        // Update status
        const updateTime = new Date().toLocaleTimeString('pl-PL');
        window.UIManager.updateStatus('data', 'connected', `Aktualizacja: ${updateTime}`);
    }

    /**
     * Load forecast data from PSE API
     */
    async loadForecastData() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const url = `https://v2.api.raporty.pse.pl/api/pdgobpkd?$filter=business_date eq '${today}'&$orderby=dtime asc&$first=20000`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch forecast data');
            
            const json = await response.json();
            const forecastData = this.parseForecastData(json.value);
            
            // Update generation forecast chart
            window.ChartManager.updateGenerationForecastChart(forecastData);
            
        } catch (error) {
            console.error('❌ Failed to load forecast data:', error);
        }
    }

    /**
     * Parse forecast data from API response
     */
    parseForecastData(rawData) {
    return rawData.map(row => {
        const time = new Date(row.dtime);
        const timeStr = time.toLocaleTimeString('pl-PL', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Oblicz wartości zgodnie z metodologią PSE
        const gen_not_activ_part = parseFloat(row.gen_not_activ_part || 0);
        const gen_fv = parseFloat(row.gen_fv || 0);
        const gen_wi = parseFloat(row.gen_wi || 0);
        
        // JW spoza RB = JW nieuczestniczące - PV - Wiatr
        const gen_spoza_rb = Math.max(0, gen_not_activ_part - gen_fv - gen_wi);
        
        // Debug
        if (row.dtime && row.dtime.includes('10:00')) {
            console.log('Debug 10:00:', {
                gen_not_activ_part,
                gen_fv,
                gen_wi,
                gen_spoza_rb_calculated: gen_spoza_rb
            });
        }
        
        return {
            time: timeStr,
            gen_rb: this.sumValues([
                row.gen_jgw_zak_1, row.gen_jgw_zak_2,
                row.gen_jgm_zak_1, row.gen_jgm_zak_2,
                row.gen_jgz_zak_1, row.gen_jgz_zak_2, row.gen_jgz_zak_3
            ]),
            gen_spoza_rb: gen_spoza_rb,
            gen_fv: gen_fv,
            gen_wi: gen_wi,
            demand: parseFloat(row.kse_pow_dem || 0)
        };
    });
}

    // ========================================
    // UI UPDATES
    // ========================================

    /**
     * Update real-time indicators in header
     */
    updateRealTimeIndicators(data) {
        if (!data.fullGenerationData || data.fullGenerationData.length === 0) {
            console.warn('No generation data available');
            return;
        }

        const currentData = this.getCurrentPeriodData(data.fullGenerationData);
        
        if (currentData) {
            const pvTotal = parseFloat(currentData.gen_fv) || 0;
            const kseLoad = parseFloat(currentData.kse_pow_dem) || 0;
            const pvShare = kseLoad > 0 ? (pvTotal / kseLoad) * 100 : 0;
            
            // Update header indicators
            this.updateElement('pv-total-now', `${pvTotal.toFixed(0)} MW`);
            this.updateElement('kse-load-now', `${kseLoad.toFixed(0)} MW`);
            this.updateElement('pv-share-now', `${pvShare.toFixed(1)}%`);
            
            // Update KPI cards
            this.updateElement('pv-generation', `${pvTotal.toFixed(0).toLocaleString('pl-PL')} MW`);
            this.updateElement('system-load', `${kseLoad.toFixed(0).toLocaleString('pl-PL')} MW`);
            this.updateElement('pv-percentage', `${pvShare.toFixed(1)}%`);
            
            // Update timestamp
            const periodInfo = this.getPeriodInfo(currentData);
            window.UIManager.updateStatus('data', 'connected', periodInfo);
        }
        
        // Update constraints count
        this.updateElement('active-constraints', data.constraints?.length || '0');
        
        // Update trends
        this.updateTrends(data);
    }

    /**
     * Get current 15-minute period data
     */
    getCurrentPeriodData(fullData) {
        const now = new Date();
        const currentQuarter = Math.floor(now.getMinutes() / 15);
        const expectedEndTime = new Date(now);
        expectedEndTime.setMinutes((currentQuarter + 1) * 15, 0, 0);
        
        // Find data for current period
        let currentData = fullData.find(item => {
            const itemTime = new Date(item.dtime);
            return itemTime.getHours() === expectedEndTime.getHours() &&
                   itemTime.getMinutes() === expectedEndTime.getMinutes();
        });
        
        // If not found, try previous period
        if (!currentData) {
            expectedEndTime.setMinutes(expectedEndTime.getMinutes() - 15);
            currentData = fullData.find(item => {
                const itemTime = new Date(item.dtime);
                return itemTime.getHours() === expectedEndTime.getHours() &&
                       itemTime.getMinutes() === expectedEndTime.getMinutes();
            });
        }
        
        return currentData;
    }

    /**
     * Get period info string
     */
    getPeriodInfo(data) {
        const endTime = new Date(data.dtime);
        const startTime = new Date(endTime);
        startTime.setMinutes(startTime.getMinutes() - 15);
        
        return `Dane: ${startTime.toLocaleTimeString('pl-PL', {hour: '2-digit', minute: '2-digit'})}-${endTime.toLocaleTimeString('pl-PL', {hour: '2-digit', minute: '2-digit'})}`;
    }

    /**
     * Update trend indicators
     */
    updateTrends(data) {
        // Simple trend placeholders - can be enhanced with actual calculations
        const trends = [
            { id: 'pv-trend', icon: '→', value: '0 MW/h' },
            { id: 'load-trend', icon: '→', value: '0 MW/h' },
            { id: 'percentage-trend', icon: '→', value: '0 pp' },
            { id: 'constraints-trend', icon: '→', value: '0 MW' }
        ];
        
        trends.forEach(trend => {
            const element = document.getElementById(trend.id);
            if (element) {
                element.querySelector('.trend-icon').textContent = trend.icon;
                element.querySelector('.trend-value').textContent = trend.value;
            }
        });
    }

    /**
     * Update all charts
     */
    updateCharts(data) {

            // Przekaż dane do ChartManager
        if (window.ChartManager.setCurrentData) {
            window.ChartManager.setCurrentData(data);
        }
        // Update generation forecast chart
        if (data.fullGenerationData) {
            const forecastData = this.parseForecastData(data.fullGenerationData);
            window.ChartManager.updateGenerationForecastChart(forecastData);
        }
        
        // Update risk heatmap - teraz używa nowego scorera
        if (this.data.riskHeatmap) {
        window.ChartManager.updateRiskHeatmap(this.data.riskHeatmap);
        }
        // Update PV distribution chart
        if (data.pvDistribution) {
            window.ChartManager.updatePVDistributionChart(data.pvDistribution);
        }
        
        // Update constraints display
        if (data.constraints) {
            window.ChartManager.updateConstraintsDisplay(data.constraints);
        }
        
        // Trigger PSE reserves chart update if on constraints tab
        const constraintsSection = document.getElementById('constraints-section');
        if (constraintsSection && constraintsSection.classList.contains('active')) {
            // Check if chart exists and refresh it periodically
            setTimeout(() => {
                if (window.ChartManager.refreshConstraintsChart) {
                    window.ChartManager.refreshConstraintsChart();
                }
            }, 100);
        }
        // Update risk assessment chart z rzeczywistymi danymi
    if (window.ChartManager.updateRiskAssessmentChart) {
        console.log('Updating risk assessment with data:', {
            systemLoadSample: data.systemLoad?.[12], // Przykład dla godziny 12
            pvGenerationSample: data.pvGeneration?.[12],
            systemBalanceSample: data.systemBalance?.[12]
        });
        window.ChartManager.updateRiskAssessmentChart(data);
    }
    }

    /**
     * Update real-time data table
     */
    updateDataTable(data) {
        const tbody = document.getElementById('realtime-tbody');
    if (!tbody) {
        console.warn('Table tbody not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!data.fullGenerationData || data.fullGenerationData.length === 0) {
        console.warn('No generation data available for table');
        return;
    }
    
        
        // Show last 96 entries (24 hours of 15-minute data)
        const recentData = data.fullGenerationData.slice(-96);
        
        recentData.forEach((item, index) => {
            const row = this.createDataTableRow(item, index > 0 ? recentData[index - 1] : null);
            tbody.appendChild(row);
        });
        
        // Auto-scroll to bottom
        const tableWrapper = tbody.closest('.table-wrapper');
        if (tableWrapper) {
            tableWrapper.scrollTop = tableWrapper.scrollHeight;
        }
    }

    /**
     * Create data table row
     */
    createDataTableRow(data, prevData) {
    const time = new Date(data.dtime);
    time.setMinutes(time.getMinutes() - 15); // Show period start
    
    const pvGen = parseFloat(data.gen_fv) || 0;
    const systemLoad = parseFloat(data.kse_pow_dem) || 0;
    const pvShare = systemLoad > 0 ? (pvGen / systemLoad) * 100 : 0;
    
    // Calculate gradient
    let gradient = 0;
    if (prevData) {
        const prevPV = parseFloat(prevData.gen_fv) || 0;
        gradient = (pvGen - prevPV) / 15; // Change per minute
    }
    
    const row = document.createElement('tr');
    
    // Format gradient with color
    const gradientClass = gradient > 0 ? 'gradient-positive' : gradient < 0 ? 'gradient-negative' : '';
    const gradientSign = gradient > 0 ? '+' : '';
    
    row.innerHTML = `
        <td>${time.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${pvGen.toFixed(1)}</td>
        <td>${systemLoad.toFixed(1)}</td>
        <td>${pvShare.toFixed(1)}</td>
        <td class="${gradientClass}">${gradientSign}${gradient.toFixed(1)}</td>
    `;
    
    return row;
}

    /**
     * Update constraints display
     */
    updateConstraints(constraints) {
        if (window.ChartManager.updateConstraintsDisplay) {
            window.ChartManager.updateConstraintsDisplay(constraints || []);
        }
    }

    // ========================================
    // EVENT LISTENERS
    // ========================================

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Navigation
        this.setupNavigationListeners();
        
        // Controls
        this.setupControlListeners();
        
        // Modals
        this.setupModalListeners();
        
        // Chart controls
        this.setupChartControlListeners();
        
        // Window events
        this.setupWindowListeners();
        
        console.log('✅ Event listeners setup complete');
    }

    /**
     * Setup navigation listeners
     */
    setupNavigationListeners() {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });
    }

    /**
     * Setup control listeners
     */
    setupControlListeners() {
        // Refresh button
        this.addClickListener('refresh-all-btn', () => this.manualRefresh());
        
        // Settings button
        this.addClickListener('settings-btn', () => this.openSettings());
        
        // Export button
        this.addClickListener('export-data', () => this.exportData());
        
        // Auto-refresh toggle
        const autoRefreshToggle = document.getElementById('auto-refresh');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                this.state.autoRefreshEnabled = e.target.checked;
                if (this.state.autoRefreshEnabled) {
                    this.startAutoRefresh();
                } else {
                    this.stopAutoRefresh();
                }
            });
        }
    }

    /**
     * Setup modal listeners
     */
    setupModalListeners() {
        // Error modal
        this.addClickListener('retry-btn', () => {
            window.UIManager.hideModal('error-modal');
            this.manualRefresh();
        });
        
        this.addClickListener('dismiss-error-btn', () => {
            window.UIManager.hideModal('error-modal');
        });
        
        // Settings modal
        this.addClickListener('save-settings-btn', () => this.saveSettings());
        this.addClickListener('cancel-settings-btn', () => {
            window.UIManager.hideModal('settings-modal');
        });
    }

    /**
     * Setup chart control listeners
     */
    setupChartControlListeners() {
        // Period buttons
        document.querySelectorAll('.chart-btn[data-period]').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleChartPeriodChange(e));
        });
        
        // Refresh buttons
        document.querySelectorAll('.refresh-chart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartType = e.currentTarget.dataset.chart;
                this.refreshChart(chartType);
            });
        });
    }

    /**
     * Setup window listeners
     */
    setupWindowListeners() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.handleWindowResize(), 250);
        });
    }

    // ========================================
    // VIEW MANAGEMENT
    // ========================================

    /**
     * Switch view
     */
    // W metodzie switchView dodaj:
switchView(viewName) {
    window.UIManager.updateView(viewName);
    this.state.currentView = viewName;
    
    // Load view-specific data
    if (viewName === 'analysis') {
        this.loadForecastData();
    } else if (viewName === 'constraints') {
        setTimeout(() => {
            if (window.ChartManager && window.ChartManager.refreshConstraintsChart) {
                window.ChartManager.refreshConstraintsChart();
            }
        }, 200);
    } else if (viewName === 'grid') {
        // Nowe - ładuj dane dla zakładki Sieć
        this.loadGridData();
    }
}

/**
 * Load grid data
 */
async loadGridData() {
    try {
        // Inicjalizuj wykres jeśli nie istnieje
        if (!window.ChartManager.charts.has('kse-demand')) {
            window.ChartManager.createKSEDemandChart();
        }
        
        // Pokaż loading
        this.showChartLoading('kse-demand');
        
        // Pobierz dane
        const data = await window.PSEApiService.getKSEDemandData('today');
        
        // Aktualizuj wykres
        window.ChartManager.updateKSEDemandChart(data);
        
        // Ukryj loading
        this.hideChartLoading('kse-demand');
        
    } catch (error) {
        console.error('Failed to load grid data:', error);
        this.hideChartLoading('kse-demand');
        window.UIManager.showNotification('Błąd ładowania danych sieci', 'error');
    }
}

async loadForecastData() {
    try {
        this.showChartLoading('forecast');
        
        // Pobierz okres z selecta
        const period = document.getElementById('forecast-period')?.value || 3;
        const showWeekends = document.getElementById('show-weekends')?.checked || false;
        
        // Pobierz dane prognoz
        const forecastData = await window.PSEApiService.getForecastData(parseInt(period));
        
        // Filtruj weekendy jeśli potrzeba
        const filteredData = showWeekends ? forecastData : 
            forecastData.filter(d => {
                const day = d.timestamp.getDay();
                return day !== 0 && day !== 6;
            });
        
        // Aktualizuj wykres
        if (!window.ChartManager.charts.has('forecast')) {
            window.ChartManager.createForecastChart();
        }
        window.ChartManager.updateForecastChart(filteredData);
        
        // Aktualizuj tabelę
        this.updateForecastTable(filteredData);
        
        this.hideChartLoading('forecast');
        
    } catch (error) {
        console.error('Failed to load forecast data:', error);
        this.hideChartLoading('forecast');
        window.UIManager.showNotification('Błąd ładowania prognoz', 'error');
    }
}

// Metoda do aktualizacji tabeli:
updateForecastTable(data) {
    const tbody = document.getElementById('forecast-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    data.forEach(item => {
        const row = document.createElement('tr');
        const totalRenewable = item.pvForecast + item.windForecast;
        
        row.innerHTML = `
            <td>${item.timestamp.toLocaleString('pl-PL', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })}</td>
            <td>${item.pvForecast.toFixed(0)}</td>
            <td>${item.windForecast.toFixed(0)}</td>
            <td><strong>${totalRenewable.toFixed(0)}</strong></td>
            <td>${item.demandForecast.toFixed(0)}</td>
            <td class="${item.renewableShare > 50 ? 'text-success' : ''}">${item.renewableShare.toFixed(1)}</td>
            <td>${item.requiredReserve.toFixed(0)}</td>
        `;
        
        tbody.appendChild(row);
    });
}

    // ========================================
    // DATA REFRESH
    // ========================================

    /**
     * Manual refresh
     */
    async manualRefresh() {
        console.log('🔄 Manual refresh triggered');
        
        const btn = document.getElementById('refresh-all-btn');
        if (btn) {
            btn.disabled = true;
            btn.querySelector('.btn-text').textContent = 'Odświeżanie...';
        }
        
        await this.loadInitialData();
        
        if (btn) {
            btn.disabled = false;
            btn.querySelector('.btn-text').textContent = 'Odśwież';
        }
        
        window.UIManager.showNotification('Dane odświeżone', 'success');
    }

    /**
     * Start auto refresh
     */
    startAutoRefresh() {
        this.stopAutoRefresh();
        
        this.intervals.autoRefresh = setInterval(() => {
            if (this.state.autoRefreshEnabled && !this.state.isLoading) {
                console.log('[INFO] Automatyczne odświeżanie...');
                this.loadInitialData();
            }
        }, this.config.refreshInterval);
        
        // Also refresh forecast data less frequently
        this.intervals.dataRefresh = setInterval(() => {
            this.loadForecastData();
        }, 300000); // Every 5 minutes
        
        console.log('⏰ Automatyczne odświeżanie włączone');
    }

    /**
     * Stop auto refresh
     */
    stopAutoRefresh() {
        if (this.intervals.autoRefresh) {
            clearInterval(this.intervals.autoRefresh);
            this.intervals.autoRefresh = null;
        }
        
        if (this.intervals.dataRefresh) {
            clearInterval(this.intervals.dataRefresh);
            this.intervals.dataRefresh = null;
        }
        
        console.log('⏰ Automatyczne odświeżanie wyłączone');
    }

    /**
     * Refresh specific chart
     */
    async refreshChart(chartType) {
        console.log(`🔄 Refreshing ${chartType} chart`);
        
        const btn = document.querySelector(`.refresh-chart-btn[data-chart="${chartType}"]`);
        if (btn) btn.classList.add('rotating');
        
        // Reload chart-specific data
        switch (chartType) {
            case 'generation-forecast':
                await this.loadForecastData();
                break;
            case 'pv-distribution':
                // Reload PV distribution data
                if (this.data.current.pvDistribution) {
                    window.ChartManager.updatePVDistributionChart(this.data.current.pvDistribution);
                }
                break;
            default:
                await this.loadInitialData();
        }
        
        setTimeout(() => {
            if (btn) btn.classList.remove('rotating');
        }, 1000);
    }

    // ========================================
    // SETTINGS
    // ========================================

    /**
     * Open settings modal
     */
    openSettings() {
        window.UIManager.showModal('settings-modal');
        
        // Load current settings
        const settings = this.loadSettings();
        
        // Fill form
        document.getElementById('settings-refresh').value = settings.refreshInterval || '5000';
        document.getElementById('settings-sound').checked = settings.soundEnabled !== false;
        document.getElementById('settings-decimals').value = settings.decimals || '1';
        document.getElementById('settings-animations').checked = settings.animationsEnabled !== false;
        document.getElementById('settings-pv-alert').value = settings.pvAlert || '80';
        document.getElementById('settings-gradient-alert').value = settings.gradientAlert || '100';
    }

    /**
     * Save settings
     */
    saveSettings() {
        const settings = {
            refreshInterval: document.getElementById('settings-refresh').value,
            soundEnabled: document.getElementById('settings-sound').checked,
            decimals: document.getElementById('settings-decimals').value,
            animationsEnabled: document.getElementById('settings-animations').checked,
            pvAlert: document.getElementById('settings-pv-alert').value,
            gradientAlert: document.getElementById('settings-gradient-alert').value
        };
        
        // Update refresh interval
        this.config.refreshInterval = parseInt(settings.refreshInterval);
        if (settings.refreshInterval === '0') {
            this.state.autoRefreshEnabled = false;
            this.stopAutoRefresh();
        } else {
            this.state.autoRefreshEnabled = true;
            this.startAutoRefresh();
        }
        
        // Save to localStorage
        localStorage.setItem('enspirion-settings', JSON.stringify(settings));
        
        // Close modal
        window.UIManager.hideModal('settings-modal');
        window.UIManager.showNotification('Ustawienia zapisane', 'success');
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const stored = localStorage.getItem('enspirion-settings');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Failed to load settings:', error);
            return {};
        }
    }

    // ========================================
    // DATA EXPORT
    // ========================================

    /**
     * Export data to CSV
     */
    exportData() {
        const data = {
            timestamp: new Date().toISOString(),
            pvGeneration: this.data.current.pvGeneration || [],
            systemLoad: this.data.current.systemLoad || [],
            constraints: this.data.current.constraints || [],
            prices: this.data.current.prices || []
        };
        
        const csv = this.convertToCSV(data);
        const filename = `enspirion-data-${new Date().toISOString().slice(0, 10)}.csv`;
        
        window.Utils.downloadFile(csv, filename, 'text/csv');
        window.UIManager.showNotification('Dane wyeksportowane', 'success');
    }

    /**
     * Convert data to CSV format
     */
    convertToCSV(data) {
        const rows = [];
        rows.push(['Hour', 'PV Generation [MW]', 'System Load [MW]', 'PV Share [%]', 'Price [PLN/MWh]']);
        
        for (let hour = 0; hour < 24; hour++) {
            const pv = data.pvGeneration.find(p => p.hour === hour);
            const load = data.systemLoad.find(l => l.hour === hour);
            const price = data.prices.find(p => p.hour === hour);
            
            if (pv && load) {
                const pvShare = (pv.totalPower / load.load) * 100;
                rows.push([
                    `${hour.toString().padStart(2, '0')}:00`,
                    pv.totalPower.toFixed(1),
                    load.load.toFixed(1),
                    pvShare.toFixed(2),
                    price ? price.price.toFixed(0) : '0'
                ]);
            }
        }
        
        return rows.map(row => row.join(',')).join('\n');
    }

    // ========================================
    // UI HELPERS
    // ========================================

    /**
     * Show loading screen
     */
    showLoadingScreen(message = 'Ładowanie...') {
        const loadingScreen = document.getElementById('loading-screen');
        const loadingText = document.getElementById('loading-text');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
            setTimeout(() => loadingScreen.classList.add('active'), 10);
        }
        
        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    /**
     * Hide loading screen
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        
        if (loadingScreen) {
            loadingScreen.classList.remove('active');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
        }
        
        if (app) {
            app.style.display = 'flex';
        }
    }

    /**
     * Update progress bar
     */
    updateProgress(percentage) {
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
    }

    /**
 * Show chart loading state
 */
showChartLoading(chartId) {
    if (chartId) {
        const loadingEl = document.getElementById(`${chartId}-loading`);
        if (loadingEl) {
            loadingEl.style.display = 'flex';
        }
    } else {
        document.querySelectorAll('.chart-loading').forEach(el => {
            el.style.display = 'flex';
        });
    }
}

/**
 * Hide chart loading state
 */
hideChartLoading(chartId) {
    if (chartId) {
        const loadingEl = document.getElementById(`${chartId}-loading`);
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    } else {
        document.querySelectorAll('.chart-loading').forEach(el => {
            el.style.display = 'none';
        });
    }
}

    // ========================================
    // ERROR HANDLING
    // ========================================

    /**
     * Handle initialization error
     */
    handleInitializationError(error) {
        console.error('Initialization error:', error);
        this.hideLoadingScreen();
        this.showErrorModal('Błąd inicjalizacji aplikacji', error.message);
    }

    /**
     * Handle data loading error
     */
    handleDataError(error) {
        console.error('Data loading error:', error);
        this.hideChartLoading();
        this.state.isLoading = false;
        window.UIManager.showNotification(
            'Błąd ładowania danych. Używam danych testowych.', 
            'warning'
        );
    }

    /**
     * Show error modal
     */
    showErrorModal(title, message) {
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.textContent = message || 'Wystąpił nieoczekiwany błąd.';
        }
        window.UIManager.showModal('error-modal');
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Update element text content
     */
    updateElement(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }

    /**
     * Add click listener to element
     */
    addClickListener(id, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', handler);
        }
    }
/**
 * Add click listener to element
 */
addClickListener(id, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('click', handler);
    }
}

/**
 * Add change listener to element
 */
addChangeListener(id, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('change', handler);
    }
}
    /**
     * Sum array of values
     */
    sumValues(values) {
        return values.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    }

    /**
     * Handle chart period change
     */
    handleChartPeriodChange(event) {
        const button = event.target;
        const period = button.dataset.period;
        const container = button.closest('.chart-controls');
        
        // Update active state
        container.querySelectorAll('.chart-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');
        
        console.log(`Chart period changed to: ${period}`);
        // TODO: Implement period-specific data loading
    }

    /**
     * Handle window resize
     */
    handleWindowResize() {
        // Redraw charts on significant size change
        const isMobile = window.innerWidth < 768;
        
        if (isMobile !== this.state.isMobile) {
            this.state.isMobile = isMobile;
            // Trigger chart resize
            window.dispatchEvent(new Event('resize'));
        }
    }

    /**
     * Check if app is ready
     */
    isReady() {
        return this.state.isInitialized && window.ChartManager?.isReady();
    }
}

// ========================================
// GLOBAL INITIALIZATION
// ========================================

/**
 * Initialize application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    // Create global app instance
    window.EnspirionApp = new EnspirionApp();
    
    // Start initialization
    window.EnspirionApp.initialize().catch(error => {
        console.error('Failed to initialize application:', error);
    });
});

// ========================================
// GLOBAL FUNCTIONS
// ========================================

/**
 * Global function to load forecast data (called from DOMContentLoaded)
 */
window.loadForecastData = function() {
    if (window.EnspirionApp && window.EnspirionApp.isReady()) {
        window.EnspirionApp.loadForecastData();
    }
};

// ========================================
// SERVICE WORKER COMMUNICATION
// ========================================

/**
 * Register service worker message handlers
 */
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, data } = event.data;
        
        switch (type) {
            case 'SYNC_COMPLETE':
                if (window.EnspirionApp) {
                    window.EnspirionApp.loadInitialData();
                }
                break;
                
            case 'UPDATE_AVAILABLE':
                window.UIManager?.showNotification(
                    `Dostępna nowa wersja: ${data.version}`,
                    'info'
                );
                break;
                
            case 'CACHE_CLEARED':
                window.UIManager?.showNotification(
                    'Pamięć podręczna wyczyszczona',
                    'success'
                );
                break;
        }
    });
}

// ========================================
// ERROR HANDLERS
// ========================================

/**
 * Global error handler
 */
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    
    if (window.EnspirionApp && window.EnspirionApp.state.isInitialized) {
        window.EnspirionApp.showErrorModal(
            'Błąd aplikacji',
            event.error?.message || 'Wystąpił nieoczekiwany błąd'
        );
    }
});

/**
 * Unhandled promise rejection handler
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    if (window.EnspirionApp && window.EnspirionApp.state.isInitialized) {
        window.UIManager?.showNotification(
            'Wystąpił błąd podczas przetwarzania danych',
            'error'
        );
    }
});

// ========================================
// PERFORMANCE MONITORING
// ========================================

/**
 * Monitor performance
 */
if ('PerformanceObserver' in window) {
    const perfObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
            if (entry.entryType === 'measure') {
                console.log(`Performance: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
            }
        }
    });
    
    perfObserver.observe({ entryTypes: ['measure'] });
}

// Export for debugging
window.app = window.EnspirionApp;

console.log('✅ Enspirion App loaded successfully');