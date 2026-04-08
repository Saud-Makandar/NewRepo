console.log('🏥', window.HOSPITAL_NAME, 'System - ESP32 Version');

// Connect to backend server
// If running backend locally: use 'http://localhost:3000'
// If accessing from other devices: use 'http://YOUR_IP:3000'
const socket = io('http://localhost:3000');

const connectionStatus = document.getElementById('connection-status');
const waitingScreen = document.getElementById('waiting-screen');
const alertScreen = document.getElementById('alert-screen');
const alertTimestamp = document.getElementById('alert-timestamp');
const fsrValue = document.getElementById('fsr-value');

let isAlertShown = false;

socket.on('connect', () => {
    console.log('✅ Connected to server');
    socket.emit('register-hospital', window.HOSPITAL_ID);
    connectionStatus.textContent = 'Connected';
    connectionStatus.style.color = '#4caf50';
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected');
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.style.color = '#d32f2f';
});

socket.on('registration-confirmed', (data) => {
    console.log('✅ Registered:', data);
    connectionStatus.textContent = 'Monitoring Active';
});

socket.on('emergency-notification', (data) => {
    console.log('\n🚨 EMERGENCY ALERT!');
    console.log('  Hospital:', data.selectedHospital);
    console.log('  Reason:', data.reason);
    console.log('  FSR Value:', data.fsrValue);
    console.log('  Time:', data.timestamp);
    console.log('  Location:', data.location);
    
    showEmergencyAlert(data);
});

socket.on('emergency-cancelled', () => {
    console.log('✅ Emergency cancelled');
    if (isAlertShown) {
        hideEmergencyAlert();
    }
});

function showEmergencyAlert(data) {
    isAlertShown = true;
    waitingScreen.style.display = 'none';
    alertScreen.classList.add('show');
    
    const time = new Date(data.timestamp);
    alertTimestamp.textContent = time.toLocaleString();
    fsrValue.textContent = data.fsrValue || 'N/A';
    
    console.log('✅ Alert displayed');
    playAlarmSound();
}

function hideEmergencyAlert() {
    isAlertShown = false;
    waitingScreen.style.display = 'flex';
    alertScreen.classList.remove('show');
    connectionStatus.textContent = 'Monitoring Active';
}

function playAlarmSound() {
    console.log('🔊 Alert sound triggered');
    try {
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
    } catch (e) {
        console.log('Audio not available:', e);
    }
}

console.log(window.HOSPITAL_NAME, 'ready - Waiting for alerts');
