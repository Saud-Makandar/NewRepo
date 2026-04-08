const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Store active connections
const connections = {
    driver: null,
    hospitals: new Map()
};

console.log('🚀 ESP32 Emergency System Server Starting...\n');

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
    
    socket.on('register-driver', () => {
        connections.driver = socket.id;
        socket.join('car-driver');
        console.log('🚗 Car driver registered:', socket.id);
        socket.emit('registration-confirmed', { role: 'driver', status: 'connected' });
    });
    
    socket.on('register-hospital', (hospitalId) => {
        connections.hospitals.set(hospitalId, socket.id);
        socket.join(hospitalId);
        console.log(`🏥 ${hospitalId} registered:`, socket.id);
        socket.emit('registration-confirmed', { hospitalId, status: 'connected' });
    });
    
    socket.on('emergency-response', (data) => {
        console.log('\n📋 Driver Response:', data.response);
        
        if (data.response === 'yes' || data.response === 'timeout') {
            const hospitals = ['hospital1', 'hospital2', 'hospital3'];
            const selectedHospital = hospitals[Math.floor(Math.random() * hospitals.length)];
            
            console.log('🎲 Selected Hospital:', selectedHospital);
            
            // Generate location near the selected hospital
            const location = generateLocationNearHospital(selectedHospital);
            
            const alertData = {
                reason: data.reason,
                timestamp: data.timestamp,
                selectedHospital: selectedHospital,
                fsrValue: data.fsrValue,
                location: location,
                alertId: 'ALERT-' + Date.now()
            };
            
            console.log('📦 Sending alert data:', JSON.stringify(alertData, null, 2));
            
            // Send to ONLY the selected hospital
            io.to(selectedHospital).emit('emergency-notification', alertData);
            
            // Send help status updates to driver ONLY (not to hospitals)
            if (connections.driver) {
                setTimeout(() => {
                    io.to('car-driver').emit('help-status', { 
                        status: 'dispatched', 
                        message: 'Ambulance dispatched from ' + location.nearestHospital,
                        hospital: selectedHospital 
                    });
                }, 2000);
                
                setTimeout(() => {
                    io.to('car-driver').emit('help-status', { 
                        status: 'enroute', 
                        message: 'Help is on the way - ETA 8 minutes' 
                    });
                }, 5000);
            }
            
            console.log(`✅ Alert sent to ${selectedHospital}`);
            console.log(`📍 Location: ${location.address}`);
            console.log(`🏥 Nearest: ${location.nearestHospital}\n`);
        } else {
            console.log('✅ Emergency cancelled by driver\n');
            io.emit('emergency-cancelled');
        }
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected:', socket.id);
        
        if (connections.driver === socket.id) {
            connections.driver = null;
            console.log('🚗 Car driver disconnected');
        }
        
        for (let [hospitalId, socketId] of connections.hospitals) {
            if (socketId === socket.id) {
                connections.hospitals.delete(hospitalId);
                console.log(`🏥 ${hospitalId} disconnected`);
            }
        }
    });
});

// ESP32 FSR trigger endpoint
app.post('/api/fsr-trigger', (req, res) => {
    const { fsrValue, deviceId, timestamp } = req.body;
    
    console.log('\n🚨 FSR SENSOR TRIGGERED!');
    console.log('  Device:', deviceId);
    console.log('  FSR Value:', fsrValue);
    console.log('  Timestamp:', timestamp);
    
    if (!connections.driver) {
        console.log('⚠️  No car driver connected');
        return res.json({ success: false, message: 'No driver connected' });
    }
    
    // Don't generate location here - will be generated when hospital is selected
    
    io.to('car-driver').emit('fsr-alert', {
        fsrValue: fsrValue,
        deviceId: deviceId,
        timestamp: new Date().toISOString()
    });
    
    console.log('✅ Alert sent to car driver\n');
    
    res.json({ 
        success: true, 
        message: 'Alert sent to driver',
        driverConnected: true
    });
});

// Generate fake address for demo
function generateFakeAddress() {
    const streets = ['MG Road', 'FC Road', 'JM Road', 'Baner Road', 'Karve Road', 'Paud Road'];
    const areas = ['Shivajinagar', 'Kothrud', 'Baner', 'Aundh', 'Deccan', 'Camp'];
    const street = streets[Math.floor(Math.random() * streets.length)];
    const area = areas[Math.floor(Math.random() * areas.length)];
    const number = Math.floor(Math.random() * 500) + 1;
    return `${number}, ${street}, ${area}, Pune`;
}

// Hospital locations with cities
const hospitalLocations = {
    hospital1: {
        city: 'Mumbai',
        name: 'Lilavati Hospital',
        baseCoords: { lat: 19.0760, lng: 72.8777 }
    },
    hospital2: {
        city: 'Delhi',
        name: 'AIIMS Hospital',
        baseCoords: { lat: 28.7041, lng: 77.1025 }
    },
    hospital3: {
        city: 'Bangalore',
        name: 'Manipal Hospital',
        baseCoords: { lat: 12.9716, lng: 77.5946 }
    }
};

// Generate location near a specific hospital
function generateLocationNearHospital(hospitalId) {
    const hospital = hospitalLocations[hospitalId];
    
    if (!hospital) {
        console.error('❌ Hospital not found:', hospitalId);
        return {
            latitude: '0',
            longitude: '0',
            address: 'Location unavailable',
            city: 'Unknown',
            nearestHospital: 'Unknown'
        };
    }
    
    // Generate random coordinates within 5km radius
    const latOffset = (Math.random() - 0.5) * 0.05; // ~5km
    const lngOffset = (Math.random() - 0.5) * 0.05;
    
    const latitude = (hospital.baseCoords.lat + latOffset).toFixed(6);
    const longitude = (hospital.baseCoords.lng + lngOffset).toFixed(6);
    
    // Generate address in that city
    const streets = {
        Mumbai: ['Marine Drive', 'Linking Road', 'SV Road', 'Juhu Road', 'Worli Sea Face'],
        Delhi: ['Connaught Place', 'Rajpath', 'Chandni Chowk', 'Nehru Place', 'Karol Bagh'],
        Bangalore: ['MG Road', 'Brigade Road', 'Indiranagar', 'Koramangala', 'Whitefield Road']
    };
    
    const areas = {
        Mumbai: ['Bandra', 'Andheri', 'Juhu', 'Worli', 'Powai'],
        Delhi: ['Connaught Place', 'Saket', 'Dwarka', 'Rohini', 'Vasant Kunj'],
        Bangalore: ['Koramangala', 'Indiranagar', 'Whitefield', 'HSR Layout', 'Jayanagar']
    };
    
    const cityStreets = streets[hospital.city];
    const cityAreas = areas[hospital.city];
    
    const street = cityStreets[Math.floor(Math.random() * cityStreets.length)];
    const area = cityAreas[Math.floor(Math.random() * cityAreas.length)];
    const number = Math.floor(Math.random() * 500) + 1;
    
    const locationData = {
        latitude: latitude,
        longitude: longitude,
        address: `${number}, ${street}, ${area}, ${hospital.city}`,
        city: hospital.city,
        nearestHospital: hospital.name
    };
    
    console.log('📍 Generated location:', locationData);
    
    return locationData;
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        connections: {
            driver: connections.driver !== null,
            hospitals: connections.hospitals.size
        }
    });
});

// Get local IP
function getLocalIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    
    console.log('='.repeat(60));
    console.log('🚨 ESP32 EMERGENCY SYSTEM SERVER');
    console.log('='.repeat(60));
    console.log(`✅ Server: http://localhost:${PORT}`);
    console.log(`🌐 Network: http://${localIP}:${PORT}`);
    console.log('\n📱 INTERFACES:');
    console.log(`  🚗 Driver:    http://${localIP}:${PORT}/carDriver.html`);
    console.log(`  🏥 Hospital1: http://${localIP}:${PORT}/hospital1.html`);
    console.log(`  🏥 Hospital2: http://${localIP}:${PORT}/hospital2.html`);
    console.log(`  🏥 Hospital3: http://${localIP}:${PORT}/hospital3.html`);
    console.log('\n🔧 ESP32 Configuration:');
    console.log(`  Server URL: http://${localIP}:${PORT}/api/fsr-trigger`);
    console.log('='.repeat(60) + '\n');
});
