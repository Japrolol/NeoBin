/**
 * NeoBin Control Navbar Component
 *
 * Provides the main interface controls for the NeoBin smart waste bin:
 * - App title and connection status
 * - Angle adjustment slider (0-180 degrees)
 * - Power toggle switch
 * - Connection button
 */
import React, {useRef, useEffect, useState} from 'react';
import {View, StyleSheet, Text, Switch, TouchableOpacity, DeviceEventEmitter, Animated} from 'react-native';
import Slider from '@react-native-community/slider';
import {debounce} from 'lodash';
import BluetoothManager from './BluetoothManager';

interface NavbarProps {
    toggleSwitch: () => void;
    isEnabled: boolean;
    sliderValue: number;
    setSliderValue: (value: number) => void;
    connected: boolean;
    setShowConnectedModal: (value: boolean) => void;
    maxAngle: number;
}

const Navbar = ({
                    setShowConnectedModal,
                    connected,
                    toggleSwitch,
                    isEnabled,
                    sliderValue,
                    setSliderValue,
                    maxAngle,
                }: NavbarProps) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const connectedRef = useRef(connected);
    const enabledRef = useRef(isEnabled);
    const [displayValue, setDisplayValue] = useState(sliderValue);

    useEffect(() => {
        if (connected) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.5,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [connected, pulseAnim]);

    useEffect(() => {
        connectedRef.current = connected;
        enabledRef.current = isEnabled;
    }, [connected, isEnabled]);

    useEffect(() => {
        setDisplayValue(sliderValue);
    }, [sliderValue]);

    useEffect(() => {
        if (connected) {
            const angleSubscription = DeviceEventEmitter.addListener('angleUpdate', (angle: number) => {
                setSliderValue(angle);
            });

            return () => {
                angleSubscription.remove();
            };
        }
    }, [connected, setSliderValue]);


    const debouncedSendAngle = useRef(
        debounce((angle: number) => {
            if (connectedRef.current && enabledRef.current) {
                const command = `ANGLE:${Math.round(angle)}`;
                console.log(`Sending angle command: ${command}`);
                BluetoothManager.sendCommand(command)
                    .catch(error => {
                        console.error('Failed to set angle:', error);
                    });
            }
        }, 250)
    ).current;

    const handleSliderChange = (value: number) => {
        setDisplayValue(value);
        setSliderValue(value);
        debouncedSendAngle(value);
    };

    const handleToggle = () => {
        toggleSwitch();

        if (connected) {
            setTimeout(() => {
                BluetoothManager.sendCommand('STATUS')
                    .catch(error => {
                        console.error('Failed to toggle status:', error);
                    });
            }, 100);
        }
    };

    return (
        <View style={styles.navbar}>
            <View style={styles.headerContainer}>
                <View style={styles.titleContainer}>
                    <Text style={styles.navtext}>NEOBIN</Text>
                    <View style={styles.statusContainer}>
                        <Animated.View
                            style={[
                                styles.statusIndicator,
                                connected ? styles.statusConnected : styles.statusDisconnected,
                                { transform: [{ scale: connected ? pulseAnim : 1 }] }
                            ]}
                        />
                        <Text style={styles.statusText}>{connected ? 'ONLINE' : 'OFFLINE'}</Text>
                    </View>
                </View>

                <View style={styles.buttonsContainer}>
                    <TouchableOpacity
                        style={styles.connectButton}
                        onPress={() => setShowConnectedModal(true)}>
                        <Text style={styles.buttonText}>
                            {connected ? 'DEVICE' : 'CONNECT'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.controlPanel}>
                <View style={styles.powerContainer}>
                    <Text style={[styles.powerText, isEnabled ? styles.powerOn : styles.powerOff]}>
                        {isEnabled ? 'ENABLED' : 'DISABLED'}
                    </Text>
                    <Switch
                        disabled={!connected}
                        trackColor={{false: '#353535', true: 'rgba(30, 144, 255, 0.5)'}}
                        thumbColor={isEnabled ? '#1E90FF' : '#f4f3f4'}
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={handleToggle}
                        value={isEnabled}
                    />
                </View>

                <View style={styles.sliderContainer}>
                    <View style={styles.sliderHeader}>
                        <Text style={styles.sliderLabel}>Angle Control</Text>
                        <View style={styles.valueDisplay}>
                            <Text style={styles.valueText}>{Math.round(displayValue)}°</Text>
                        </View>
                    </View>

                    <View style={styles.sliderRow}>
                        <Text style={styles.minMaxLabel}>0°</Text>
                        <Slider
                            disabled={(!connected || !isEnabled)}
                            style={styles.slider}
                            minimumValue={0}
                            maximumValue={maxAngle}
                            step={1}
                            value={sliderValue}
                            onValueChange={handleSliderChange}
                            minimumTrackTintColor="#1E90FF"
                            maximumTrackTintColor="#454545"
                            thumbTintColor="#1E90FF"
                        />
                        <Text style={styles.minMaxLabel}>{maxAngle}°</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    navbar: {
        width: '100%',
        backgroundColor: '#2A2A2A',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(30, 144, 255, 0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 5,
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
    },
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    titleContainer: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    buttonsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    navtext: {
        color: '#1E90FF',
        fontSize: 30,
        fontWeight: 'bold',
        textShadowColor: '#409dff',
        textShadowRadius: 8,
        textShadowOffset: { width: 0, height: 0 },
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    statusIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusConnected: {
        backgroundColor: '#4CAF50',
        shadowColor: '#4CAF50',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    statusDisconnected: {
        backgroundColor: '#FF5252',
        shadowColor: '#FF5252',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    statusText: {
        color: '#BBBBBB',
        fontSize: 12,
        fontWeight: 'bold',
    },
    connectButton: {
        paddingVertical: 10,
        paddingHorizontal: 15,
        backgroundColor: '#1E90FF',
        borderRadius: 24,
        shadowColor: '#1E90FF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    buttonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 12,
    },
    controlPanel: {
        backgroundColor: '#353535',
        borderRadius: 15,
        padding: 15,
        marginTop: 5,
    },
    powerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    powerText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    powerOn: {
        color: '#4CAF50',
    },
    powerOff: {
        color: '#FF5252',
    },
    sliderContainer: {
        width: '100%',
    },
    sliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sliderLabel: {
        color: '#1E90FF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    valueDisplay: {
        backgroundColor: 'rgba(30, 144, 255, 0.2)',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    valueText: {
        color: '#1E90FF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    sliderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    slider: {
        flex: 1,
        height: 40,
    },
    minMaxLabel: {
        color: '#BBBBBB',
        fontSize: 12,
        width: 30,
        textAlign: 'center',
    },
});

export default Navbar;