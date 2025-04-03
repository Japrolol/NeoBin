/**
 * NeoBin Settings Modal
 *
 * Provides configuration interface for the NeoBin smart waste bin:
 * - Device information display
 * - Maximum angle adjustment (1-180 degrees)
 * - Detection distance configuration (1-300 cm)
 * - Disconnect and close options
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import _ from 'lodash';
import BluetoothManager from './BluetoothManager.ts';

interface Props {
    setShow: (value: boolean) => void;
    sliderValue: number;
    setSliderValue: (value: number) => void;
    distanceSliderValue: number;
    setDistanceSliderValue: (value: number) => void;
}

const SettingsModal = ({ setShow, distanceSliderValue, setDistanceSliderValue, sliderValue, setSliderValue }: Props) => {
    const [localSliderValue, setLocalSliderValue] = useState(sliderValue);
    const [localDistanceValue, setLocalDistanceValue] = useState(distanceSliderValue);

    useEffect(() => {
        setLocalSliderValue(sliderValue);
        setLocalDistanceValue(distanceSliderValue);
    }, [sliderValue, distanceSliderValue]);

    const sliderValueRef = useRef(sliderValue);
    const distanceSliderValueRef = useRef(distanceSliderValue);

    useEffect(() => {
        sliderValueRef.current = sliderValue;
        distanceSliderValueRef.current = distanceSliderValue;
    }, [sliderValue, distanceSliderValue]);

    const debouncedUpdateMaxAngle = useRef(
        _.debounce((angle: number) => {
            if (BluetoothManager.isConnected()) {
                console.log("sending max angle:", angle);
                BluetoothManager.updateSetting('maxAngle', angle)
                    .catch(error => {
                        console.error('Failed to update max angle:', error);
                    });
            }
        }, 250)
    ).current;

    const debouncedUpdateDetectDistance = useRef(
        _.debounce((distance: number) => {
            if (BluetoothManager.isConnected()) {
                console.log("sending detect distance:", distance);
                BluetoothManager.updateSetting('detectDistance', distance)
                    .catch(error => {
                        console.error('Failed to update detect distance:', error);
                    });
            }
        }, 250)
    ).current;

    const handleMaxAngleChange = (value: number) => {
        setLocalSliderValue(value);
        setSliderValue(value);
        debouncedUpdateMaxAngle(value);
    };

    const handleDetectDistanceChange = (value: number) => {
        setLocalDistanceValue(value);
        setDistanceSliderValue(value);
        debouncedUpdateDetectDistance(value);
    };

    const handleDisconnect = () => {
        BluetoothManager.disconnect();
    };

    return (
        <View style={styles.settingsModal}>
            <Text style={styles.header}>SETTINGS</Text>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Device Information</Text>
                <View style={styles.deviceInfo}>
                    <Text style={styles.titleText}>
                        Connected Device: {_.get(BluetoothManager.getConnectedDevice(), 'name', 'None')}
                    </Text>
                    <Text style={styles.subtitleText}>
                        UUID: {_.get(BluetoothManager.getConnectedDevice(), 'id', 'Not connected')}
                    </Text>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>MAX ANGLE</Text>
                <View style={styles.sliderContainer}>
                    <Text style={styles.sliderValue}>{localSliderValue}</Text>
                    <Slider
                        style={styles.slider}
                        minimumValue={1}
                        maximumValue={180}
                        step={1}
                        value={localSliderValue}
                        onValueChange={handleMaxAngleChange}
                        minimumTrackTintColor="#1E90FF"
                        maximumTrackTintColor="#3D3D3D"
                        thumbTintColor="#1E90FF"
                    />
                    <View style={styles.sliderLabels}>
                        <Text style={styles.sliderLabel}>1</Text>
                        <Text style={styles.sliderLabel}>180</Text>
                    </View>
                </View>
            </View>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>OPENING DISTANCE</Text>
                <View style={styles.sliderContainer}>
                    <Text style={styles.sliderValue}>{localDistanceValue}cm</Text>
                    <Slider
                        style={styles.slider}
                        minimumValue={1}
                        maximumValue={300}
                        step={1}
                        value={localDistanceValue}
                        onValueChange={handleDetectDistanceChange}
                        minimumTrackTintColor="#1E90FF"
                        maximumTrackTintColor="#3D3D3D"
                        thumbTintColor="#1E90FF"
                    />
                    <View style={styles.sliderLabels}>
                        <Text style={styles.sliderLabel}>1</Text>
                        <Text style={styles.sliderLabel}>300</Text>
                    </View>
                </View>
            </View>

            <TouchableOpacity
                style={styles.disconnectButton}
                onPress={handleDisconnect}
            >
                <Text style={styles.disconnectText}>DISCONNECT</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShow(false)}
            >
                <Text style={styles.closeText}>CLOSE</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    settingsModal: {
        height: '85%',
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        backgroundColor: 'rgba(0,0,0,0.8)',
        zIndex: 100,
        borderRadius: 20,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        fontSize: 30,
        textAlign: 'center',
        fontWeight: 'bold',
        color: '#1E90FF',
        marginVertical: 18,
        textShadowColor: '#409dff',
        textShadowRadius: 8,
        textShadowOffset: { width: 0, height: 0 },
    },
    section: {
        marginBottom: 25,
        width: '100%',
    },
    sectionTitle: {
        fontSize: 18,
        color: '#1E90FF',
        fontWeight: 'bold',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#0f6fcc',
        paddingBottom: 5,
    },
    deviceInfo: {
        backgroundColor: '#353535',
        borderRadius: 10,
        padding: 15,
    },
    titleText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E90FF',
        marginBottom: 8,
    },
    subtitleText: {
        fontSize: 14,
        color: '#cccccc',
    },
    sliderContainer: {
        backgroundColor: '#353535',
        borderRadius: 10,
        padding: 15,
    },
    slider: {
        width: '100%',
        height: 40,
    },
    sliderValue: {
        textAlign: 'center',
        color: '#1E90FF',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 5,
    },
    sliderLabel: {
        color: '#cccccc',
        fontSize: 12,
    },
    disconnectButton: {
        backgroundColor: '#cc3333',
        borderRadius: 10,
        padding: 12,
        boxSizing: 'border-box',
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        position: 'absolute',
        left: 10,
        bottom: 10,
        width: '60%',
    },
    disconnectText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    closeButton: {
        width: 100,
        height: 40,
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: '#1E90FF',
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        right: 10,
        bottom: 10,
    },
    closeText: {
        fontSize: 16,
        color: '#fff',
    },
});

export default SettingsModal;