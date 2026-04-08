console.log('🚗 Car Driver System - ESP32 Version');

// Connect to backend server
// Auto-connects to same origin (works for both local and deployed)
const socket = io();

const connectionStatus = document.getElementById('connection-status');
const esp32Status = document.getElementById('esp32-status');
const statusText = document.getElementById('status-text');
const questionPopup = document.getElementById('question-popup');
const emergencyConfirmed = document.getElementById('emergency-confirmed');
const yesButton = document.getElementById('yes-button');
const noButton = document.getElementById('no-button');
const closeEmergencyBtn = document.getElementById('close-emergency');
const countdownElement = document.getElementById('countdown');
const hospitalInfo = document.getElementById('hospital-info');
const fsrInfo = document.getElementById('fsr-info');

let timeLeft = 60;
let timerInterval;
let currentFsrData = null;

questionPopup.style.display = 'none';

socket.on('connect', () => {
    console.log('✅ Connected to server');
    socket.emit('register-driver');
    connectionStatus.textContent = 'Connected';
    connectionStatus.style.color = '#4caf50';
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected');
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.style.color = '#d32f2f';
});

socket.on('registration-confirmed', (data) => {
    console.log('✅ Registered as driver');
});

socket.on('fsr-alert', (data) => {
    console.log('\n🚨 FSR ALERT RECEIVED!');
    console.log('  FSR Value:', data.fsrValue);
    console.log('  Device:', data.deviceId);
    console.log('  Time:', data.timestamp);
    
    currentFsrData = data;
    esp32Status.textContent = 'Alert Received!';
    esp32Status.style.color = '#d32f2f';
    
    // Play alarm sound immediately
    playAlarmSound();
    
    showEmergencyPopup(data);
});

socket.on('help-status', (data) => {
    console.log('📍 Help Status:', data.status, '-', data.message);
    updateHelpTracker(data);
});

function playAlarmSound() {
    // Create alarm sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;
    
    oscillator.start();
    
    // Siren effect
    let increasing = true;
    const interval = setInterval(() => {
        if (increasing) {
            oscillator.frequency.value += 50;
            if (oscillator.frequency.value >= 1200) increasing = false;
        } else {
            oscillator.frequency.value -= 50;
            if (oscillator.frequency.value <= 800) increasing = true;
        }
    }, 100);
    
    setTimeout(() => {
        clearInterval(interval);
        oscillator.stop();
    }, 2000);
}

function showEmergencyPopup(data) {
    questionPopup.style.display = 'flex';
    fsrInfo.textContent = `FSR: ${data.fsrValue} | Device: ${data.deviceId}`;
    statusText.textContent = 'FSR sensor pressed! Waiting for response...';
    statusText.style.color = '#d32f2f';
    
    startCountdown();
}

function startCountdown() {
    timeLeft = 60;
    countdownElement.textContent = timeLeft;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        countdownElement.textContent = timeLeft;
        
        if (timeLeft <= 10) {
            countdownElement.style.color = '#d32f2f';
            countdownElement.style.fontSize = '2em';
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            console.log('⏰ TIMEOUT - Auto-confirming emergency');
            confirmEmergency('timeout');
        }
    }, 1000);
}

function confirmEmergency(response) {
    clearInterval(timerInterval);
    questionPopup.style.display = 'none';
    emergencyConfirmed.classList.add('show');
    
    console.log('🚨 Emergency confirmed:', response);
    
    const reason = response === 'yes' ? 'User confirmed emergency' : 'No response - timeout';
    
    // Play alarm again when confirmed
    playAlarmSound();
    
    socket.emit('emergency-response', {
        response: response,
        reason: reason,
        timestamp: new Date().toISOString(),
        fsrValue: currentFsrData?.fsrValue
    });
    
    statusText.textContent = 'Emergency confirmed! Notifying hospital...';
    statusText.style.color = '#d32f2f';
    hospitalInfo.textContent = 'Selecting nearest hospital...';
    
    // Show first aid guide
    showFirstAidGuide();
}

function showFirstAidGuide() {
    const firstAidDiv = document.getElementById('first-aid-guide');
    if (firstAidDiv) {
        firstAidDiv.style.display = 'block';
    }
}

function updateHelpTracker(data) {
    const trackerDiv = document.getElementById('help-tracker');
    if (!trackerDiv) return;
    
    trackerDiv.style.display = 'block';
    
    // Play alarm when help status updates
    playAlarmSound();
    
    if (data.status === 'dispatched') {
        trackerDiv.innerHTML = `
            <div class="tracker-step active">
                <span class="tracker-icon">✅</span>
                <span>Alert Received</span>
            </div>
            <div class="tracker-step active">
                <span class="tracker-icon">🚑</span>
                <span>${data.message}</span>
            </div>
            <div class="tracker-step">
                <span class="tracker-icon">🛣️</span>
                <span>On The Way</span>
            </div>
            <div class="tracker-step">
                <span class="tracker-icon">📍</span>
                <span>Arriving Soon</span>
            </div>
        `;
    } else if (data.status === 'enroute') {
        trackerDiv.innerHTML = `
            <div class="tracker-step active">
                <span class="tracker-icon">✅</span>
                <span>Alert Received</span>
            </div>
            <div class="tracker-step active">
                <span class="tracker-icon">🚑</span>
                <span>Ambulance Dispatched</span>
            </div>
            <div class="tracker-step active">
                <span class="tracker-icon">🛣️</span>
                <span>${data.message}</span>
            </div>
            <div class="tracker-step">
                <span class="tracker-icon">📍</span>
                <span>Arriving Soon</span>
            </div>
        `;
    }
}

function cancelEmergency() {
    clearInterval(timerInterval);
    questionPopup.style.display = 'none';
    
    console.log('✅ Emergency cancelled');
    
    socket.emit('emergency-response', {
        response: 'no',
        reason: 'User cancelled',
        timestamp: new Date().toISOString()
    });
    
    statusText.textContent = 'Emergency cancelled - System ready';
    statusText.style.color = '#4caf50';
    esp32Status.textContent = 'Monitoring';
    esp32Status.style.color = '#4caf50';
}

yesButton.addEventListener('click', () => {
    console.log('👤 User clicked YES');
    confirmEmergency('yes');
});

noButton.addEventListener('click', () => {
    console.log('👤 User clicked NO');
    cancelEmergency();
});

closeEmergencyBtn.addEventListener('click', () => {
    emergencyConfirmed.classList.remove('show');
    statusText.textContent = 'System ready - Waiting for FSR sensor';
    statusText.style.color = '#333';
    esp32Status.textContent = 'Monitoring';
    esp32Status.style.color = '#4caf50';
});

document.addEventListener('keydown', (event) => {
    if (questionPopup.style.display === 'flex') {
        if (event.key === 'y' || event.key === 'Y') {
            confirmEmergency('yes');
        } else if (event.key === 'n' || event.key === 'N') {
            cancelEmergency();
        }
    }
    
    // Press Escape to close emergency screen
    if (event.key === 'Escape' && emergencyConfirmed.classList.contains('show')) {
        emergencyConfirmed.classList.remove('show');
        statusText.textContent = 'System ready - Waiting for FSR sensor';
        statusText.style.color = '#333';
        esp32Status.textContent = 'Monitoring';
        esp32Status.style.color = '#4caf50';
        console.log('ℹ️ Emergency screen closed (Escape key)');
    }
});

console.log('✅ Car Driver ready - Waiting for ESP32 FSR alerts');
