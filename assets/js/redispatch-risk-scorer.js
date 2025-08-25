/**
 * Enspirion Dashboard - Enhanced Redispatch Risk Scorer
 * System scoringowy oceny ryzyka redukcji oparty na realnych danych
 */

class RedispatchRiskScorer {
    constructor() {
        this.weights = {
            reserveMargin: 35,          // Margines rezerwy (rezerwa - wymóg)
            renewableDropRate: 25,      // Tempo spadku generacji OZE
            baseloadSurge: 15,          // Nagły wzrost generacji JW RB
            demandSpike: 10,            // Skok zapotrzebowania
            criticalHours: 10,          // Godziny krytyczne (17-20)
            systemImbalance: 5          // Bilans systemu (import/export)
        };
        
        this.thresholds = {
            low: 25,
            medium: 50,
            high: 75,
            critical: 100
        };
    }

    calculateRiskScore(data) {
        // Sprawdź czy mamy dane o rezerwach
        const hasReserveData = data.hasReserveData !== false && 
                              data.availableReserve !== undefined && 
                              data.requiredReserve !== undefined;
        
        const scores = {
            reserveMargin: hasReserveData ? this.calculateReserveMarginScore(data) : null,
            renewableDropRate: this.calculateRenewableDropScore(data),
            baseloadSurge: this.calculateBaseloadSurgeScore(data),
            demandSpike: this.calculateDemandSpikeScore(data),
            criticalHours: this.calculateCriticalHoursScore(data),
            systemImbalance: this.calculateSystemImbalanceScore(data)
        };
        
        // Dynamiczne wagi - jeśli brak danych o rezerwach, rozdziel wagę na inne czynniki
        let activeWeights = {...this.weights};
        if (!hasReserveData) {
            // Przenieś wagę rezerwy proporcjonalnie na inne czynniki
            const reserveWeight = activeWeights.reserveMargin;
            delete activeWeights.reserveMargin;
            
            const remainingWeightSum = Object.values(activeWeights).reduce((a, b) => a + b, 0);
            
            // Rozdziel wagę rezerwy proporcjonalnie
            Object.keys(activeWeights).forEach(key => {
                activeWeights[key] = activeWeights[key] + 
                    (activeWeights[key] / remainingWeightSum) * reserveWeight;
            });
        }
        
        // Oblicz całkowity wynik tylko z dostępnych danych
        let totalScore = 0;
        for (const [key, weight] of Object.entries(activeWeights)) {
            if (scores[key] !== null && scores[key] !== undefined) {
                totalScore += (scores[key] * weight) / 100;
            }
        }
        
        // Dodaj bonus za kombinację czynników
        const synergy = this.calculateSynergyBonus(scores);
        totalScore = Math.min(100, Math.round(totalScore + synergy));
        
        return {
            totalScore: totalScore,
            components: scores,
            riskLevel: this.getRiskLevel(totalScore),
            recommendations: this.getRecommendations(scores, data, hasReserveData),
            factors: this.getDetailedFactors(scores, data, hasReserveData),
            hasReserveData: hasReserveData,
            dataQuality: hasReserveData ? 'complete' : 'partial'
        };
    }

    // Margines rezerwy - tylko gdy mamy dane
    calculateReserveMarginScore(data) {
        // Nie używaj domyślnych wartości!
        if (data.availableReserve === undefined || data.requiredReserve === undefined) {
            return null;
        }
        
        const availableReserve = data.availableReserve;
        const requiredReserve = data.requiredReserve;
        const margin = availableReserve - requiredReserve;
        
        // Margines ujemny = krytyczne
        if (margin < 0) return 100;
        // Margines < 300 MW = bardzo wysokie
        if (margin < 300) return 85;
        // Margines < 500 MW = wysokie
        if (margin < 500) return 65;
        // Margines < 1000 MW = średnie
        if (margin < 1000) return 40;
        // Margines < 1500 MW = niskie
        if (margin < 1500) return 20;
        
        return 0;
    }

    // Tempo spadku generacji OZE
    calculateRenewableDropScore(data) {
        const pvDelta = data.pvDelta || 0;
        const windDelta = data.windDelta || 0;
        const totalRenewableDrop = Math.min(0, pvDelta + windDelta);
        
        // Dodatkowo sprawdź gradient spadku (zmiana w MW/h)
        const pvGradient = data.pvGradient || 0;
        const windGradient = data.windGradient || 0;
        const totalGradient = pvGradient + windGradient;
        
        let score = 0;
        
        // Nagły spadek > 2000 MW = krytyczne
        if (totalRenewableDrop < -2000) {
            score = 100;
        }
        // Spadek > 1500 MW = bardzo wysokie
        else if (totalRenewableDrop < -1500) {
            score = 80;
        }
        // Spadek > 1000 MW = wysokie
        else if (totalRenewableDrop < -1000) {
            score = 60;
        }
        // Spadek > 500 MW = średnie
        else if (totalRenewableDrop < -500) {
            score = 40;
        }
        // Spadek > 200 MW = niskie
        else if (totalRenewableDrop < -200) {
            score = 20;
        }
        
        // Dodaj punkty za szybkość spadku
        if (Math.abs(totalGradient) > 500) {
            score = Math.min(100, score + 20);
        }
        
        return score;
    }

    // Pozostałe metody bez zmian...
    calculateBaseloadSurgeScore(data) {
        const baseloadDelta = data.baseloadDelta || 0;
        const hour = data.hour;
        const isEvening = hour >= 16 && hour <= 20;
        
        if (!isEvening) {
            return baseloadDelta > 500 ? 20 : 0;
        }
        
        if (baseloadDelta > 1500) return 100;
        if (baseloadDelta > 1000) return 70;
        if (baseloadDelta > 500) return 40;
        if (baseloadDelta > 200) return 20;
        
        return 0;
    }

    calculateDemandSpikeScore(data) {
        const demandDelta = data.demandDelta || 0;
        const systemLoad = data.systemLoad || 20000;
        const demandChangeRate = (demandDelta / systemLoad) * 100;
        
        if (demandChangeRate > 5) return 100;
        if (demandChangeRate > 3) return 60;
        if (demandChangeRate > 2) return 30;
        if (demandChangeRate > 1) return 15;
        
        return 0;
    }

    calculateCriticalHoursScore(data) {
        const hour = data.hour;
        const dayOfWeek = data.dayOfWeek;
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
        
        if (!isWeekday) return 0;
        
        if (hour >= 7 && hour <= 9) return 60;
        if (hour >= 17 && hour <= 20) return 100;
        if ((hour >= 6 && hour <= 10) || (hour >= 16 && hour <= 21)) return 30;
        
        return 0;
    }

    calculateSystemImbalanceScore(data) {
        const exchange = data.powerExchange || 0;
        const absExchange = Math.abs(exchange);
        
        if (absExchange > 3000) return 100;
        if (absExchange > 2000) return 60;
        if (absExchange > 1000) return 30;
        
        return 0;
    }

    calculateSynergyBonus(scores) {
        let criticalFactors = 0;
        let highFactors = 0;
        
        Object.values(scores).forEach(score => {
            if (score !== null && score !== undefined) {
                if (score >= 80) criticalFactors++;
                else if (score >= 50) highFactors++;
            }
        });
        
        if (criticalFactors >= 3) return 15;
        if (criticalFactors >= 2) return 10;
        if (criticalFactors >= 1 && highFactors >= 2) return 8;
        if (highFactors >= 3) return 5;
        
        return 0;
    }

    getRiskLevel(score) {
        if (score <= this.thresholds.low) return 'low';
        if (score <= this.thresholds.medium) return 'medium';
        if (score <= this.thresholds.high) return 'high';
        return 'critical';
    }

    getDetailedFactors(scores, data, hasReserveData) {
        const factors = [];
        
        // Margines rezerwy - tylko jeśli mamy dane
        if (hasReserveData && scores.reserveMargin !== null && scores.reserveMargin > 0) {
            const availableReserve = data.availableReserve;
            const requiredReserve = data.requiredReserve;
            const margin = availableReserve - requiredReserve;
            
            factors.push({
                factor: margin < 0 ? 'Deficyt rezerwy!' : 
                       margin < 300 ? 'Krytycznie niski margines' :
                       margin < 500 ? 'Bardzo niski margines' : 'Niski margines rezerwy',
                value: `${margin.toFixed(0)} MW`,
                impact: Math.round(scores.reserveMargin * this.weights.reserveMargin / 100),
                icon: 'activity',
                critical: margin < 300
            });
        } else if (!hasReserveData) {
            // Informacja o braku danych
            factors.push({
                factor: 'Brak danych o rezerwach',
                value: 'N/A',
                impact: 0,
                icon: 'help-circle',
                info: true
            });
        }
        
        // Spadek OZE
        if (scores.renewableDropRate > 0) {
            const totalDelta = (data.pvDelta || 0) + (data.windDelta || 0);
            factors.push({
                factor: Math.abs(totalDelta) > 1500 ? 'Gwałtowny spadek OZE!' : 'Spadek generacji OZE',
                value: `${totalDelta.toFixed(0)} MW/h`,
                impact: Math.round(scores.renewableDropRate * 
                    (hasReserveData ? this.weights.renewableDropRate : 38) / 100),
                icon: 'trending-down',
                critical: Math.abs(totalDelta) > 1500
            });
        }
        
        // Pozostałe czynniki...
        if (scores.baseloadSurge > 0) {
            const baseloadDelta = data.baseloadDelta || 0;
            factors.push({
                factor: baseloadDelta > 1000 ? 'Gwałtowny wzrost JW RB!' : 'Wzrost generacji JW RB',
                value: `+${baseloadDelta.toFixed(0)} MW`,
                impact: Math.round(scores.baseloadSurge * 
                    (hasReserveData ? this.weights.baseloadSurge : 23) / 100),
                icon: 'zap',
                critical: baseloadDelta > 1000 && data.hour >= 16 && data.hour <= 20
            });
        }
        
        if (scores.demandSpike > 0) {
            const demandDelta = data.demandDelta || 0;
            factors.push({
                factor: 'Wzrost zapotrzebowania',
                value: `+${demandDelta.toFixed(0)} MW`,
                impact: Math.round(scores.demandSpike * 
                    (hasReserveData ? this.weights.demandSpike : 15) / 100),
                icon: 'trending-up'
            });
        }
        
        if (scores.criticalHours > 0) {
            factors.push({
                factor: data.hour >= 17 && data.hour <= 20 ? 'Szczyt wieczorny' : 'Godzina szczytowa',
                value: `${data.hour}:00`,
                impact: Math.round(scores.criticalHours * 
                    (hasReserveData ? this.weights.criticalHours : 15) / 100),
                icon: 'clock'
            });
        }
        
        return factors.sort((a, b) => {
            // Info na końcu
            if (a.info) return 1;
            if (b.info) return -1;
            return b.impact - a.impact;
        });
    }

    getRecommendations(scores, data, hasReserveData) {
        const recommendations = [];
        
        if (!hasReserveData) {
            recommendations.push('ℹ️ Brak danych o rezerwach mocy - analiza oparta na pozostałych wskaźnikach');
        }
        
        if (hasReserveData && scores.reserveMargin !== null) {
            const margin = data.availableReserve - data.requiredReserve;
            if (scores.reserveMargin >= 80 || margin < 300) {
                recommendations.push('🔴 ALERT: Krytyczny margines rezerwy! Wysokie prawdopodobieństwo wezwania');
            } else if (scores.reserveMargin >= 50) {
                recommendations.push('⚠️ Niski margines rezerwy - przygotuj się na możliwe wezwanie');
            }
        }
        
        if (scores.renewableDropRate >= 60) {
            recommendations.push('📉 Gwałtowny spadek OZE - system potrzebuje szybkiego bilansowania');
        }
        
        if (scores.baseloadSurge >= 50 && data.hour >= 16 && data.hour <= 20) {
            recommendations.push('⚡ Wieczorny wzrost JW RB - typowy sygnał nadchodzącego wezwania');
        }
        
        if (scores.criticalHours > 0 && (!hasReserveData || scores.reserveMargin > 30)) {
            recommendations.push('⏰ Godziny szczytowe - zwiększ czujność na komunikaty OSP');
        }
        
        // Oblicz całkowite zagrożenie
        let threatLevel = 0;
        if (hasReserveData && scores.reserveMargin !== null) {
            threatLevel += scores.reserveMargin * this.weights.reserveMargin / 100;
        }
        threatLevel += scores.renewableDropRate * 
            (hasReserveData ? this.weights.renewableDropRate : 38) / 100;
        threatLevel += scores.baseloadSurge * 
            (hasReserveData ? this.weights.baseloadSurge : 23) / 100;
        
        if (threatLevel >= 70) {
            recommendations.push('🚨 Rozważ natychmiastową redukcję sprzedaży na TGE');
        } else if (threatLevel >= 50) {
            recommendations.push('📊 Monitoruj sytuację i przygotuj plan redukcji');
        }
        
        if (recommendations.length === 1 && recommendations[0].includes('Brak danych')) {
            recommendations.push('📊 Analiza ograniczona - bazuje na trendach OZE i zapotrzebowania');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('✅ Sytuacja stabilna - niskie ryzyko wezwania');
        }
        
        return recommendations;
    }
}

// Export
window.RedispatchRiskScorer = RedispatchRiskScorer;