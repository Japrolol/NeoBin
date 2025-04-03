import {StyleSheet, TouchableOpacity} from 'react-native';
import {View, Text} from 'react-native';
import React, {useEffect, useState} from 'react';
import BluetoothManager from './BluetoothManager.ts';
import {DeviceEventEmitter} from 'react-native';

interface DashboardProps {
    connected: boolean;
    sliderValue: number;
    isEnabled: boolean;
    open: boolean;
    setOpen: (value: boolean) => void;
}

const Dashboard = ({ setOpen, open, sliderValue, connected, isEnabled}: DashboardProps) => {
    const [binAngle, setBinAngle] = useState(sliderValue);
    const [binOpen, setBinOpen] = useState(open);
    const [binStatus, setBinStatus] = useState(isEnabled);

    useEffect(() => {
        setBinStatus(isEnabled);
    }, [isEnabled]);

    useEffect(() => {
        setBinAngle(sliderValue);
    }, [sliderValue]);

    useEffect(() => {
        const cleanupFunctions: Array<() => void> = [];

        if (connected) {
            BluetoothManager.getDiagnostics()
                .catch(error => console.error('Failed to get diagnostics:', error));

            const angleSubscription = DeviceEventEmitter.addListener('angleUpdate', (angle: number) => {
                console.log('Angle update received:', angle);
                setBinAngle(angle);
            });
            cleanupFunctions.push(() => angleSubscription.remove());

            const openedSubscription = DeviceEventEmitter.addListener('openedUpdate', (opened: boolean) => {
                console.log('Open state update received:', opened);
                setBinOpen(opened);
                setOpen(opened);
            });
            cleanupFunctions.push(() => openedSubscription.remove());

            const statusSubscription = DeviceEventEmitter.addListener('statusUpdate', (status: boolean) => {
                console.log('Status update received:', status);
                setBinStatus(status);
            });
            cleanupFunctions.push(() => statusSubscription.remove());

            const dataSubscription = DeviceEventEmitter.addListener('dataReceived', (data: any) => {
                console.log('Raw data received:', data);
            });
            cleanupFunctions.push(() => dataSubscription.remove());

            BluetoothManager.sendCommand('STATUS')
                .catch(error => console.error('Failed to request status:', error));
        }

        return () => {
            cleanupFunctions.forEach(cleanup => cleanup());
        };
    }, [connected, setOpen]);

    const handleOpenBin = async () => {
        try {
            console.log('Sending OPEN command');
            await BluetoothManager.sendCommand('OPEN');
        } catch (error) {
            console.error('Failed to open bin:', error);
        }
    };

    const handleCloseBin = async () => {
        try {
            console.log('Sending CLOSE command');
            await BluetoothManager.sendCommand('CLOSE');
        } catch (error) {
            console.error('Failed to close bin:', error);
        }
    };

    const operationsDisabled = !connected || !binStatus;

    return (
        <View style={styles.container}>
            <View style={styles.statusSection}>
                <View style={[styles.statusCard, !connected && styles.disabled]}>
                    <View style={styles.statusCardHeader}>
                        <Text style={styles.statusCardTitle}>Status</Text>
                    </View>
                    <View style={styles.statusCardContent}>
                        <Text style={[
                            styles.statusCardValue,
                            (binStatus && connected) ? styles.active : styles.inactive,
                        ]}>
                            {(binStatus && connected) ? 'ACTIVE' : 'INACTIVE'}
                        </Text>
                    </View>
                </View>

                <View style={[styles.statusCard, !connected && styles.disabled]}>
                    <View style={styles.statusCardHeader}>
                        <Text style={styles.statusCardTitle}>Angle</Text>
                    </View>
                    <View style={styles.statusCardContent}>
                        <Text style={styles.statusCardValue}>{binAngle}°</Text>
                    </View>
                </View>

                <View style={[styles.statusCard, styles.stateCard, operationsDisabled && styles.disabled]}>
                    <View style={styles.statusCardHeader}>
                        <Text style={styles.statusCardTitle}>Bin State</Text>
                    </View>
                    <View style={[styles.statusCardContent, binOpen ? styles.openBackground : styles.closedBackground]}>
                        <Text style={[styles.statusCardValue, styles.stateText]}>
                            {binOpen ? 'OPEN' : 'CLOSED'}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.actionSection}>
                <TouchableOpacity
                    disabled={binOpen || operationsDisabled}
                    style={[
                        styles.actionButton,
                        styles.openButton,
                        (binOpen || operationsDisabled) && styles.disabledButton
                    ]}
                    onPress={handleOpenBin}>
                    <Text style={styles.actionButtonText}>OPEN BIN</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    disabled={!binOpen || operationsDisabled}
                    style={[
                        styles.actionButton,
                        styles.closeButton,
                        (!binOpen || operationsDisabled) && styles.disabledButton
                    ]}
                    onPress={handleCloseBin}>
                    <Text style={styles.actionButtonText}>CLOSE BIN</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#2A2A2A',
    },
    headerSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(30, 144, 255, 0.3)',
    },
    connectionStatus: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusIndicator: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    connected: {
        backgroundColor: '#4CAF50',
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    disconnected: {
        backgroundColor: '#F44336',
        shadowColor: '#F44336',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    connectionText: {
        color: '#FFFFFF',
        fontSize: 16,
    },
    settingsButton: {
        backgroundColor: '#1E90FF',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
    },
    settingsButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    statusSection: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    statusCard: {
        width: '48%',
        backgroundColor: '#353535',
        borderRadius: 15,
        overflow: 'hidden',
        marginBottom: 16,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    stateCard: {
        width: '100%',
    },
    statusCardHeader: {
        backgroundColor: 'rgba(30, 144, 255, 0.1)',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(30, 144, 255, 0.3)',
    },
    statusCardTitle: {
        color: '#1E90FF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    statusCardContent: {
        padding: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusCardValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1E90FF',
    },
    stateText: {
        fontSize: 36,
    },
    openBackground: {
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
    },
    closedBackground: {
        backgroundColor: 'rgba(244, 67, 54, 0.1)',
    },
    active: {
        color: '#4CAF50',
    },
    inactive: {
        color: '#F44336',
    },
    actionSection: {
        marginTop: 10,
    },
    actionButton: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: 70,
        borderRadius: 15,
        marginBottom: 16,
    },
    openButton: {
        backgroundColor: '#1E90FF',
        shadowColor: '#1E90FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    closeButton: {
        backgroundColor: '#353535',
        borderWidth: 2,
        borderColor: '#1E90FF',
    },
    actionButtonText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    disabled: {
        opacity: 0.5,
    },
    disabledButton: {
        opacity: 0.5,
        backgroundColor: '#454545',
        borderColor: '#454545',
        shadowOpacity: 0,
    },
});

export default Dashboard;