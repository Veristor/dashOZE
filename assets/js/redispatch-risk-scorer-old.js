/**
 * Enspirion Dashboard - Redispatch Risk Scorer
 * System scoringowy oceny ryzyka redukcji
 */

class RedispatchRiskScorer {
    constructor() {
        this.weights = {
            powerReserve: 25,        // Rezerwa mocy
            renewableShare: 20,      // Udział OZE
            baseloadGeneration: 15,  // Generacja JW RB
            generationGradient: 20,  // Zmiana generacji OZE
            peakHours: 10,          // Godziny szczytowe
            historicalPattern: 10   // Wzorce historyczne
        };
        
        this.thresholds = {
            low: 25,      // 0-25: Niskie ryzyko
            medium: 50,   // 26-50: Średnie ryzyko
            high: 75,     // 51-75: Wysokie ryzyko
            critical: 100 // 76-100: Krytyczne ryzyko
        };
    }

    calculateRiskScore(data) {
        const scores = {
            powerReserve: this.calculatePowerReserveScore(data),
            renewableShare: this.calculateRenewableShareScore(data),
            baseloadGeneration: this.calculateBaseloadScore(data),
            generationGradient: this.calculateGradientScore(data),
            peakHours: this.calculatePeakHoursScore(data),
            historicalPattern: this.calculateHistoricalScore(data)
        };
        
        // Oblicz całkowity wynik
        let totalScore = 0;
        for (const [key, weight] of Object.entries(this.weights)) {
            totalScore += (scores[key] * weight) / 100;
        }
        
        return {
            totalScore: Math.min(100, Math.round(totalScore)),
            components: scores,
            riskLevel: this.getRiskLevel(totalScore),
            recommendations: this.getRecommendations(scores)
        };
    }

    // Implementacja metod scoringowych...
    calculatePowerReserveScore(data) {
    // Zwiększona czułość na rezerwę mocy
    const requiredReserve = data.systemLoad * 0.18; // 18% rezerwy
    const actualReserve = data.availableCapacity - data.systemLoad;
    const reserveRatio = actualReserve / requiredReserve;
    
    if (reserveRatio >= 1.5) return 0;    // Bardzo dobra rezerwa
    if (reserveRatio >= 1.2) return 20;   // Dobra rezerwa
    if (reserveRatio >= 1.0) return 40;   // Minimalna rezerwa
    if (reserveRatio >= 0.8) return 70;   // Niska rezerwa
    if (reserveRatio >= 0.6) return 90;   // Krytycznie niska
    return 100; // Brak rezerwy
}

calculatePeakHoursScore(data) {
    const hour = data.hour;
    const isWeekday = data.dayOfWeek >= 1 && data.dayOfWeek <= 5;
    
    if (!isWeekday) {
        // Weekend - mniejsze ryzyko
        if (hour >= 10 && hour <= 20) return 30;
        return 10;
    }
    
    // Dni robocze - zwiększone ryzyko w godzinach szczytowych
    if (hour >= 6 && hour <= 9) {
        // Poranny szczyt
        if (hour === 7 || hour === 8) return 80;
        return 60;
    }
    
    if (hour >= 17 && hour <= 21) {
        // Wieczorny szczyt
        if (hour === 18 || hour === 19) return 100;
        if (hour === 20) return 90;
        return 70;
    }
    
    // Środek dnia z wysoką generacją PV
    if (hour >= 11 && hour <= 15) return 50;
    
    // Noc
    if (hour >= 23 || hour <= 5) return 5;
    
    return 20; // Pozostałe godziny
}

    calculateRenewableShareScore(data) {
        const renewableShare = ((data.pvGeneration + data.windGeneration) / data.systemLoad) * 100;
        
        if (renewableShare < 30) return 0;
        if (renewableShare < 50) return 25;
        if (renewableShare < 60) return 50;
        if (renewableShare < 70) return 75;
        return 100;
    }

    calculateBaseloadScore(data) {
        const baseloadShare = (data.baseloadGeneration / data.systemLoad) * 100;
        
        if (baseloadShare > 50) return 0;
        if (baseloadShare > 40) return 25;
        if (baseloadShare > 30) return 50;
        if (baseloadShare > 20) return 75;
        return 100;
    }

    calculateGradientScore(data) {
        const totalGradient = (data.pvGradient || 0) + (data.windGradient || 0);
        
        let score = 0;
        if (totalGradient < 0) {
            score = Math.min(100, Math.abs(totalGradient) / 10);
        }
        if (totalGradient > 500) {
            score = Math.min(50, (totalGradient - 500) / 20);
        }
        
        return score;
    }

    calculatePeakHoursScore(data) {
        const hour = data.hour;
        const isWeekday = data.dayOfWeek >= 1 && data.dayOfWeek <= 5;
        
        if (!isWeekday) return 0;
        
        if (hour >= 6 && hour <= 9) return 50;
        if (hour >= 17 && hour <= 21) {
            if (hour === 19 || hour === 20) return 100;
            return 75;
        }
        
        return 0;
    }

    calculateHistoricalScore(data) {
        // Placeholder - można rozbudować o rzeczywiste dane historyczne
        return 0;
    }

    getRiskLevel(score) {
        if (score <= this.thresholds.low) return 'low';
        if (score <= this.thresholds.medium) return 'medium';
        if (score <= this.thresholds.high) return 'high';
        return 'critical';
    }

    getRecommendations(scores) {
        const recommendations = [];
        
        if (scores.powerReserve > 50) {
            recommendations.push('⚠️ Niska rezerwa mocy - rozważ redukcję sprzedaży');
        }
        if (scores.renewableShare > 70) {
            recommendations.push('☀️ Bardzo wysoki udział OZE - zwiększone ryzyko');
        }
        if (scores.generationGradient > 50) {
            recommendations.push('📉 Gwałtowna zmiana generacji OZE');
        }
        if (scores.peakHours > 50) {
            recommendations.push('⏰ Godziny szczytowe - typowy czas wezwań');
        }
        
        return recommendations;
    }
}

// Export
window.RedispatchRiskScorer = RedispatchRiskScorer;