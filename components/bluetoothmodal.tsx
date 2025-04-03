/**
 * NeoBin Bluetooth Connection Modal
 *
 * Provides interface for discovering and connecting to NeoBin devices via Bluetooth.
 * Displays available devices, handles scanning operations, and manages connection states.
 * User can connect to a device or close the modal when finished.
 */
import React, {useEffect, useState} from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
    Animated,
    Dimensions,
} from 'react-native';
import BluetoothManager from './BluetoothManager.ts';
import {Device} from 'react-native-ble-plx';

interface Props {
    setShowConnectModal: (value: boolean) => void;
}

function trimText(str: string, len: number): string {
    return str.length > len ? str.substring(0, len) + '...' : str;
}

const BluetoothModal = ({setShowConnectModal}: Props) => {
    const [devices, setDevices] = useState<Device[]>([]);
    const [scanning, setScanning] = useState(false);
    const [connecting, setConnecting] = useState<string>('');
    const scanAnim = useState(new Animated.Value(0))[0];

    useEffect(() => {
        BluetoothManager.startScan();
        setScanning(true);

        Animated.loop(
            Animated.sequence([
                Animated.timing(scanAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true
                }),
                Animated.timing(scanAnim, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true
                })
            ])
        ).start();

        const onDeviceFound = BluetoothManager.onDeviceFound((device) => {
            setDevices(prev => {
                if (!prev.some(d => d.id === device.id)) {
                    return [...prev, device];
                }
                return prev;
            });
        });

        const onScanStopped = BluetoothManager.onScanStopped(() => {
            setScanning(false);
        });

        const timeoutId = setTimeout(() => {
            BluetoothManager.stopScan();
        }, 10000);

        return () => {
            clearTimeout(timeoutId);
            BluetoothManager.stopScan();
            onDeviceFound();
            onScanStopped();
        };
    }, []);

    const handleConnect = async (deviceId: string) => {
        setConnecting('');
        try {
            setConnecting(deviceId);
            await BluetoothManager.connectToDevice(deviceId);
        } catch (error) {
            console.error('Failed to connect:', error);
        } finally {
            setConnecting('');
        }
    };

    const handleRescan = () => {
        if (!scanning) {
            setDevices([]);
            BluetoothManager.startScan();
            setScanning(true);

            setTimeout(() => {
                BluetoothManager.stopScan();
            }, 10000);
        }
    };

    return(
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <View style={styles.headerSection}>
                    <Text style={styles.header}>BLUETOOTH DEVICES</Text>

                    <View style={styles.scanStatus}>
                        {scanning ? (
                            <Animated.View
                                style={[
                                    styles.scanIndicator,
                                    { opacity: scanAnim }
                                ]}
                            />
                        ) : null}
                        <Text style={styles.scanStatusText}>
                            {scanning ? 'Scanning for devices...' : 'Scan complete'}
                        </Text>
                    </View>
                </View>

                <View style={styles.deviceListContainer}>
                    {devices.length > 0 ? (
                        <ScrollView contentContainerStyle={styles.devicesContent}>
                            {devices.map(device => {
                                const isConnected = BluetoothManager.getConnectedDevice()?.id === device.id;
                                const isConnecting = connecting === device.id;

                                return (
                                    <View key={device.id} style={[
                                        styles.deviceCard,
                                        isConnected && styles.connectedDevice
                                    ]}>
                                        <View style={styles.deviceInfo}>
                                            <Text style={styles.deviceName}>
                                                {trimText(device.name || 'Unknown Device', 25)}
                                            </Text>
                                            <Text style={styles.deviceId}>
                                                ID: {trimText(device.id, 16)}
                                            </Text>
                                        </View>

                                        <TouchableOpacity
                                            style={[
                                                styles.connectButton,
                                                isConnected && styles.connectedButton,
                                                isConnecting && styles.connectingButton
                                            ]}
                                            onPress={() => handleConnect(device.id)}
                                            disabled={isConnected || isConnecting}
                                        >
                                            {isConnecting ? (
                                                <ActivityIndicator size="small" color="#FFFFFF" />
                                            ) : (
                                                <Text style={styles.connectText}>
                                                    {isConnected ? 'Connected' : 'Connect'}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>
                                {scanning ? 'Searching for devices...' : 'No devices found'}
                            </Text>
                            {!scanning && (
                                <TouchableOpacity
                                    style={styles.rescanButton}
                                    onPress={handleRescan}
                                >
                                    <Text style={styles.rescanText}>Scan Again</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                <View style={styles.footer}>
                    {!scanning && devices.length > 0 && (
                        <TouchableOpacity
                            style={styles.rescanButton}
                            onPress={handleRescan}
                        >
                            <Text style={styles.rescanText}>Rescan</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setShowConnectModal(false)}
                    >
                        <Text style={styles.closeText}>CLOSE</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        height: height * 0.75,
        width: width * 0.9,
        backgroundColor: '#222222',
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#1E90FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    headerSection: {
        backgroundColor: '#1E1E1E',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(30, 144, 255, 0.3)',
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E90FF',
        textAlign: 'center',
        textShadowColor: '#409dff',
        textShadowRadius: 8,
        textShadowOffset: { width: 0, height: 0 },
    },
    scanStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    scanIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#4CAF50',
        marginRight: 8,
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 5,
    },
    scanStatusText: {
        color: '#BBBBBB',
        fontSize: 14,
    },
    deviceListContainer: {
        flex: 1,
        backgroundColor: '#2A2A2A',
    },
    devicesContent: {
        paddingVertical: 10,
        paddingHorizontal: 15,
    },
    deviceCard: {
        backgroundColor: '#353535',
        borderRadius: 12,
        marginVertical: 6,
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    connectedDevice: {
        borderLeftWidth: 4,
        borderLeftColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
    },
    deviceInfo: {
        flex: 1,
    },
    deviceName: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    deviceId: {
        color: '#BBBBBB',
        fontSize: 12,
    },
    connectButton: {
        backgroundColor: '#1E90FF',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 15,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1E90FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    connectedButton: {
        backgroundColor: '#4CAF50',
    },
    connectingButton: {
        backgroundColor: '#FF9800',
    },
    connectText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    emptyStateText: {
        color: '#BBBBBB',
        fontSize: 16,
        marginBottom: 20,
        textAlign: 'center',
    },
    footer: {
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: 'rgba(30, 144, 255, 0.3)',
        backgroundColor: '#1E1E1E',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rescanButton: {
        backgroundColor: '#353535',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#1E90FF',
    },
    rescanText: {
        color: '#1E90FF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    closeButton: {
        backgroundColor: '#1E90FF',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1E90FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    closeText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
});

export default BluetoothModal;