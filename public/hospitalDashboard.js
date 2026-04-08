console.log('🏥', window.HOSPITAL_NAME, 'Dashboard - Enhanced Version');
console.log('Connecting to server...');
console.log('Hospital ID:', window.HOSPITAL_ID);

const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
});

const connectionStatus = document.getElementById('connection-status');
const alertsContainer = document.getElementById('alerts-container');
const statsActive = document.getElementById('stats-active');
const statsTotal = document.getElementById('stats-total');
const statsToday = document.getElementById('stats-today');

let alerts = [];
let totalAlerts = 0;
let todayAlerts = 0;

socket.on('connect', () => {
    console.log('✅ Connected to server');
    console.log('Socket ID:', socket.id);
    console.log('Registering as:', window.HOSPITAL_ID);
    socket.emit('register-hospital', window.HOSPITAL_ID);
    connectionStatus.textContent = 'Online';
    connectionStatus.style.color = '#4caf50';
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error);
    connectionStatus.textContent = 'Connection Error';
    connectionStatus.style.color = '#d32f2f';
});

socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected:', reason);
    connectionStatus.textContent = 'Offline';
    connectionStatus.style.color = '#d32f2f';
});

socket.on('registration-confirmed', (data) => {
    console.log('✅ Registered:', data);
    connectionStatus.textContent = 'Online';
    connectionStatus.style.color = '#4caf50';
});

socket.on('emergency-notification', (data) => {
    console.log('\n🚨 EMERGENCY ALERT!');
    console.log('  Alert ID:', data.alertId);
    console.log('  Location:', data.location);
    console.log('  FSR Value:', data.fsrValue);
    
    // Prevent duplicate alerts
    if (alerts.find(a => a.id === data.alertId)) {
        console.log('⚠️ Duplicate alert ignored');
        return;
    }
    
    addAlert(data);
    playAlarmSound();
    updateStats();
});

socket.on('emergency-cancelled', () => {
    console.log('✅ Emergency cancelled');
});

function addAlert(data) {
    // Validate location data
    const location = data.location && data.location.address ? data.location : {
        address: 'Location unavailable',
        latitude: 0,
        longitude: 0,
        city: 'Unknown',
        nearestHospital: 'Unknown'
    };
    
    const alert = {
        id: data.alertId,
        timestamp: new Date(data.timestamp),
        location: location,
        fsrValue: data.fsrValue,
        reason: data.reason,
        status: 'active'
    };
    
    alerts.unshift(alert);
    totalAlerts++;
    todayAlerts++;
    
    console.log('✅ Alert added:', alert);
    
    renderAlerts();
}

function renderAlerts() {
    if (alerts.length === 0) {
        alertsContainer.innerHTML = `
            <div class="no-alerts">
                <div class="no-alerts-icon">✓</div>
                <h3>No Active Emergencies</h3>
                <p>System is monitoring. All clear.</p>
            </div>
        `;
        return;
    }
    
    alertsContainer.innerHTML = alerts.map(alert => `
        <div class="alert-card ${alert.status}" data-id="${alert.id}">
            <div class="alert-header">
                <div class="alert-id">
                    <span class="alert-badge">🚨</span>
                    <strong>${alert.id}</strong>
                </div>
                <div class="alert-time">${formatTime(alert.timestamp)}</div>
            </div>
            
            <div class="alert-body">
                <div class="alert-info">
                    <div class="info-row">
                        <span class="info-label">📍 Location:</span>
                        <span class="info-value">${alert.location.address}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">🔢 FSR Value:</span>
                        <span class="info-value">${alert.fsrValue}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">⚠️ Reason:</span>
                        <span class="info-value">${alert.reason}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">📊 Coordinates:</span>
                        <span class="info-value">${alert.location.latitude}, ${alert.location.longitude}</span>
                    </div>
                </div>
                
                <div class="alert-map">
                    <iframe 
                        width="100%" 
                        height="200" 
                        frameborder="0" 
                        style="border:0; border-radius: 8px;" 
                        src="https://www.google.com/maps?q=${alert.location.latitude},${alert.location.longitude}&output=embed"
                        allowfullscreen>
                    </iframe>
                </div>
            </div>
            
            <div class="alert-actions">
                <button class="btn-action btn-navigate" onclick="navigateToLocation('${alert.location.latitude}', '${alert.location.longitude}')">
                    🗺️ Navigate
                </button>
                <button class="btn-action btn-accept" onclick="acceptAlert('${alert.id}')">
                    ✅ Accept
                </button>
                <button class="btn-action btn-complete" onclick="completeAlert('${alert.id}')">
                    ✓ Complete
                </button>
            </div>
        </div>
    `).join('');
}

function acceptAlert(alertId) {
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
        alert.status = 'accepted';
        console.log('✅ Alert accepted:', alertId);
        renderAlerts();
    }
}

function completeAlert(alertId) {
    alerts = alerts.filter(a => a.id !== alertId);
    console.log('✓ Alert completed:', alertId);
    renderAlerts();
    updateStats();
}

function navigateToLocation(lat, lng) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
}

function updateStats() {
    statsActive.textContent = alerts.length;
    statsTotal.textContent = totalAlerts;
    statsToday.textContent = todayAlerts;
}

function formatTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return date.toLocaleTimeString();
}

function playAlarmSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 1000;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.2;
    
    oscillator.start();
    
    setTimeout(() => oscillator.stop(), 500);
    setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        osc2.connect(gainNode);
        osc2.frequency.value = 1200;
        osc2.start();
        setTimeout(() => osc2.stop(), 500);
    }, 600);
}

// Initialize
updateStats();
renderAlerts();

console.log(window.HOSPITAL_NAME, 'dashboard ready');
