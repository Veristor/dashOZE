/**
 * Enspirion Dashboard - Data Processor
 * Przetwarzanie i agregacja danych z PSE API
 */

class DataProcessor {
    constructor() {
        this.cache = new Map();
        console.log('🔄 Data Processor initialized');
    }

    /**
     * Process all dashboard data
     */
    processAllData(rawData) {
        const pvGen = this.processPVGeneration(rawData.pvGeneration);
        const pvDist = rawData.pvDistribution?.timestamps?.length
        ? {
            power: rawData.pvDistribution.pvGeneration.slice(-1)[0],
            timestamp: rawData.pvDistribution.timestamps.slice(-1)[0]
        }
        : null;

    return {
        pvGeneration: pvGen,
        systemLoad: this.processSystemLoad(rawData.systemLoad),
        constraints: this.processConstraints(rawData.constraints),
        priceForecasts: this.processPriceForecasts(rawData.priceForecasts),
        aggregated: this.aggregateData(rawData),
        currentPVSnapshot: pvDist // <--- to dodajesz
    };
}


    /**
     * Process PV generation data
     */
    processPVGeneration(rawData) {
        if (!rawData || !rawData.value) return [];

        // Filter and aggregate PV units
        const pvUnits = rawData.value.filter(unit => this.isPVUnit(unit));
        
        // Group by hour
        const hourlyData = this.groupByHour(pvUnits);
        
        // Calculate totals and statistics
        return Object.entries(hourlyData).map(([hour, units]) => ({
            hour: parseInt(hour),
            totalPower: units.reduce((sum, unit) => sum + (unit.wartosc || unit.moc || 0), 0),
            unitCount: units.length,
            units: units,
            timestamp: this.createTimestamp(units[0].doba, hour)
        })).sort((a, b) => a.hour - b.hour);
    }

    /**
     * Process system load data
     */
    processSystemLoad(rawData) {
        if (!rawData || !rawData.value) return [];

        return rawData.value.map(item => ({
            hour: parseInt(item.godzina || item.hour),
            load: parseFloat(item.wartosc || item.obciazenie || item.load || 0),
            timestamp: this.createTimestamp(item.doba || item.business_date, item.godzina || item.hour)
        })).sort((a, b) => a.hour - b.hour);
    }

    /**
     * Process operational constraints
     */
    processConstraints(rawData) {
        if (!rawData || !rawData.value) return [];

        return rawData.value
            .filter(constraint => this.isPVUnit(constraint))
            .map(constraint => ({
                resourceName: constraint.nazwa_zasobu || constraint.resource_name,
                resourceCode: constraint.kod_zasobu || constraint.resource_code,
                direction: constraint.kierunek || constraint.direction,
                minPower: parseFloat(constraint.moc_min || constraint.pol_min_power_of_unit || 0),
                maxPower: parseFloat(constraint.moc_max || constraint.pol_max_power_of_unit || 0),
                fromTime: new Date(constraint.od_dtime || constraint.from_dtime),
                toTime: new Date(constraint.do_dtime || constraint.to_dtime),
                limitingElement: constraint.element_ograniczajacy || constraint.limiting_element,
                businessDate: constraint.doba || constraint.business_date,
                duration: this.calculateDuration(constraint),
                severity: this.calculateSeverity(constraint)
            }));
    }

    /**
     * Process price forecasts
     */
    processPriceForecasts(rawData) {
        if (!rawData || !rawData.value) return [];

        return rawData.value.map(item => ({
            hour: parseInt(item.godzina || item.hour),
            price: parseFloat(item.cena || item.price || 0),
            type: item.typ || item.type || 'forecast',
            timestamp: this.createTimestamp(item.doba || item.business_date, item.godzina || item.hour)
        })).sort((a, b) => a.hour - b.hour);
    }

    /**
     * Aggregate data for comprehensive analysis
     */
    aggregateData(rawData) {
        const aggregated = {
            hourly: [],
            daily: {},
            statistics: {}
        };

        // Create hourly aggregation
        for (let hour = 0; hour < 24; hour++) {
            const pvData = rawData.pvGeneration?.find(pv => pv.hour === hour);
            const loadData = rawData.systemLoad?.find(load => load.hour === hour);
            const priceData = rawData.priceForecasts?.find(price => price.hour === hour);

            aggregated.hourly.push({
                hour,
                pvGeneration: pvData?.totalPower || 0,
                systemLoad: loadData?.load || 0,
                totalGeneration: totalGenData?.totalPower || 0,
                pvPercentageByLoad: this.calculatePercentage(pvData?.totalPower, loadData?.load),
                pvPercentageByGeneration: this.calculatePercentage(pvData?.totalPower, totalGenData?.totalPower),

                price: priceData?.price || 0,
                estimatedValue: (pvData?.totalPower || 0) * (priceData?.price || 0) / 1000
            });
        }

        // Calculate daily totals
        aggregated.daily = {
            totalPVGeneration: aggregated.hourly.reduce((sum, h) => sum + h.pvGeneration, 0),
            totalSystemLoad: aggregated.hourly.reduce((sum, h) => sum + h.systemLoad, 0),
            avgPVPercentage: this.calculateAverage(aggregated.hourly.map(h => h.pvPercentage)),
            totalValue: aggregated.hourly.reduce((sum, h) => sum + h.estimatedValue, 0),
            peakPVHour: this.findPeakHour(aggregated.hourly, 'pvGeneration'),
            peakLoadHour: this.findPeakHour(aggregated.hourly, 'systemLoad')
        };

        // Calculate statistics
        aggregated.statistics = {
            pvCapacityFactor: this.calculateCapacityFactor(aggregated.daily.totalPVGeneration),
            loadFactor: this.calculateLoadFactor(aggregated.hourly.map(h => h.systemLoad)),
            pvVariability: this.calculateVariability(aggregated.hourly.map(h => h.pvGeneration)),
            correlationPVLoad: this.calculateCorrelation(
                aggregated.hourly.map(h => h.pvGeneration),
                aggregated.hourly.map(h => h.systemLoad)
            )
        };

        return aggregated;
    }

    /**
     * Helper methods
     */
    isPVUnit(unit) {
        const name = (unit.nazwa || unit.nazwa_zasobu || unit.resource_name || '').toUpperCase();
        const pvKeywords = ['PV', 'SOLAR', 'FOTOWOLT', 'SŁONECZN', 'PHOTOVOLT'];
        return pvKeywords.some(keyword => name.includes(keyword));
    }

    groupByHour(units) {
        return units.reduce((groups, unit) => {
            const hour = unit.godzina || unit.hour || 0;
            if (!groups[hour]) groups[hour] = [];
            groups[hour].push(unit);
            return groups;
        }, {});
    }

    createTimestamp(date, hour) {
        const dateStr = date || new Date().toISOString().split('T')[0];
        const hourStr = String(hour || 0).padStart(2, '0');
        return new Date(`${dateStr}T${hourStr}:00:00`);
    }

    calculateDuration(constraint) {
        const from = new Date(constraint.od_dtime || constraint.from_dtime);
        const to = new Date(constraint.do_dtime || constraint.to_dtime);
        return Math.round((to - from) / (1000 * 60)); // minutes
    }

    calculateSeverity(constraint) {
        const reduction = (constraint.moc_max || constraint.pol_max_power_of_unit || 0) -
                         (constraint.moc_min || constraint.pol_min_power_of_unit || 0);
        
        if (reduction > 50) return 'critical';
        if (reduction > 20) return 'high';
        if (reduction > 5) return 'medium';
        return 'low';
    }

    calculatePercentage(value, total) {
        if (!total || total === 0) return 0;
        return (value / total) * 100;
    }

    calculateAverage(values) {
        if (!values || values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    findPeakHour(hourlyData, field) {
        let maxValue = 0;
        let peakHour = 0;
        
        hourlyData.forEach(data => {
            if (data[field] > maxValue) {
                maxValue = data[field];
                peakHour = data.hour;
            }
        });
        
        return { hour: peakHour, value: maxValue };
    }

    calculateCapacityFactor(totalGeneration, installedCapacity = 15000) {
        // Assuming 15GW installed PV capacity in Poland
        const maxPossible = installedCapacity * 24; // MWh per day
        return (totalGeneration / maxPossible) * 100;
    }

    calculateLoadFactor(loadValues) {
        const avg = this.calculateAverage(loadValues);
        const peak = Math.max(...loadValues);
        return peak > 0 ? (avg / peak) * 100 : 0;
    }

    calculateVariability(values) {
        if (values.length < 2) return 0;
        
        const mean = this.calculateAverage(values);
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        const variance = this.calculateAverage(squaredDiffs);
        const stdDev = Math.sqrt(variance);
        
        return mean > 0 ? (stdDev / mean) * 100 : 0; // Coefficient of variation
    }

    calculateCorrelation(x, y) {
        if (x.length !== y.length || x.length === 0) return 0;
        
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
        const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
        const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        return denominator === 0 ? 0 : numerator / denominator;
    }

    /**
     * Time series analysis
     */
    analyzeTimeSeries(data, field = 'value') {
        const values = data.map(d => d[field]);
        
        return {
            trend: this.calculateTrend(values),
            seasonality: this.detectSeasonality(values),
            anomalies: this.detectAnomalies(values),
            forecast: this.simpleForecast(values)
        };
    }

    calculateTrend(values) {
        // Simple linear regression
        const n = values.length;
        const x = Array.from({length: n}, (_, i) => i);
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((total, xi, i) => total + xi * values[i], 0);
        const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        return { slope, intercept, direction: slope > 0 ? 'increasing' : 'decreasing' };
    }

    detectSeasonality(values, period = 24) {
        if (values.length < period * 2) return null;
        
        // Simple seasonality detection
        const seasonal = [];
        for (let i = 0; i < period; i++) {
            const periodicValues = [];
            for (let j = i; j < values.length; j += period) {
                periodicValues.push(values[j]);
            }
            seasonal.push(this.calculateAverage(periodicValues));
        }
        
        return seasonal;
    }

    detectAnomalies(values, threshold = 2) {
        const mean = this.calculateAverage(values);
        const stdDev = Math.sqrt(
            values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
        );
        
        return values.map((val, index) => ({
            index,
            value: val,
            isAnomaly: Math.abs(val - mean) > threshold * stdDev,
            zScore: stdDev > 0 ? (val - mean) / stdDev : 0
        })).filter(item => item.isAnomaly);
    }

    simpleForecast(values, steps = 6) {
        // Simple moving average forecast
        const windowSize = Math.min(values.length, 6);
        const recentValues = values.slice(-windowSize);
        const avg = this.calculateAverage(recentValues);
        
        return Array(steps).fill(avg);
    }
    /**
     * Process forecast data for chart
     */
    processSystemLoad(systemLoadData, generationData = []) {
    if (!Array.isArray(systemLoadData)) return [];

    return systemLoadData.map(entry => {
        const genEntry = generationData.find(g => g.business_date === entry.business_date && g.hour === entry.hour);
        const totalGeneration = genEntry?.totalGeneration || null;

        return {
            ...entry,
            totalGeneration: totalGeneration
            };
        });
    }

    /**
     * Process redispatch data for chart
     */
    processRedispatchData(rawData) {
        const dates = [];
        const cumulativeValues = [];
        let cumulative = 0;
        
        // Mock data if no redispatch events
        if (!rawData.redispatchEvents || rawData.redispatchEvents.length === 0) {
            // Generate mock data for last 7 days
            const today = new Date();
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                dates.push(date.toISOString().split('T')[0]);
                cumulative += Math.random() * 50; // Random MWh
                cumulativeValues.push(cumulative);
            }
        } else {
            // Process actual redispatch events
            const dailyRedispatch = {};
            
            rawData.redispatchEvents.forEach(event => {
                const date = event.fromTime.toISOString().split('T')[0];
                if (!dailyRedispatch[date]) {
                    dailyRedispatch[date] = 0;
                }
                dailyRedispatch[date] += event.powerReduction * (event.duration / 60); // MWh
            });
            
            // Sort dates and calculate cumulative
            Object.keys(dailyRedispatch).sort().forEach(date => {
                dates.push(date);
                cumulative += dailyRedispatch[date];
                cumulativeValues.push(cumulative);
            });
        }
        
        return { dates, cumulativeValues };
    }
}

// Create global data processor instance
window.DataProcessor = new DataProcessor();

// Export for modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataProcessor;
}

console.log('✅ Data Processor loaded successfully');

window.DataProcessor = window.DataProcessor || {};

window.DataProcessor.transformPSEData = function(data) {
    return data.map(row => {
        const gen_rb =
            (row.gen_jgw_zak_1 || 0) + (row.gen_jgw_zak_2 || 0) +
            (row.gen_jgm_zak_1 || 0) + (row.gen_jgm_zak_2 || 0) +
            (row.gen_jgz_zak_1 || 0) + (row.gen_jgz_zak_2 || 0) + (row.gen_jgz_zak_3 || 0);

        const gen_spoza_rb = (row.gen_jga || 0) + (row.gen_jgo || 0);

        return {
            time: new Date(row.dtime),
            gen_rb,
            gen_spoza_rb,
            gen_fv: row.gen_fv || 0,
            gen_wi: row.gen_wi || 0,
            demand: row.kse_pow_dem || 0
        };
    });
};
