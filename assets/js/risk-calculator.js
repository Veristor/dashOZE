/**
 * Enspirion Dashboard - Risk Calculator
 * Advanced risk analysis engine for redispatch prediction
 */

class RiskCalculator {
    constructor() {
    this.config = window.EnspirionConfig?.BUSINESS?.risk || {
        weights: {
            historicalRedispatch: 0.4,
            currentLimitations: 0.3,
            pvGenerationLevel: 0.2,
            systemLoad: 0.1
        },
        thresholds: {
            low: 0.25,
            medium: 0.5,
            high: 0.75
        }
    };
    this.historicalData = new Map();
    this.riskCache = new Map();
    
    console.log('🎯 Risk Calculator initialized');
}

    /**
     * Main risk calculation method
     * Calculates risk score for specific hour based on multiple factors
     */
    calculateHourlyRisk(hour, day, historicalRedispatch, currentLimitations, pvGeneration, systemLoad) {
        try {
            // Normalize inputs to 0-1 scale
            const factors = {
                historical: this.calculateHistoricalRiskFactor(hour, day, historicalRedispatch),
                limitations: this.calculateLimitationsFactor(hour, currentLimitations),
                pvGeneration: this.calculatePVGenerationFactor(hour, pvGeneration),
                systemLoad: this.calculateSystemLoadFactor(hour, systemLoad)
            };

            // Apply weights from configuration
            let riskScore = 0;
            riskScore += factors.historical * this.config.weights.historicalRedispatch;
            riskScore += factors.limitations * this.config.weights.currentLimitations;
            riskScore += factors.pvGeneration * this.config.weights.pvGenerationLevel;
            riskScore += factors.systemLoad * this.config.weights.systemLoad;

            // Ensure score is between 0 and 1
            riskScore = Math.max(0, Math.min(1, riskScore));

            return {
                score: riskScore,
                level: this.getRiskLevel(riskScore),
                factors: factors,
                confidence: this.calculateConfidence(factors),
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error calculating hourly risk:', error);
            return this.getDefaultRisk();
        }
    }

    /**
     * Calculate historical redispatch risk factor (0-1)
     * Based on frequency and severity of past events
     */
    calculateHistoricalRiskFactor(hour, day, historicalData) {
        if (!historicalData || historicalData.length === 0) {
            return 0.1; // Low baseline risk when no historical data
        }

        // Filter events for the same hour and day of week
        const dayOfWeek = day % 7;
        const relevantEvents = historicalData.filter(event => {
            const eventHour = event.fromTime.getHours();
            const eventDay = event.fromTime.getDay();
            
            // Consider events in ±1 hour window and same day of week
            return Math.abs(eventHour - hour) <= 1 && eventDay === dayOfWeek;
        });

        if (relevantEvents.length === 0) {
            return 0.05; // Very low risk if no relevant historical events
        }

        // Calculate frequency factor (how often events occur)
        const daysInHistory = this.getDaysInHistory(historicalData);
        const frequencyFactor = Math.min(relevantEvents.length / daysInHistory, 1.0);

        // Calculate severity factor (average severity of events)
        const severityScores = relevantEvents.map(event => this.getSeverityScore(event));
        const averageSeverity = severityScores.reduce((sum, score) => sum + score, 0) / severityScores.length;

        // Recent events have higher weight
        const recencyFactor = this.calculateRecencyFactor(relevantEvents);

        // Combine factors
        const riskFactor = (frequencyFactor * 0.4 + averageSeverity * 0.4 + recencyFactor * 0.2);
        
        return Math.min(riskFactor, 1.0);
    }

    /**
     * Calculate current limitations risk factor (0-1)
     */
    calculateLimitationsFactor(hour, currentLimitations) {
        if (!currentLimitations || currentLimitations.length === 0) {
            return 0.0;
        }

        // Check for active limitations during this hour
        const activeLimitations = currentLimitations.filter(limit => {
            const limitHour = limit.fromTime.getHours();
            const limitEndHour = limit.toTime.getHours();
            
            // Handle limitations that span midnight
            if (limitEndHour < limitHour) {
                return hour >= limitHour || hour <= limitEndHour;
            } else {
                return hour >= limitHour && hour <= limitEndHour;
            }
        });

        if (activeLimitations.length === 0) {
            return 0.0;
        }

        // Calculate severity of active limitations
        const severityScores = activeLimitations.map(limit => this.getSeverityScore(limit));
        const maxSeverity = Math.max(...severityScores);
        
        // Number of simultaneous limitations increases risk
        const countFactor = Math.min(activeLimitations.length / 3, 1.0); // Max at 3 limitations
        
        return Math.min(maxSeverity * 0.7 + countFactor * 0.3, 1.0);
    }

    /**
     * Calculate PV generation risk factor (0-1)
     * Higher PV generation = higher redispatch risk
     */
    calculatePVGenerationFactor(hour, pvGeneration) {
        if (!pvGeneration || pvGeneration.length === 0) {
            return 0.0;
        }

        const hourData = pvGeneration.find(gen => gen.hour === hour);
        if (!hourData) {
            return 0.0;
        }

        // Calculate PV generation as percentage of total capacity
        const totalPVCapacity = window.EnspirionConfig.CONSTANTS.AVERAGE_PV_CAPACITY_POLAND;
        const generationPercentage = hourData.totalPower / totalPVCapacity;

        // Higher generation percentage = higher risk
        // Risk increases exponentially above 50% capacity
        if (generationPercentage > 0.5) {
            return Math.min((generationPercentage - 0.5) * 2, 1.0);
        } else if (generationPercentage > 0.3) {
            return (generationPercentage - 0.3) * 1.5;
        } else {
            return generationPercentage * 0.5;
        }
    }

    /**
     * Calculate system load risk factor (0-1)
     * Lower system load = higher redispatch risk for PV
     */
    calculateSystemLoadFactor(hour, systemLoad) {
        if (!systemLoad || systemLoad.length === 0) {
            return 0.5; // Medium risk when no load data
        }

        const hourData = systemLoad.find(load => load.hour === hour);
        if (!hourData) {
            return 0.5;
        }

        // Normalize system load (typical range: 15,000 - 28,000 MW)
        const minLoad = 15000;
        const maxLoad = 28000;
        const normalizedLoad = (hourData.load - minLoad) / (maxLoad - minLoad);
        
        // Invert the relationship: lower load = higher risk
        return Math.max(0, Math.min(1 - normalizedLoad, 1.0));
    }

    /**
     * Calculate 7-day risk heatmap
     */
    calculateRiskHeatmap(historicalRedispatch, currentLimitations, forecastData) {
        const heatmap = [];
        const today = new Date();
        
        for (let day = 0; day < 7; day++) {
            const dayData = [];
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + day);
            
            for (let hour = 0; hour < 24; hour++) {
                const pvGeneration = forecastData?.pvGeneration || [];
                const systemLoad = forecastData?.systemLoad || [];
                
                const risk = this.calculateHourlyRisk(
                    hour, 
                    day,
                    historicalRedispatch,
                    currentLimitations,
                    pvGeneration,
                    systemLoad
                );
                
                dayData.push({
                    day: day,
                    hour: hour,
                    risk: risk.score,
                    level: risk.level,
                    factors: risk.factors,
                    date: new Date(targetDate),
                    timestamp: targetDate.toISOString()
                });
            }
            heatmap.push(dayData);
        }
        
        return heatmap;
    }

    /**
     * Calculate overall risk level for next 6 hours
     */
    calculateShortTermRisk(historicalRedispatch, currentLimitations, forecastData) {
        const now = new Date();
        const currentHour = now.getHours();
        const risks = [];
        
        for (let i = 0; i < 6; i++) {
            const targetHour = (currentHour + i) % 24;
            const risk = this.calculateHourlyRisk(
                targetHour,
                0, // Today
                historicalRedispatch,
                currentLimitations,
                forecastData?.pvGeneration || [],
                forecastData?.systemLoad || []
            );
            risks.push(risk);
        }
        
        // Calculate weighted average (nearer hours have higher weight)
        let weightedSum = 0;
        let totalWeight = 0;
        
        risks.forEach((risk, index) => {
            const weight = 6 - index; // Hour 0 has weight 6, hour 5 has weight 1
            weightedSum += risk.score * weight;
            totalWeight += weight;
        });
        
        const averageRisk = weightedSum / totalWeight;
        
        return {
            score: averageRisk,
            level: this.getRiskLevel(averageRisk),
            hourlyRisks: risks,
            peakRisk: Math.max(...risks.map(r => r.score)),
            minRisk: Math.min(...risks.map(r => r.score)),
            trend: this.calculateRiskTrend(risks),
            alerts: this.generateRiskAlerts(risks)
        };
    }

    /**
     * Helper methods
     */
    getRiskLevel(score) {
        if (score >= this.config.thresholds.high) return 'critical';
        if (score >= this.config.thresholds.medium) return 'high';
        if (score >= this.config.thresholds.low) return 'medium';
        return 'low';
    }

    getRiskLevelText(level) {
        const texts = {
            low: 'NISKIE',
            medium: 'ŚREDNIE',
            high: 'WYSOKIE',
            critical: 'KRYTYCZNE'
        };
        return texts[level] || 'NIEZNANE';
    }

    getRiskColor(level) {
        const colors = window.EnspirionConfig.UI.colors;
        const colorMap = {
            low: colors.riskLow,
            medium: colors.riskMedium,
            high: colors.riskHigh,
            critical: colors.riskCritical
        };
        return colorMap[level] || colors.riskMedium;
    }

    getSeverityScore(event) {
        if (!event.severity) {
            // Calculate based on power reduction
            const powerReduction = event.powerReduction || 0;
            if (powerReduction > 10) return 1.0;
            if (powerReduction > 5) return 0.8;
            if (powerReduction > 1) return 0.6;
            return 0.3;
        }
        
        const severityMap = {
            critical: 1.0,
            high: 0.8,
            medium: 0.6,
            low: 0.3
        };
        
        return severityMap[event.severity] || 0.5;
    }

    calculateRecencyFactor(events) {
        if (events.length === 0) return 0;
        
        const now = new Date();
        const recencyScores = events.map(event => {
            const daysSince = (now - event.fromTime) / (1000 * 60 * 60 * 24);
            // Events within last 7 days have score 1.0, linearly decreasing to 0.1 at 30 days
            if (daysSince <= 7) return 1.0;
            if (daysSince <= 30) return 1.0 - (daysSince - 7) * 0.9 / 23;
            return 0.1;
        });
        
        return Math.max(...recencyScores);
    }

    calculateConfidence(factors) {
        // Confidence based on data availability and quality
        let confidence = 0.5; // Base confidence
        
        if (factors.historical > 0) confidence += 0.2;
        if (factors.limitations >= 0) confidence += 0.15;
        if (factors.pvGeneration >= 0) confidence += 0.1;
        if (factors.systemLoad >= 0) confidence += 0.05;
        
        return Math.min(confidence, 1.0);
    }

    calculateRiskTrend(risks) {
        if (risks.length < 2) return 'stable';
        
        const firstHalf = risks.slice(0, Math.floor(risks.length / 2));
        const secondHalf = risks.slice(Math.floor(risks.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, r) => sum + r.score, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, r) => sum + r.score, 0) / secondHalf.length;
        
        const change = secondAvg - firstAvg;
        
        if (change > 0.1) return 'increasing';
        if (change < -0.1) return 'decreasing';
        return 'stable';
    }

    generateRiskAlerts(risks) {
        const alerts = [];
        
        risks.forEach((risk, index) => {
            if (risk.level === 'critical') {
                alerts.push({
                    type: 'critical',
                    hour: index,
                    message: `Krytyczne ryzyko redysponowania w ciągu ${index + 1}h`,
                    recommendations: ['Rozważ redukcję sprzedaży', 'Monitoruj komunikaty OSP']
                });
            } else if (risk.level === 'high') {
                alerts.push({
                    type: 'warning',
                    hour: index,
                    message: `Wysokie ryzyko redysponowania w ciągu ${index + 1}h`,
                    recommendations: ['Zwiększ częstotliwość monitoringu']
                });
            }
        });
        
        return alerts;
    }

    getDaysInHistory(historicalData) {
        if (!historicalData || historicalData.length === 0) return 1;
        
        const dates = new Set();
        historicalData.forEach(event => {
            const dateStr = event.fromTime.toISOString().split('T')[0];
            dates.add(dateStr);
        });
        
        return Math.max(dates.size, 1);
    }

    getDefaultRisk() {
        return {
            score: 0.25,
            level: 'medium',
            factors: {
                historical: 0.25,
                limitations: 0.0,
                pvGeneration: 0.25,
                systemLoad: 0.25
            },
            confidence: 0.3,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Cache management for risk calculations
     */
    getCachedRisk(key) {
        const cached = this.riskCache.get(key);
        if (cached && Date.now() - cached.timestamp < 900000) { // 15 minutes
            return cached.data;
        }
        return null;
    }

    cacheRisk(key, data) {
        this.riskCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
        
        // Cleanup old cache entries
        if (this.riskCache.size > 100) {
            const oldestKey = this.riskCache.keys().next().value;
            this.riskCache.delete(oldestKey);
        }
    }

    /**
     * Advanced risk analysis methods
     */
    
    /**
     * Identify risk patterns in historical data
     */
    identifyRiskPatterns(historicalData) {
        const patterns = {
            hourlyPattern: new Array(24).fill(0),
            weeklyPattern: new Array(7).fill(0),
            seasonalFactors: {},
            correlations: {}
        };

        if (!historicalData || historicalData.length === 0) {
            return patterns;
        }

        // Hourly pattern analysis
        historicalData.forEach(event => {
            const hour = event.fromTime.getHours();
            patterns.hourlyPattern[hour] += this.getSeverityScore(event);
        });

        // Weekly pattern analysis
        historicalData.forEach(event => {
            const dayOfWeek = event.fromTime.getDay();
            patterns.weeklyPattern[dayOfWeek] += this.getSeverityScore(event);
        });

        // Normalize patterns
        const maxHourly = Math.max(...patterns.hourlyPattern);
        if (maxHourly > 0) {
            patterns.hourlyPattern = patterns.hourlyPattern.map(val => val / maxHourly);
        }

        const maxWeekly = Math.max(...patterns.weeklyPattern);
        if (maxWeekly > 0) {
            patterns.weeklyPattern = patterns.weeklyPattern.map(val => val / maxWeekly);
        }

        return patterns;
    }

    /**
     * Generate risk report
     */
    generateRiskReport(heatmapData, shortTermRisk, patterns) {
        const report = {
            summary: {
                currentRiskLevel: shortTermRisk.level,
                peakRiskNext24h: Math.max(...heatmapData[0].map(h => h.risk)),
                averageRiskNext7d: this.calculateAverageRisk(heatmapData),
                trend: shortTermRisk.trend
            },
            insights: [],
            recommendations: [],
            patterns: patterns,
            timestamp: new Date().toISOString()
        };

        // Generate insights
        if (patterns.hourlyPattern) {
            const peakHours = this.findPeakRiskHours(patterns.hourlyPattern);
            if (peakHours.length > 0) {
                report.insights.push({
                    type: 'pattern',
                    title: 'Godziny podwyższonego ryzyka',
                    description: `Historycznie największe ryzyko występuje o godzinach: ${peakHours.join(', ')}`
                });
            }
        }

        // Generate recommendations
        if (shortTermRisk.level === 'critical' || shortTermRisk.level === 'high') {
            report.recommendations.push({
                priority: 'high',
                title: 'Działania natychmiastowe',
                actions: [
                    'Monitoruj komunikaty OSP w czasie rzeczywistym',
                    'Przygotuj plan redukcji generacji',
                    'Sprawdź możliwości przesunięcia sprzedaży energii'
                ]
            });
        }

        return report;
    }

    findPeakRiskHours(hourlyPattern) {
        const threshold = 0.7; // 70% of maximum risk
        return hourlyPattern
            .map((risk, hour) => ({ risk, hour }))
            .filter(item => item.risk >= threshold)
            .map(item => item.hour);
    }

    calculateAverageRisk(heatmapData) {
        let totalRisk = 0;
        let count = 0;

        heatmapData.forEach(day => {
            day.forEach(hour => {
                totalRisk += hour.risk;
                count++;
            });
        });

        return count > 0 ? totalRisk / count : 0;
    }
}

// Create global risk calculator instance
window.RiskCalculator = new RiskCalculator();

// Export for modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RiskCalculator;
}

console.log('✅ Risk Calculator loaded successfully');