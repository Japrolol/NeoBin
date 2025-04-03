/**
 * NeoBin Mobile Control Application
 *
 * Main application component that manages the NeoBin smart waste bin control interface.
 * Coordinates Bluetooth connectivity, bin status, and user interactions between
 * the Navbar (controls), Dashboard (status display), and connection modal.
 *
 * Features:
 * - Real-time bin status monitoring
 * - Angle adjustment via slider
 * - Power toggle control
 * - Bluetooth connection management
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, View, DeviceEventEmitter} from 'react-native';
import Navbar from './components/Navbar.tsx';
import Dashboard from './components/dashboard.tsx';
import Bluetoothmodal from './components/bluetoothmodal.tsx';
import BluetoothManager from './components/BluetoothManager.ts';
import SettingsModal from "./components/SettingsModal.tsx";
import bluetoothManager from "./components/BluetoothManager.ts";

function App(): React.JSX.Element {
    const [isEnabled, setIsEnabled] = useState(false);
    const [open, setOpen] = useState(false);
    const [sliderValue, setSliderValue] = useState(0);
    const [connected, setConnected] = useState(false);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const toggleSwitch = () => setIsEnabled(prevState => !prevState);

    const [maxAngle, setMaxAngle] = useState<number>(180);
    const [detectDistance, setDetectDistance] = useState<number>(30);

    useEffect(() => {
        const initializeConnection = async () => {
            try {
                const connectedDev = await BluetoothManager.findAndConnectToNeoBin();
                setConnected(connectedDev);
            } catch (error) {
                console.error('Error during connection initialization:', error);
            }
        };

        initializeConnection();

        const connectedListener = BluetoothManager.onConnected(async () => {
            setConnected(true);

            BluetoothManager.getDiagnostics()
                .catch(err => console.error('Error getting diagnostics:', err));

            try {
                const settings = await BluetoothManager.getSettings();

                console.log('Retrieved settings:', settings);
                setMaxAngle(settings.maxAngle);
                setDetectDistance(settings.detectDistance);

                console.log('Assigned: ', maxAngle, detectDistance);
            } catch (error) {
                console.error('Error retrieving settings:', error);

                setMaxAngle(180);
                setDetectDistance(30);
            }
        });

        const disconnectedListener = BluetoothManager.onDisconnected(() => {
            setConnected(false);
            setIsEnabled(false);
        });

        const statusSubscription = DeviceEventEmitter.addListener('statusUpdate', (status: boolean) => {
            setIsEnabled(status);
        });

        const maxAngleSubscription = DeviceEventEmitter.addListener('maxAngleUpdate', (maximumAngle: number) =>{
            setMaxAngle(maximumAngle);
        });
        const detectDistanceSubscription = DeviceEventEmitter.addListener('detectDistanceUpdate', (detectionDistance: number)=>{
            setDetectDistance(detectionDistance);
        });

        return () => {
            connectedListener();
            disconnectedListener();
            statusSubscription.remove();
            maxAngleSubscription.remove();
            detectDistanceSubscription.remove();
        };
    }, []);

    return (
        <View style={styles.page}>
            <Navbar
                setShowConnectedModal={setShowConnectModal}
                isEnabled={isEnabled}
                toggleSwitch={toggleSwitch}
                sliderValue={sliderValue}
                setSliderValue={setSliderValue}
                connected={connected}
                maxAngle={maxAngle}
            />

            <Dashboard
                open={open}
                setOpen={setOpen}
                isEnabled={isEnabled}
                connected={connected}
                sliderValue={sliderValue}
            />

            {showConnectModal && !bluetoothManager.isConnected() && (
                <Bluetoothmodal setShowConnectModal={setShowConnectModal} />
            )}
            {showConnectModal && bluetoothManager.isConnected() && (
                <SettingsModal sliderValue={maxAngle} setSliderValue={setMaxAngle} distanceSliderValue={detectDistance} setDistanceSliderValue={setDetectDistance}  setShow={setShowConnectModal}/>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        backgroundColor: '#333',
    },
});

export default App;