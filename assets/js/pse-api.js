/**
 * Enspirion Dashboard - PSE API Service
 * Serwis do komunikacji z rzeczywistym API PSE
 */

class PSEApiService {
    constructor() {
    
        this.baseUrl = 'https://apimpdv2-bmgdhhajexe8aade.a01.azurefd.net/api/';
        this.cache = new Map();
        this.isOnline = navigator.onLine;
        
        this.setupNetworkListeners();
        console.log('🔌 PSE API Service initialized with correct endpoints');
    }

    /**
     * Setup network status listeners
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Network connection restored');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📡 Network connection lost');
        });
    }
/**
 * Get forecast data for next 3 days
 */
async getForecastData(days = 3) {
    try {
        // Pobierz prognozy na najbliższe dni
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + days);
        
        const params = {
            '$filter': `business_date ge '${startDate.toISOString().split('T')[0]}' and business_date le '${endDate.toISOString().split('T')[0]}'`,
            '$orderby': 'plan_dtime asc',
            '$first': 2000
        };
        
        // Użyj właściwego endpointu pk5l-wp
        const data = await this.request('pk5l-wp', params);
        
        if (!data || !data.value) {
            console.warn('No forecast data received');
            return this.getMockForecastData(days);
        }
        
        return this.processForecastData(data.value);
        
    } catch (error) {
        console.error('Failed to get forecast data:', error);
        return this.getMockForecastData(days);
    }
}

/**
 * Process forecast data
 */
processForecastData(rawData) {
    return rawData.map(item => ({
        timestamp: new Date(item.plan_dtime),
        hour: new Date(item.plan_dtime).getHours(),
        date: item.business_date,
        
        // Prognozy generacji
        pvForecast: parseFloat(item.fcst_pv_tot_gen || 0),
        windForecast: parseFloat(item.fcst_wi_tot_gen || 0),
        
        // Prognoza zapotrzebowania
        demandForecast: parseFloat(item.grid_demand_fcst || 0),
        
        // Dodatkowe dane
        requiredReserve: parseFloat(item.req_pow_res || 0),
        surplusCapacity: parseFloat(item.surplus_cap_avail_tso || 0),
        
        // Oblicz udział OZE
        renewableShare: item.grid_demand_fcst > 0 ? 
            ((parseFloat(item.fcst_pv_tot_gen || 0) + parseFloat(item.fcst_wi_tot_gen || 0)) / parseFloat(item.grid_demand_fcst || 1) * 100) : 0
    }));
}

/**
 * Mock forecast data for testing
 */
getMockForecastData(days) {
    const data = [];
    const now = new Date();
    
    for (let d = 0; d < days; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() + d);
        
        // Skip weekends
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        for (let h = 0; h < 24; h++) {
            const timestamp = new Date(date);
            timestamp.setHours(h, 0, 0, 0);
            
            // Symuluj krzywą PV
            const sunFactor = Math.max(0, Math.sin((h - 6) * Math.PI / 12));
            const pvForecast = sunFactor * (8000 + Math.random() * 2000);
            
            // Symuluj generację wiatrową
            const windBase = 3000 + Math.sin(h * Math.PI / 12) * 1000;
            const windForecast = windBase + Math.random() * 2000;
            
            // Symuluj zapotrzebowanie
            const demandBase = 20000;
            const demandPeak = h >= 7 && h <= 21 ? 1.2 : 0.9;
            const demandForecast = demandBase * demandPeak * (0.95 + Math.random() * 0.1);
            
            data.push({
                timestamp,
                hour: h,
                date: date.toISOString().split('T')[0],
                pvForecast,
                windForecast,
                demandForecast,
                requiredReserve: demandForecast * 0.18,
                surplusCapacity: (pvForecast + windForecast) * 0.1,
                renewableShare: ((pvForecast + windForecast) / demandForecast) * 100
            });
        }
    }
    
    return data;
}
    /**
     * Main API request method
     */
    async request(endpoint, params = {}) {
        try {
            if (!this.isOnline) {
                return this.getCachedData(endpoint);
            }
            
            // ZMIEŃ TEN FRAGMENT:
        const queryString = new URLSearchParams(params).toString();
        
        // Dla proxy CORS - nie koduj podwójnie
        const apiUrl = `https://apimpdv2-bmgdhhajexe8aade.a01.azurefd.net/api/${endpoint}${queryString ? '?' + queryString : ''}`;
        const url = `${this.baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;
            console.log(`🔄 Fetching: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Cache response
            this.cacheData(endpoint, data);
            
            console.log(`✅ API success: ${endpoint}`);
            return data;

        } catch (error) {
            console.error(`❌ API error: ${endpoint}`, error);
            
            // Try to return cached data
            const cachedData = this.getCachedData(endpoint);
            if (cachedData) {
                console.log(`📦 Using cached data for: ${endpoint}`);
                return cachedData;
            }
            
            // Return mock data structure
            return { value: [], nextLink: null };
        }
    }

    /**
     * Get current PV and Wind generation from pdgobpkd endpoint
     */
    async getCurrentRenewableGeneration() {
        try {
            // Filtruj dane na dzisiaj
            const today = new Date().toISOString().split('T')[0];
            const params = {
                '$filter': `business_date eq '${today}'`,
                '$orderby': 'business_date asc',
                '$first': 1000
            };
            
            // Używamy endpointu pdgobpkd który zawiera gen_fv i gen_wi
            const data = await this.request('pdgobpkd', params);
            
            if (!data || !data.value) {
                console.warn('No renewable generation data received');
                return this.getMockRenewableData();
            }

            return this.processRenewableData(data.value);

        } catch (error) {
            console.error('Failed to get renewable generation:', error);
            return this.getMockRenewableData();
        }
    }

    /**
     * Get current PV generation (legacy method for compatibility)
     */
    async getCurrentPVGeneration() {
        const renewableData = await this.getCurrentRenewableGeneration();
        // Extract just PV data for backward compatibility
        return renewableData.map(item => ({
            hour: item.hour,
            totalPower: item.pvGeneration,
            unitCount: 0,
            units: []
        }));
    }

    /**
     * Get system load (KSE)
     */
    async getSystemLoad() {
        try {
            // PSE API nie wspiera OData dla kse-load endpoint
            const data = await this.request('kse-load');
            
            if (!data || !data.value) {
                console.warn('No system load data received');
                return this.getMockSystemLoadData();
            }

            return this.processSystemLoadData(data.value);

        } catch (error) {
            console.error('Failed to get system load:', error);
            return this.getMockSystemLoadData();
        }
    }

    /**
 * Get redispatch data (ograniczenia operacyjne)
 */
async getRedispatchData(date = null) {
    try {
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        // Pobierz ograniczenia operacyjne
        const params = {
            '$filter': `business_date eq '${targetDate}'`,
            '$orderby': 'from_dtime asc',
            '$first': 5000
        };
        
        const data = await this.request('ogr-oper', params);
        
        if (!data || !data.value) {
            console.warn('No redispatch data received');
            return [];
        }
        
        return this.processRedispatchData(data.value);
        
    } catch (error) {
        console.error('Failed to get redispatch data:', error);
        return [];
    }
}

/**
 * Process redispatch data for cumulative chart
 */
/**
 * Get operational constraints (redispatch) data for whole year
 */
async getOperationalConstraints(endDate = null) {
    try {
        const today = endDate || new Date();
        const startOfYear = new Date(today.getFullYear(), 0, 1); // 1 stycznia
        
        // Używamy właściwego endpointu poze-redoze
        const params = {
            '$filter': `business_date ge '${startOfYear.toISOString().split('T')[0]}' and business_date le '${today.toISOString().split('T')[0]}'`,
            '$orderby': 'business_date asc',
            '$first': 50000
        };
        
        console.log('📊 Fetching OZE redispatch from:', startOfYear.toISOString().split('T')[0], 'to:', today.toISOString().split('T')[0]);
        
        const data = await this.request('poze-redoze', params); // <- ZMIANA TUTAJ
        
        if (!data || !data.value || data.value.length === 0) {
            console.warn('No OZE redispatch data');
            return this.getMockYearlyRedispatchData();
        }
        
        console.log(`✅ Got ${data.value.length} OZE redispatch records`);
        return this.processYearlyOZERedispatch(data.value); // <- NOWA METODA
        
    } catch (error) {
        console.error('Failed to get OZE redispatch data:', error);
        return this.getMockYearlyRedispatchData();
    }
}

/**
 * Process yearly OZE redispatch data from poze-redoze API
 */
/**
 * Process yearly OZE redispatch data from poze-redoze API
 */
processYearlyOZERedispatch(rawData) {
    const dailyData = {};
    let totalEnergy = 0;
    
    // Grupuj dane po dniach, ale NIE sumuj wielokrotnie!
    const groupedByDay = {};
    
    rawData.forEach(item => {
        const dayKey = item.business_date;
        if (!groupedByDay[dayKey]) {
            groupedByDay[dayKey] = [];
        }
        groupedByDay[dayKey].push(item);
    });
    
    // Dla każdego dnia weź tylko JEDNĄ wartość (np. ostatnią z dnia)
    // lub jeśli to są przyrosty - sumuj je
    Object.keys(groupedByDay).forEach(dayKey => {
        const dayRecords = groupedByDay[dayKey];
        
        // Sprawdź czy to są wartości skumulowane czy przyrostowe
        // Jeśli mamy wiele rekordów na dzień, to prawdopodobnie są to 15-minutówki
        if (dayRecords.length > 1) {
    // To są 15-minutówki - ale mogą być wartości godzinowe powtórzone!
    let dayTotal = 0;
    let pvTotal = 0;
    let windTotal = 0;
    
    dayRecords.forEach(record => {
        const pvReduction = Math.abs(record.pv_red_balance || 0) + Math.abs(record.pv_red_network || 0);
        const windReduction = Math.abs(record.wi_red_balance || 0) + Math.abs(record.wi_red_network || 0);
        dayTotal += pvReduction + windReduction;
        pvTotal += pvReduction;
        windTotal += windReduction;
    });
    
    // WAŻNE: Jeśli mamy 96 rekordów (24h * 4), to prawdopodobnie są to wartości godzinowe
    // powtórzone dla każdego 15-minutowego interwału. Trzeba podzielić przez 4!
    if (dayRecords.length >= 96) {
        dayTotal = dayTotal / 4;
        pvTotal = pvTotal / 4;
        windTotal = windTotal / 4;
        console.log(`📊 Adjusted for 15-min intervals: ${dayKey} - ${dayRecords.length} records -> ${dayTotal.toFixed(2)} MWh`);
    }
    
    dailyData[dayKey] = {
        date: dayKey,
        energy: dayTotal,
        pvEnergy: pvTotal,
        windEnergy: windTotal,
        intervals: dayRecords.length
    };
}
        
        totalEnergy += dailyData[dayKey].energy;
    });
    
    // Sortuj dni i oblicz wartości skumulowane
    const sortedDays = Object.keys(dailyData).sort();
    const cumulativeData = [];
    let cumulative = 0;
    
    sortedDays.forEach(day => {
        cumulative += dailyData[day].energy;
        cumulativeData.push({
            date: day,
            dailyEnergy: dailyData[day].energy,
            cumulativeEnergy: cumulative,
            pvEnergy: dailyData[day].pvEnergy,
            windEnergy: dailyData[day].windEnergy,
            intervals: dailyData[day].intervals
        });
    });
    
    // Sprawdź czy wartości są sensowne
    const avgDailyEnergy = totalEnergy / sortedDays.length;
    console.log('📊 Sanity check:', {
        avgDailyEnergyMWh: avgDailyEnergy.toFixed(2),
        avgDailyEnergyGWh: (avgDailyEnergy / 1000).toFixed(3),
        typicalIntervalsPerDay: dailyData[sortedDays[0]]?.intervals || 0,
        firstDayEnergy: dailyData[sortedDays[0]]?.energy.toFixed(2) + ' MWh'
    });
    
    console.log('📊 Yearly OZE redispatch summary:', {
        totalDays: sortedDays.length,
        totalEnergy: totalEnergy.toFixed(2) + ' MWh',
        totalEnergyGWh: (totalEnergy / 1000).toFixed(2) + ' GWh',
        avgDailyEnergy: avgDailyEnergy.toFixed(2) + ' MWh/day',
        lastDay: sortedDays[sortedDays.length - 1]
    });
    
    return {
        daily: cumulativeData,
        total: cumulative,
        summary: {
            totalEnergy: totalEnergy,
            totalEnergyGWh: totalEnergy / 1000,
            daysWithRedispatch: sortedDays.length,
            averageDaily: avgDailyEnergy,
            firstDay: sortedDays[0],
            lastDay: sortedDays[sortedDays.length - 1]
        }
    };
}
    /**
     * Get price data (RCE)
     */
    async getPriceData() {
        try {
            // PSE API nie wspiera OData dla price-fcst endpoint
            const data = await this.request('price-fcst');
            
            if (!data || !data.value) {
                return this.getMockPriceData();
            }

            return this.processPriceData(data.value);

        } catch (error) {
            console.error('Failed to get price data:', error);
            return this.getMockPriceData();
        }
    }
/**
 * Get KSE demand data (forecast and actual)
 */
async getKSEDemandData(period = 'today') {
    console.log('🔄 Getting KSE demand data for period:', period);
    
    try {
        const today = new Date().toISOString().split('T')[0];
        let params = {};
        
        // Filtruj po business_date jeśli API to wspiera
        if (period === 'today') {
            params['$filter'] = `business_date eq '${today}'`;
        } else if (period === '3days') {
            const startDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            params['$filter'] = `business_date ge '${startDate}' and business_date le '${today}'`;
        } else if (period === 'week') {
            const startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            params['$filter'] = `business_date ge '${startDate}' and business_date le '${today}'`;
        }
        
        params['$orderby'] = 'dtime asc';
        params['$first'] = period === 'week' ? 2000 : 1000;
        
        console.log('Request params:', params);
        
        // Użyj endpointu kse-load który zawiera oba typy danych
        const data = await this.request('kse-load', params);
        
        console.log('Raw API response:', data);
        
        if (!data || !data.value || data.value.length === 0) {
            console.warn('No data from API, using mock');
            return this.getMockKSEDemandData(period);
        }
        
        return this.processKSEDemandData(data.value, null);
        
    } catch (error) {
        console.error('Failed to get KSE demand data:', error);
        return this.getMockKSEDemandData(period);
    }
}
/**
 * Process KSE demand data
 */processKSEDemandData(forecastRaw, actualRaw) {
    const data = {
        labels: [],
        forecast: [],
        actual: []
    };
    
    console.log('Processing KSE demand data:', { forecastRaw, actualRaw });
    
    // Mapa czasów do wartości
    const dataMap = new Map();
    
    // Przetwórz dane - endpoint kse-load zawiera zarówno forecast jak i actual
    if (forecastRaw && forecastRaw.length > 0) {
        forecastRaw.forEach(item => {
            const time = new Date(item.dtime);
            const timeKey = time.toISOString();
            
            // Pobierz wartości
            const forecast = parseFloat(item.load_fcst || 0);
            const actual = parseFloat(item.load_actual || 0);
            
            if (!isNaN(time.getTime())) {
                dataMap.set(timeKey, {
                    time: time,
                    forecast: forecast,
                    actual: actual > 0 ? actual : null, // null jeśli brak rzeczywistej wartości
                    period: item.period
                });
            }
        });
    }
    
    // Sortuj po czasie
    const sortedTimes = Array.from(dataMap.keys()).sort();
    
    console.log('Processed data points:', sortedTimes.length);
    
    // Jeśli brak danych, użyj mocka
    if (sortedTimes.length === 0) {
        console.warn('No data processed, using mock data');
        return this.getMockKSEDemandData('today');
    }
    
    // Przygotuj dane do wykresu
    sortedTimes.forEach(timeKey => {
        const item = dataMap.get(timeKey);
        
        data.labels.push(item.time.toLocaleString('pl-PL', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }));
        data.forecast.push(item.forecast);
        data.actual.push(item.actual);
    });
    
    return data;
}
/**
 * Mock KSE demand data
 */
getMockKSEDemandData(period) {
    const data = {
        labels: [],
        forecast: [],
        actual: []
    };
    
    const hours = period === 'week' ? 168 : period === '3days' ? 72 : 24;
    const now = new Date();
    
    for (let i = 0; i < hours; i++) {
        const time = new Date(now.getTime() - (hours - i) * 60 * 60 * 1000);
        const hour = time.getHours();
        
        // Symulacja krzywej zapotrzebowania
        const baseLoad = 14000;
        const peakFactor = (hour >= 7 && hour <= 21) ? 1.3 : 0.95;
        const randomFactor = 0.95 + Math.random() * 0.1;
        
        const forecast = baseLoad * peakFactor * randomFactor;
        const actual = i < hours - 2 ? forecast * (0.98 + Math.random() * 0.04) : null;
        
        data.labels.push(time.toLocaleString('pl-PL', {
            day: '2-digit',
            month: '2-digit', 
            hour: '2-digit',
            minute: '2-digit'
        }));
        data.forecast.push(forecast);
        data.actual.push(actual);
    }
    
    return data;
}
    /**
     * Get transmission constraints
     */
    async getTransmissionConstraints() {
        try {
            const data = await this.request('ogr-oper');
            
            if (!data || !data.value) {
                return [];
            }

            return this.processConstraintsData(data.value);

        } catch (error) {
            console.error('Failed to get constraints:', error);
            return [];
        }
    }

    /**
     * Get PV distribution data with 15-minute intervals
     */
    async getPVDistributionData() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const params = {
                '$filter': `business_date eq '${today}'`,
                '$orderby': 'dtime asc',
                '$first': 2000, // Get all 15-minute intervals
                '$select': 'dtime,gen_fv,gen_wi,gen_jgw_zak_1,gen_jgw_zak_2,gen_jgm_zak_1,gen_jgm_zak_2,gen_jgz_zak_1,gen_jgz_zak_2,gen_jgz_zak_3,gen_jga,gen_jgo'
            };
            
            // Use pdgobpkd endpoint for detailed data
            const data = await this.request('pdgobpkd', params);
            
            if (!data || !data.value) {
                console.warn('No PV distribution data received');
                return this.getMockPVDistributionData();
            }

            return this.processPVDistributionData(data.value);

        } catch (error) {
            console.error('Failed to get PV distribution:', error);
            return this.getMockPVDistributionData();
        }
    }

    /**
     * Get all dashboard data including 15-minute intervals
     */
    async getAllDashboardData() {
        console.log('🔄 Fetching all dashboard data...');
        
        const [renewableGeneration, systemLoad, prices, constraints, pvDistribution, fullGenerationData] = await Promise.allSettled([
            this.getCurrentRenewableGeneration(),
            this.getSystemLoad(),
            this.getPriceData(),
            this.getTransmissionConstraints(),
            this.getPVDistributionData(),
            this.getFullGenerationData(), // New method for 15-minute data
            this.getOperationalConstraints()
        ]);

        // Process renewable data for backward compatibility
        const pvGeneration = renewableGeneration.status === 'fulfilled' 
            ? renewableGeneration.value.map(item => ({
                hour: item.hour,
                totalPower: item.pvGeneration,
                unitCount: 0,
                units: [],
    /**
     * Real-time data stream simulation
     */
    startRealTimeUpdates(callback, interval = 30000) {
        console.log(`⏰ Starting real-time updates every ${interval}ms`);
        
        return setInterval(async () => {
            try {
                const data = await this.getAllDashboardData();
                callback(data);
            } catch (error) {
                console.error('Real-time update failed:', error);
            }
        }, interval);
    }
})) 
            : this.getMockPVData();

        return {
            pvGeneration: pvGeneration,
            windGeneration: renewableGeneration.status === 'fulfilled' 
                ? renewableGeneration.value.map(item => ({
                    hour: item.hour,
                    totalPower: item.windGeneration
                }))
                : [],
            renewableGeneration: renewableGeneration.status === 'fulfilled' ? renewableGeneration.value : [],
            systemLoad: systemLoad.status === 'fulfilled' ? systemLoad.value : this.getMockSystemLoadData(),
            prices: prices.status === 'fulfilled' ? prices.value : this.getMockPriceData(),
            constraints: constraints.status === 'fulfilled' ? constraints.value : [],
            pvDistribution: pvDistribution.status === 'fulfilled' ? pvDistribution.value : this.getMockPVDistributionData(),
            fullGenerationData: fullGenerationData.status === 'fulfilled' ? fullGenerationData.value : this.getMockFullGenerationData(),
            timestamp: new Date()
        };
    }

    /**
     * Get full generation data with 15-minute intervals for stackplot
     */
    async getFullGenerationData() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const params = {
                '$filter': `business_date eq '${today}'`,
                '$orderby': 'dtime asc',
                '$first': 2000 // Get all 15-minute intervals for the day
            };
            
            const data = await this.request('pdgobpkd', params);
            
            if (!data || !data.value) {
                console.warn('No full generation data received');
                return this.getMockFullGenerationData();
            }

            return data.value;

        } catch (error) {
            console.error('Failed to get full generation data:', error);
            return this.getMockFullGenerationData();
        }
    }

    /**
     * Process renewable generation data (PV and Wind)
     */
    processRenewableData(rawData) {
    const processed = [];
    
    // Group by hour - dla danych godzinowych
    const hourlyData = {};
    
    rawData.forEach(item => {
        // Sprawdź strukturę danych
        const hour = this.extractHour(item.dtime || item.business_date);
        
        if (!hourlyData[hour]) {
            hourlyData[hour] = {
                hour: hour,
                pvGeneration: 0,
                windGeneration: 0,
                totalRenewable: 0,
                systemLoad: 0,
                timestamp: new Date(item.dtime || Date.now()),
                count: 0
            };
        }
        
        // Dla danych 15-minutowych - uśredniamy wartości w godzinie
        hourlyData[hour].pvGeneration += parseFloat(item.gen_fv || 0);
        hourlyData[hour].windGeneration += parseFloat(item.gen_wi || 0);
        hourlyData[hour].systemLoad += parseFloat(item.kse_pow_dem || 0);
        hourlyData[hour].count += 1;
    });
    
    // Konwertuj na tablicę i uśrednij wartości
    for (let hour = 0; hour < 24; hour++) {
        if (hourlyData[hour] && hourlyData[hour].count > 0) {
            const data = hourlyData[hour];
            processed.push({
                hour: hour,
                pvGeneration: data.pvGeneration / data.count, // Średnia dla godziny
                windGeneration: data.windGeneration / data.count,
                totalRenewable: (data.pvGeneration + data.windGeneration) / data.count,
                systemLoad: data.systemLoad / data.count,
                timestamp: data.timestamp
            });
        } else {
            // Brak danych dla tej godziny
            processed.push({
                hour: hour,
                pvGeneration: 0,
                windGeneration: 0,
                totalRenewable: 0,
                systemLoad: 0,
                timestamp: new Date()
            });
        }
    }
    
    return processed;
}

    processSystemLoadData(rawData) {
        if (Array.isArray(rawData) && rawData.length > 0) {
            // Grupuj dane po godzinach i znajdź najnowsze wartości
            const hourlyData = {};
            
            rawData.forEach(item => {
                const hour = this.extractHour(item.from_dtime || item.publication_ts);
                const load = parseFloat(item.value || item.load || 0);
                
                if (!hourlyData[hour] || new Date(item.from_dtime) > new Date(hourlyData[hour].timestamp)) {
                    hourlyData[hour] = {
                        hour: hour,
                        load: load,
                        timestamp: new Date(item.from_dtime || item.publication_ts || Date.now())
                    };
                }
            });
            
            // Konwertuj do tablicy
            const result = [];
            for (let hour = 0; hour < 24; hour++) {
                result.push(hourlyData[hour] || {
                    hour: hour,
                    load: 0,
                    timestamp: new Date()
                });
            }
            
            return result;
        }

        // If single value, create hourly array
        const processed = [];
        const baseLoad = 20000;
        
        for (let hour = 0; hour < 24; hour++) {
            processed.push({
                hour: hour,
                load: baseLoad * (0.8 + 0.4 * Math.sin((hour - 6) * Math.PI / 12)),
                timestamp: new Date()
            });
        }

        return processed;
    }

    processPriceData(rawData) {
        if (Array.isArray(rawData)) {
            return rawData.map(item => {
                const hour = this.extractHour(item.from_dtime || item.publication_ts);
                return {
                    hour: hour,
                    price: parseFloat(item.value || item.price || 0),
                    type: 'Forecast'
                };
            });
        }

        return this.getMockPriceData();
    }

    processConstraintsData(rawData) {
        return rawData.map(constraint => ({
            area: constraint.node || constraint.limiting_element || 'Unknown',
            resourceName: constraint.resource_name || '',
            type: constraint.direction || 'transmission',
            minPower: parseFloat(constraint.pol_min_power_of_unit || 0),
            maxPower: parseFloat(constraint.pol_max_power_of_unit || 0),
            from: new Date(constraint.from_dtime || Date.now()),
            to: new Date(constraint.to_dtime || Date.now()),
            value: (parseFloat(constraint.pol_max_power_of_unit || 0) - parseFloat(constraint.pol_min_power_of_unit || 0)),
            unit: 'MW',
            direction: constraint.direction || 'both',
            timestamp: new Date(constraint.publication_ts || Date.now())
        }));
    }

    /**
 * Process PV distribution data - POPRAWIONA WERSJA
 */
processPVDistributionData(rawData) {
    const processed = {
        timestamps: [],
        pvGeneration: [],
        totalGeneration: [],
        pvPercentage: [],
        portfolioGeneration: []
    };
    
    const portfolioCapacity = window.PortfolioCalculator?.getPortfolioSettings()?.defaultCapacity || 25.5;
    
    rawData.forEach(item => {
        // PSE API zwraca dane z końcem okresu, np. 15:15 to dane za okres 15:00-15:15
        const timestamp = new Date(item.dtime);
        // Cofnij o 15 minut aby pokazać początek okresu
        timestamp.setMinutes(timestamp.getMinutes() - 15);
        
        const pvGen = parseFloat(item.gen_fv || 0);
        const totalGen = Math.max(1,
            parseFloat(item.gen_fv || 0) +
            parseFloat(item.gen_wi || 0) +
            parseFloat(item.gen_jgw_zak_1 || 0) +
            parseFloat(item.gen_jgw_zak_2 || 0) +
            parseFloat(item.gen_jgm_zak_1 || 0) +
            parseFloat(item.gen_jgm_zak_2 || 0) +
            parseFloat(item.gen_jgz_zak_1 || 0) +
            parseFloat(item.gen_jgz_zak_2 || 0) +
            parseFloat(item.gen_jgz_zak_3 || 0) +
            parseFloat(item.gen_jga || 0) +
            parseFloat(item.gen_jgo || 0)
        );
        
        const pvPercent = (pvGen / totalGen) * 100;
        const portfolioGen = (pvPercent / 100) * portfolioCapacity;
        
        processed.timestamps.push(timestamp);
        processed.pvGeneration.push(pvGen);
        processed.totalGeneration.push(totalGen);
        processed.pvPercentage.push(pvPercent);
        processed.portfolioGeneration.push(portfolioGen);
    });
    
    return processed;
}
    /**
 * Helper to extract hour from datetime string with timezone handling
 */
extractHour(dateTimeStr) {
    if (!dateTimeStr) return new Date().getHours();
    try {
        const date = new Date(dateTimeStr);
        // PSE API zwraca czas w UTC+2 (CEST) lub UTC+1 (CET)
        // Konwertuj na czas lokalny Polski
        return date.getHours();
    } catch (e) {
        return new Date().getHours();
    }
}

    /**
     * Cache management
     */
    cacheData(endpoint, data) {
        this.cache.set(endpoint, {
            data: data,
            timestamp: Date.now()
        });
    }

    getCachedData(endpoint) {
        const cached = this.cache.get(endpoint);
        if (cached && (Date.now() - cached.timestamp < 300000)) { // 5 min cache
            return cached.data;
        }
        return null;
    }

    /**
     * Mock data for development/fallback
     */
    getMockPVData() {
        console.log('📊 Using mock PV data');
        const data = [];
        const now = new Date();
        const currentHour = now.getHours();
        
        for (let hour = 0; hour < 24; hour++) {
            const sunFactor = Math.max(0, Math.sin((hour - 6) * Math.PI / 12));
            const cloudFactor = 0.7 + Math.random() * 0.3;
            
            data.push({
                hour: hour,
                totalPower: sunFactor * cloudFactor * 12000, // Max 12GW PV in Poland
                unitCount: Math.floor(1000 + Math.random() * 500),
                units: []
            });
        }
        
        return data;
    }

    getMockSystemLoadData() {
        console.log('📊 Using mock system load data');
        const data = [];
        
        for (let hour = 0; hour < 24; hour++) {
            const baseDemand = 20000; // 20GW base
            const peakFactor = hour >= 7 && hour <= 21 ? 1.2 : 0.9;
            const randomFactor = 0.95 + Math.random() * 0.1;
            
            data.push({
                hour: hour,
                load: baseDemand * peakFactor * randomFactor,
                timestamp: new Date()
            });
        }
        
        return data;
    }

    getMockPriceData() {
        console.log('📊 Using mock price data');
        const data = [];
        
        for (let hour = 0; hour < 24; hour++) {
            const basePrice = 400; // 400 PLN/MWh base
            const peakMultiplier = (hour >= 17 && hour <= 20) ? 1.5 : 1.0;
            const nightMultiplier = (hour >= 23 || hour <= 5) ? 0.7 : 1.0;
            
            data.push({
                hour: hour,
                price: basePrice * peakMultiplier * nightMultiplier * (0.8 + Math.random() * 0.4),
                type: 'RCE'
            });
        }
        
        return data;
    }

    /**
     * Mock data for renewable generation
     */
    getMockRenewableData() {
        console.log('📊 Using mock renewable data');
        const data = [];
        const now = new Date();
        const currentHour = now.getHours();
        
        for (let hour = 0; hour < 24; hour++) {
            const sunFactor = Math.max(0, Math.sin((hour - 6) * Math.PI / 12));
            const windFactor = 0.3 + Math.random() * 0.7; // Wiatr bardziej losowy
            
            data.push({
                hour: hour,
                pvGeneration: sunFactor * 0.7 * 12000, // Max 8.4GW PV
                windGeneration: windFactor * 8000, // Max 8GW wiatr
                totalRenewable: 0,
                timestamp: new Date()
            });
            
            data[hour].totalRenewable = data[hour].pvGeneration + data[hour].windGeneration;
        }
        
        return data;
    }

    /**
     * Mock PV distribution data
     */
    getMockPVDistributionData() {
        console.log('📊 Using mock PV distribution data');
        const data = {
            timestamps: [],
            pvGeneration: [],
            totalGeneration: [],
            pvPercentage: [],
            portfolioGeneration: []
        };
        
        const portfolioCapacity = 25.5; // MW
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        // Generate 15-minute intervals for the day
        for (let i = 0; i < 96; i++) { // 24h * 4 = 96 intervals
            const timestamp = new Date(now.getTime() + i * 15 * 60 * 1000);
            const hour = timestamp.getHours();
            const minute = timestamp.getMinutes();
            
            // Simulate PV generation curve
            const sunFactor = Math.max(0, Math.sin((hour + minute/60 - 6) * Math.PI / 12));
            const cloudFactor = 0.7 + Math.random() * 0.3;
            const pvGen = sunFactor * cloudFactor * 12000; // Max 12GW
            
            // Simulate total generation
            const baseDemand = 20000;
            const peakFactor = (hour >= 7 && hour <= 21) ? 1.2 : 0.9;
            const totalGen = baseDemand * peakFactor * (0.95 + Math.random() * 0.1);
            
            const pvPercent = (pvGen / totalGen) * 100;
            const portfolioGen = (pvPercent / 100) * portfolioCapacity;
            
            data.timestamps.push(timestamp);
            data.pvGeneration.push(pvGen);
            data.totalGeneration.push(totalGen);
            data.pvPercentage.push(pvPercent);
            data.portfolioGeneration.push(portfolioGen);
        }
        
        return data;
    }

    /**
     * Real-time data stream simulation
     */
    startRealTimeUpdates(callback, interval = 30000) {
        console.log(`⏰ Starting real-time updates every ${interval}ms`);
        
        return setInterval(async () => {
            try {
                const data = await this.getAllDashboardData();
                callback(data);
            } catch (error) {
                console.error('Real-time update failed:', error);
            }
        }, interval);
    }
}

// Create global instance
window.PSEApiService = new PSEApiService();

console.log('✅ PSE API Service loaded successfully');

window.PSEAPI = window.PSEAPI || {};

window.PSEAPI.fetchGenerationForecast = async function(dayStr) {
    const url = `https://v2.api.raporty.pse.pl/api/pdgobpkd?$filter=business_date eq '${dayStr}'&$orderby=business_date asc&$first=20000`;
    const response = await fetch(url);
    const json = await response.json();
    return json.value;
};
