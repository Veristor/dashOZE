/**
 * Enspirion Dashboard - Portfolio Calculator
 * Kalkulacje i analiza portfolio PV
 */

class PortfolioCalculator {
    constructor() {
        this.settings = this.loadSettings();
        this.cache = new Map();
        
        console.log('💼 Portfolio Calculator initialized');
    }

    /**
     * Load portfolio settings
     */
    loadSettings() {
        const stored = localStorage.getItem('portfolio-settings');
        if (stored) {
            return JSON.parse(stored);
        }
        
        // Default settings
        return {
            defaultCapacity: 25.5,        // MW
            efficiency: 0.85,             // 85%
            availabilityFactor: 0.95,     // 95%
            degradationRate: 0.005,       // 0.5% per year
            operationalCost: 5,           // PLN/MWh
            maintenanceCost: 2            // PLN/MWh
        };
    }

    /**
     * Save portfolio settings
     */
    saveSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        localStorage.setItem('portfolio-settings', JSON.stringify(this.settings));
        console.log('💾 Portfolio settings saved:', this.settings);
    }

    /**
     * Get portfolio settings
     */
    getPortfolioSettings() {
        return { ...this.settings };
    }

    /**
     * Update portfolio capacity
     */
    updateCapacity(capacity) {
        this.settings.defaultCapacity = capacity;
        this.saveSettings({ defaultCapacity: capacity });
    }

    /**
     * Calculate portfolio generation based on PV percentage
     */
    calculatePortfolioGeneration(pvPercentage, systemLoad) {
        const portfolioCapacity = this.settings.defaultCapacity;
        const efficiency = this.settings.efficiency;
        const availability = this.settings.availabilityFactor;
        
        // Portfolio generation = PV% × Portfolio Capacity × Efficiency × Availability
        const theoreticalGeneration = (pvPercentage / 100) * portfolioCapacity;
        const actualGeneration = theoreticalGeneration * efficiency * availability;
        
        return {
            theoretical: theoreticalGeneration,
            actual: actualGeneration,
            capacityFactor: (actualGeneration / portfolioCapacity) * 100
        };
    }

    /**
     * Get comprehensive portfolio analysis
     */
    async getPortfolioAnalysis(pvGeneration, systemLoad, priceForecasts, redispatchEvents) {
        try {
            const analysis = {
                performance: this.analyzePerformance(pvGeneration, systemLoad),
                financial: this.analyzeFinancials(pvGeneration, priceForecasts, redispatchEvents),
                efficiency: this.analyzeEfficiency(pvGeneration),
                market: this.analyzeMarketPosition(pvGeneration, systemLoad),
                forecast: this.generateForecast(pvGeneration, systemLoad)
            };
            
            return analysis;
        } catch (error) {
            console.error('Portfolio analysis error:', error);
            return this.getEmptyAnalysis();
        }
    }

    /**
     * Analyze portfolio performance
     */
    analyzePerformance(pvGeneration, systemLoad) {
        if (!pvGeneration || !systemLoad) {
            return this.getEmptyPerformance();
        }

        const hourlyData = [];
        let totalGeneration = 0;
        let peakGeneration = 0;
        let peakHour = 0;

        // Calculate hourly performance
        for (let hour = 0; hour < 24; hour++) {
            const pvData = pvGeneration.find(p => p.hour === hour);
            const loadData = systemLoad.find(l => l.hour === hour);
            
            if (pvData && loadData) {
                const denominator = loadData.totalGeneration || loadData.load;
                const pvPercentage = (pvData.totalPower / denominator) * 100;
                const portfolioGen = this.calculatePortfolioGeneration(pvPercentage, loadData.load);
                
                hourlyData.push({
                    hour,
                    pvPercentage,
                    portfolioGeneration: portfolioGen.actual,
                    theoreticalGeneration: portfolioGen.theoretical,
                    capacityFactor: portfolioGen.capacityFactor,
                    systemLoad: loadData.load,
                    timestamp: pvData.timestamp
                });
                
                totalGeneration += portfolioGen.actual;
                
                if (portfolioGen.actual > peakGeneration) {
                    peakGeneration = portfolioGen.actual;
                    peakHour = hour;
                }
            }
        }

        // Calculate statistics
        const avgCapacityFactor = hourlyData.length > 0 
            ? hourlyData.reduce((sum, h) => sum + h.capacityFactor, 0) / hourlyData.length 
            : 0;

        const peakCapacityFactor = (peakGeneration / this.settings.defaultCapacity) * 100;

        return {
            hourlyData,
            totalGeneration,
            peakGeneration,
            peakHour,
            averageCapacityFactor: avgCapacityFactor,
            peakCapacityFactor,
            utilizationRate: (totalGeneration / (this.settings.defaultCapacity * 24)) * 100,
            performanceRatio: this.calculatePerformanceRatio(hourlyData)
        };
    }

    /**
     * Analyze financial metrics
     */
    analyzeFinancials(pvGeneration, priceForecasts, redispatchEvents) {
        const avgPrice = window.EnspirionConfig?.BUSINESS?.financial?.averageEnergyPrice || 300;
        const curtailmentPenalty = window.EnspirionConfig?.BUSINESS?.financial?.curtailmentPenalty || 50;
        
        let grossRevenue = 0;
        let curtailmentLoss = 0;
        let operationalCost = 0;

        // Calculate revenue from generation
        if (pvGeneration) {
            pvGeneration.forEach(pv => {
                const portfolioGen = (pv.totalPower / 1000) * // Convert to GW
                                    (this.settings.defaultCapacity / 15000) * // Portfolio share
                                    this.settings.efficiency;
                
                const price = priceForecasts?.find(p => p.hour === pv.hour)?.price || avgPrice;
                grossRevenue += portfolioGen * price;
                operationalCost += portfolioGen * (this.settings.operationalCost + this.settings.maintenanceCost);
            });
        }

        // Calculate curtailment losses
        if (redispatchEvents) {
            redispatchEvents.forEach(event => {
                if (event.severity === 'high' || event.severity === 'critical') {
                    const lostGeneration = event.powerReduction * (event.duration / 60); // MWh
                    curtailmentLoss += lostGeneration * curtailmentPenalty;
                }
            });
        }

        const netRevenue = grossRevenue - operationalCost - curtailmentLoss;
        const profitMargin = grossRevenue > 0 ? (netRevenue / grossRevenue) * 100 : 0;

        return {
            grossRevenue,
            operationalCost,
            curtailmentLoss,
            netRevenue,
            profitMargin,
            revenuePerMW: grossRevenue / this.settings.defaultCapacity,
            averagePrice: grossRevenue / (pvGeneration?.reduce((sum, pv) => sum + pv.totalPower, 0) || 1)
        };
    }

    /**
     * Analyze efficiency metrics
     */
    analyzeEfficiency(pvGeneration) {
        if (!pvGeneration || pvGeneration.length === 0) {
            return {
                systemEfficiency: 0,
                technicalAvailability: 0,
                performanceRatio: 0
            };
        }

        // Calculate system efficiency
        const theoreticalMax = this.settings.defaultCapacity * 24 * 0.2; // 20% capacity factor theoretical max
        const actualGeneration = pvGeneration.reduce((sum, pv) => {
            return sum + (pv.totalPower / 1000) * (this.settings.defaultCapacity / 15000);
        }, 0);

        return {
            systemEfficiency: (actualGeneration / theoreticalMax) * 100,
            technicalAvailability: this.settings.availabilityFactor * 100,
            performanceRatio: this.settings.efficiency * 100,
            capacityUtilization: (actualGeneration / (this.settings.defaultCapacity * 24)) * 100
        };
    }

    /**
     * Analyze market position
     */
    analyzeMarketPosition(pvGeneration, systemLoad) {
        const totalPVCapacityPoland = window.EnspirionConfig?.CONSTANTS?.AVERAGE_PV_CAPACITY_POLAND || 15000;
        
        const marketShareByCapacity = (this.settings.defaultCapacity / totalPVCapacityPoland) * 100;
        
        let marketShareByGeneration = 0;
        if (pvGeneration && pvGeneration.length > 0) {
            const totalPVGeneration = pvGeneration.reduce((sum, pv) => sum + pv.totalPower, 0);
            const portfolioGeneration = totalPVGeneration * (this.settings.defaultCapacity / totalPVCapacityPoland);
            marketShareByGeneration = totalPVGeneration > 0 ? (portfolioGeneration / totalPVGeneration) * 100 : 0;
        }

        return {
            marketShareByCapacity,
            marketShareByGeneration,
            competitivePosition: this.assessCompetitivePosition(marketShareByCapacity),
            marketTrend: 'growing' // Could be calculated from historical data
        };
    }

    /**
     * Generate forecast
     */
    generateForecast(pvGeneration, systemLoad) {
        // Simple forecast based on historical patterns
        const tomorrow = [];
        const nextWeek = [];

        // For tomorrow, use today's pattern with slight variation
        if (pvGeneration && systemLoad) {
            for (let hour = 0; hour < 24; hour++) {
                const pvData = pvGeneration.find(p => p.hour === hour);
                const loadData = systemLoad.find(l => l.hour === hour);
                
                if (pvData && loadData) {
                    const variation = 0.9 + Math.random() * 0.2; // ±10% variation
                    tomorrow.push({
                        hour,
                        expectedGeneration: pvData.totalPower * variation,
                        expectedLoad: loadData.load * (0.95 + Math.random() * 0.1),
                        confidence: 0.85
                    });
                }
            }
        }

        return {
            tomorrow,
            nextWeek,
            accuracy: 0.85, // Historical forecast accuracy
            lastUpdated: new Date()
        };
    }

    /**
     * Helper methods
     */
    calculatePerformanceRatio(hourlyData) {
        if (!hourlyData || hourlyData.length === 0) return 0;
        
        const avgCapacityFactor = hourlyData.reduce((sum, h) => sum + h.capacityFactor, 0) / hourlyData.length;
        const theoreticalCapacityFactor = 20; // 20% theoretical average for Poland
        
        return (avgCapacityFactor / theoreticalCapacityFactor) * 100;
    }

    assessCompetitivePosition(marketShare) {
        if (marketShare > 1) return 'leader';
        if (marketShare > 0.5) return 'strong';
        if (marketShare > 0.1) return 'moderate';
        return 'emerging';
    }

    getEmptyAnalysis() {
        return {
            performance: this.getEmptyPerformance(),
            financial: {
                grossRevenue: 0,
                operationalCost: 0,
                curtailmentLoss: 0,
                netRevenue: 0,
                profitMargin: 0,
                revenuePerMW: 0,
                averagePrice: 0
            },
            efficiency: {
                systemEfficiency: 0,
                technicalAvailability: 0,
                performanceRatio: 0,
                capacityUtilization: 0
            },
            market: {
                marketShareByCapacity: 0,
                marketShareByGeneration: 0,
                competitivePosition: 'unknown',
                marketTrend: 'stable'
            },
            forecast: {
                tomorrow: [],
                nextWeek: [],
                accuracy: 0,
                lastUpdated: new Date()
            }
        };
    }

    getEmptyPerformance() {
        return {
            hourlyData: [],
            totalGeneration: 0,
            peakGeneration: 0,
            peakHour: 0,
            averageCapacityFactor: 0,
            peakCapacityFactor: 0,
            utilizationRate: 0,
            performanceRatio: 0
        };
    }

    /**
     * Format number for display
     */
    formatNumber(value, type = 'number', decimals = 2) {
        return window.Utils.formatNumber(value, type, decimals);
    }

    /**
     * Calculate ROI
     */
    calculateROI(netRevenue, investmentCost) {
        if (!investmentCost || investmentCost === 0) return 0;
        return (netRevenue / investmentCost) * 100;
    }

    /**
     * Calculate payback period
     */
    calculatePaybackPeriod(annualNetRevenue, investmentCost) {
        if (!annualNetRevenue || annualNetRevenue === 0) return Infinity;
        return investmentCost / annualNetRevenue;
    }

    /**
     * Export analysis data
     */
    exportAnalysis(analysis, format = 'json') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `portfolio-analysis-${timestamp}.${format}`;
        
        let data;
        if (format === 'csv') {
            data = this.convertAnalysisToCSV(analysis);
        } else {
            data = JSON.stringify(analysis, null, 2);
        }
        
        window.Utils.downloadFile(data, filename, 
            format === 'csv' ? 'text/csv' : 'application/json');
    }

    convertAnalysisToCSV(analysis) {
        const rows = [];
        
        // Headers
        rows.push(['Metric', 'Value', 'Unit']);
        
        // Performance metrics
        rows.push(['Total Generation', analysis.performance.totalGeneration.toFixed(2), 'MW']);
        rows.push(['Peak Generation', analysis.performance.peakGeneration.toFixed(2), 'MW']);
        rows.push(['Peak Hour', analysis.performance.peakHour, 'h']);
        rows.push(['Average Capacity Factor', analysis.performance.averageCapacityFactor.toFixed(2), '%']);
        
        // Financial metrics
        rows.push(['Gross Revenue', analysis.financial.grossRevenue.toFixed(0), 'PLN']);
        rows.push(['Net Revenue', analysis.financial.netRevenue.toFixed(0), 'PLN']);
        rows.push(['Profit Margin', analysis.financial.profitMargin.toFixed(2), '%']);
        
        return rows.map(row => row.join(',')).join('\n');
    }
}

// Create global portfolio calculator instance
window.PortfolioCalculator = new PortfolioCalculator();

// Export for modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PortfolioCalculator;
}

console.log('✅ Portfolio Calculator loaded successfully');