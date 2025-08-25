/**
 * Enspirion Dashboard - Configuration
 * Główny plik konfiguracyjny aplikacji
 */

// ================================
// PSE API CONFIGURATION
// ================================
const PSE_CONFIG = {
    baseUrl: 'https://apimpdv2-bmgdhhajexe8aade.a01.azurefd.net/api/',
    timeout: 5000, // 5 seconds for real-time
    retries: 2,
    rateLimit: {
        maxRequests: 200,
        windowMs: 60000 // 1 minute
    },
    
    // Mapowanie endpointów PSE API do naszych funkcji
    endpoints: {
        // Generacja jednostek wytwórczych (PV)
        generation: 'pdgobpkd',
        
        // Obciążenie KSE
        systemLoad: 'kse-load',
        
        // Ograniczenia operacyjne (redysponowanie)
        operationalLimits: 'ogr-oper',
        
        // Ograniczenia dobowe D+1
        dailyLimitsD1: 'ogr-d1',
        
        // Prognozy cen (pośrednio prognozy generacji)
        priceForecasts: 'price-fcst',
        
        // Dane historyczne generacji
        historicalGeneration: 'his-gen-pal',
        
        // Bilanse mocy historyczne
        powerBalances: 'his-bil-mocy',
        
        // Pozwolenia OZE
        renewablePermits: 'poze-redoze'
    }
};

// ================================
// BUSINESS CONFIGURATION
// ================================
const BUSINESS_CONFIG = {
    // Portfolio settings (domyślne, można zmieniać w UI)
    portfolio: {
        defaultCapacity: 25.5,        // MW
        efficiency: 0.85,             // 85% sprawność
        availabilityFactor: 0.95,     // 95% dostępność
        degradationRate: 0.005        // 0.5% rocznie
    },
    
    // Pricing and financial
    financial: {
        averageEnergyPrice: 300,      // PLN/MWh
        curtailmentPenalty: 50,       // PLN/MWh - kara za redysponowanie
        maintenanceCost: 2,           // PLN/MWh - koszt utrzymania
        operatingCost: 5              // PLN/MWh - koszt operacyjny
    },
    
    // Risk calculation parameters
    risk: {
        // Wagi dla algorytmu ryzyka
        weights: {
            historicalRedispatch: 0.4,  // 40% - historia redysponowania
            currentLimitations: 0.3,    // 30% - obecne ograniczenia
            pvGenerationLevel: 0.2,     // 20% - poziom generacji PV
            systemLoad: 0.1             // 10% - obciążenie systemu
        },
        
        // Progi ryzyka
        thresholds: {
            low: 0.25,      // 0-25% = niskie
            medium: 0.5,    // 25-50% = średnie  
            high: 0.75      // 50-75% = wysokie, 75-100% = krytyczne
        }
    }
};

// ================================
// UI CONFIGURATION
// ================================
const UI_CONFIG = {
    // Refresh intervals (milliseconds)
    refreshIntervals: {
        realTimeData: 30000,        // 30 sekund - real-time monitoring (zmienione z 5s)
        chartsData: 60000,          // 1 minuta - wykresy (zmienione z 10s)  
        gridStatus: 120000,         // 2 minuty - stan sieci (zmienione z 30s)
        historicalData: 300000      // 5 minut - dane historyczne
    },
    
    // Chart colors (Enspirion + PSE style)
    colors: {
        // Primary Enspirion colors
        primary: '#722F37',
        secondary: '#A0182B', 
        accent: '#C41E3A',
        
        // PSE-style colors dla wykresów
        demand: '#0066cc',           // Niebieski - zapotrzebowanie
        pvForecast: '#00aa44',       // Zielony - prognoza PV
        pvActual: '#ff7700',         // Pomarańczowy - rzeczywista PV
        portfolioLine: '#722F37',    // Burgundy - linia portfolio
        
        // Risk levels
        riskLow: '#10b981',         // Zielony
        riskMedium: '#f59e0b',      // Żółty
        riskHigh: '#f97316',        // Pomarańczowy
        riskCritical: '#ef4444',    // Czerwony
        
        // Redispatch severity
        redispatchLow: '#3b82f6',    // Niebieski
        redispatchMedium: '#f59e0b', // Żółty
        redispatchHigh: '#ef4444',   // Czerwony
        
        // System colors
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
        
        // UI colors
        background: '#f9fafb',
        surface: '#ffffff',
        border: '#e5e7eb',
        text: '#1f2937',
        textSecondary: '#6b7280'
    },
    
    // Animation settings
    animations: {
        enabled: true,
        duration: 300,              // ms
        easing: 'ease-in-out'
    },
    
    // Mobile breakpoints
    breakpoints: {
        mobile: 768,
        tablet: 1024,
        desktop: 1440
    }
};

// ================================
// DATA PROCESSING CONFIGURATION
// ================================
const DATA_CONFIG = {
    // Cache settings
    cache: {
        enabled: true,
        ttl: {
            liveData: 60000,        // 1 minuta
            hourlyData: 300000,     // 5 minut
            dailyData: 3600000,     // 1 godzina
            historicalData: 86400000 // 24 godziny
        },
        maxSize: 100 // maksymalna liczba wpisów w cache
    },
    
    // Data validation rules
    validation: {
        // Sprawdzanie poprawności danych z PSE API
        generation: {
            minValue: 0,
            maxValue: 50000,        // MW - maksymalna generacja PV w KSE
            requiredFields: ['business_date', 'hour', 'power', 'resource_name']
        },
        
        systemLoad: {
            minValue: 10000,        // MW - minimalne obciążenie KSE
            maxValue: 30000,        // MW - maksymalne obciążenie KSE
            requiredFields: ['business_date', 'hour', 'load']
        },
        
        redispatch: {
            requiredFields: ['business_date', 'from_dtime', 'to_dtime', 'resource_name', 'direction']
        }
    },
    
    // Data transformation settings
    transformation: {
        // Jak agregować dane PV z wielu jednostek
        pvAggregation: 'sum',       // sum, average, median
        
        // Filtry dla nazw jednostek PV
        pvResourceFilters: [
            'PV',
        'SOLAR',
        'FOTOWOLT',
        'SŁONECZN'
        ],
        
        // Timezone settings
        timezone: 'Europe/Warsaw',
        
        // Number formatting
        numberFormat: {
            locale: 'pl-PL',
            decimals: {
                power: 1,           // MW - 1 miejsce po przecinku
                percentage: 2,      // % - 2 miejsca po przecinku
                currency: 0         // PLN - bez miejsc po przecinku
            }
        }
    }
};

// ================================
// SYSTEM CONFIGURATION
// ================================
const SYSTEM_CONFIG = {
    // App metadata
    app: {
        name: 'Enspirion Professional Dashboard',
        version: '2.0.0',
        build: process.env.BUILD_NUMBER || 'dev',
        environment: process.env.NODE_ENV || 'development'
    },
    
    // Logging configuration
    logging: {
        enabled: true,
        level: 'info',              // debug, info, warn, error
        console: true,
        maxLogEntries: 1000
    },
    
    // Error handling
    errorHandling: {
        showDetails: process.env.NODE_ENV === 'development',
        autoRetry: true,
        maxRetries: 3,
        retryDelay: 1000           // ms
    },
    
    // Performance monitoring
    performance: {
        enabled: true,
        trackingEnabled: false,     // Wyłączone dla corporate firewall
        metricsCollection: true
    },
    
    // Security settings
    security: {
        validateInputs: true,
        sanitizeData: true,
        csrfProtection: false       // Nie potrzebne dla static site
    }
};

// ================================
// FEATURE FLAGS
// ================================
const FEATURE_FLAGS = {
    // Core features
    realTimeUpdates: true,
    chartAnimations: true,
    responsiveDesign: true,
    
    // Advanced features (włączane postupowo)
    advancedForecasting: false,
    weatherIntegration: false,
    multiPortfolioSupport: false,
    alertNotifications: false,      // Wyłączone dla corporate firewall
    exportToPDF: true,
    exportToExcel: true,
    
    // Debugging features
    debugMode: process.env.NODE_ENV === 'development',
    mockData: process.env.USE_MOCK_DATA === 'true',
    verboseLogging: process.env.NODE_ENV === 'development'
};

// ================================
// CONSTANTS
// ================================
const CONSTANTS = {
    // Time constants
    MILLISECONDS_IN_SECOND: 1000,
    SECONDS_IN_MINUTE: 60,
    MINUTES_IN_HOUR: 60,
    HOURS_IN_DAY: 24,
    DAYS_IN_WEEK: 7,
    
    // Business constants
    AVERAGE_PV_CAPACITY_POLAND: 15000, // MW - szacowana moc PV w Polsce
    PEAK_SUN_HOURS: [10, 11, 12, 13, 14, 15, 16], // Godziny największej generacji PV
    WORKING_DAYS: [1, 2, 3, 4, 5],     // Poniedziałek - Piątek
    
    // UI constants
    MAX_CHART_POINTS: 1000,            // Maksymalna liczba punktów na wykresie
    ANIMATION_DURATION: 300,           // ms
    MOBILE_BREAKPOINT: 768,            // px
    
    // API constants
    MAX_API_RETRIES: 3,
    API_TIMEOUT: 10000,                // ms
    RATE_LIMIT_REQUESTS: 100,
    RATE_LIMIT_WINDOW: 60000           // ms
};

// ================================
// EXPORT CONFIGURATION
// ================================
// Tworzymy globalny obiekt konfiguracji
window.EnspirionConfig = {
    PSE: PSE_CONFIG,
    BUSINESS: BUSINESS_CONFIG,
    UI: UI_CONFIG,
    DATA: DATA_CONFIG,
    SYSTEM: SYSTEM_CONFIG,
    FEATURES: FEATURE_FLAGS,
    CONSTANTS: CONSTANTS,
    
    // Helper functions
    getRefreshInterval: (type) => UI_CONFIG.refreshIntervals[type] || 60000,
    getColor: (name) => UI_CONFIG.colors[name] || '#666666',
    isFeatureEnabled: (feature) => FEATURE_FLAGS[feature] === true,
    
    // Environment helpers
    isDevelopment: () => SYSTEM_CONFIG.app.environment === 'development',
    isProduction: () => SYSTEM_CONFIG.app.environment === 'production',
    
    // Debug helpers
    enableDebugMode: () => {
        FEATURE_FLAGS.debugMode = true;
        SYSTEM_CONFIG.logging.level = 'debug';
        console.log('🔧 Debug mode enabled');
    },
    
    disableDebugMode: () => {
        FEATURE_FLAGS.debugMode = false;
        SYSTEM_CONFIG.logging.level = 'info';
        console.log('🔧 Debug mode disabled');
    }
};

// Jeśli jesteśmy w development mode, udostępnij config globalnie dla debugowania
if (window.EnspirionConfig.isDevelopment()) {
    window.config = window.EnspirionConfig;
    console.log('🔧 Configuration loaded in development mode');
    console.log('Access via window.config or window.EnspirionConfig');
}

console.log('✅ Enspirion Configuration loaded successfully');