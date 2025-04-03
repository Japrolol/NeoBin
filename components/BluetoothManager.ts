import {BleManager, Device, State, Subscription} from 'react-native-ble-plx';
import {DeviceEventEmitter, EmitterSubscription, PermissionsAndroid, Platform} from 'react-native';

global.Buffer = require('buffer').Buffer;

/**
 * Manages BLE communication with NeoBin smart waste devices
 */
class BluetoothManager {
    private manager: BleManager;
    private connectedDevice: Device | null = null;
    private isScanning: boolean = false;
    private scanListeners: Array<() => void> = [];
    private deviceListeners: Array<(device: Device) => void> = [];
    private subscriptions: Subscription[] = [];
    private eventSubscriptions: EmitterSubscription[] = [];
    private authenticated: boolean = false;

    private NEO_UUID: string = '0000180d-0000-1000-8000-00805f9b34fb';
    private NEO_AUTH_UUID: string = '00002a37-0000-1000-8000-00805f9b34fb';
    private NEO_WRITE_UUID: string = '00002a38-0000-1000-8000-00805f9b34fb';
    private NEO_INFORM_UUID: string = '00002a39-0000-1000-8000-00805f9b34fb';

    constructor() {
        this.manager = new BleManager();

        this.manager.onStateChange((state) => {
            if (state === State.PoweredOn) {
                DeviceEventEmitter.emit('bluetoothReady');
            } else {
                DeviceEventEmitter.emit('bluetoothStateChange', state);
            }
        }, true);
    }

    /**
     * Checks if connected to a device and authenticated
     */
    isConnected = (): boolean => {
        return this.connectedDevice !== null && this.authenticated;
    };

    /**
     * Requests Bluetooth permissions from user on Android
     */
    requestBluetoothPermission = async (): Promise<boolean> => {
        if (Platform.OS === 'ios') {
            return true;
        }

        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    {
                        title: 'Bluetooth Permission',
                        message: 'NeoBin needs access to your location for Bluetooth scanning',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    },
                );
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            } catch (err) {
                console.error('Permission request failed:', err);
                return false;
            }
        }
        return false;
    };

    /**
     * Starts scanning for NeoBin devices
     */
    startScan = (): void => {
        if (this.isScanning) return;

        this.isScanning = true;
        this.manager.startDeviceScan(null, null, (error, device) => {
            if (error) {
                console.error('Scan error:', error);
                DeviceEventEmitter.emit('scanError', error);
                return;
            }

            if (device && device.name === 'NeoBin') {
                DeviceEventEmitter.emit('deviceFound', device);
                this.deviceListeners.forEach(listener => listener(device));
            }
        });
    };

    /**
     * Stops scanning for devices
     */
    stopScan = (): void => {
        this.manager.stopDeviceScan();
        this.isScanning = false;
        DeviceEventEmitter.emit('scanStopped');
        this.scanListeners.forEach(listener => listener());
    };

    /**
     * Registers a listener for when devices are found
     */
    onDeviceFound = (callback: (device: Device) => void): () => void => {
        this.deviceListeners.push(callback);
        return () => {
            this.deviceListeners = this.deviceListeners.filter(cb => cb !== callback);
        };
    };

    /**
     * Registers a listener for when scanning stops
     */
    onScanStopped = (callback: () => void): () => void => {
        this.scanListeners.push(callback);
        return () => {
            this.scanListeners = this.scanListeners.filter(cb => cb !== callback);
        };
    };

    /**
     * Registers a listener for device connection events
     */
    onConnected = (callback: () => void): () => void => {
        const subscription = DeviceEventEmitter.addListener('deviceConnected', callback);
        this.eventSubscriptions.push(subscription);
        return () => {
            subscription.remove();
            this.eventSubscriptions = this.eventSubscriptions.filter(sub => sub !== subscription);
        };
    };

    /**
     * Registers a listener for device disconnection events
     */
    onDisconnected = (callback: () => void): () => void => {
        const subscription = DeviceEventEmitter.addListener('deviceDisconnected', callback);
        this.eventSubscriptions.push(subscription);
        return () => {
            subscription.remove();
            this.eventSubscriptions = this.eventSubscriptions.filter(sub => sub !== subscription);
        };
    };

    /**
     * Connects to a NeoBin device by ID, authenticates, and sets up notifications
     */
    connectToDevice = async (deviceId: string): Promise<boolean> => {
        try {
            const device = await this.manager.connectToDevice(deviceId);
            await device.discoverAllServicesAndCharacteristics();
            this.connectedDevice = device;

            const authResult = await this.authenticateDevice();
            if (!authResult) {
                console.error('Authentication failed');
                this.disconnect();
                return false;
            }

            this.setupDeviceNotifications(device);
            await this.getDiagnostics();

            DeviceEventEmitter.emit('deviceConnected', device);
            return true;
        } catch (error) {
            console.error('Connection error:', error);
            DeviceEventEmitter.emit('connectionError', error);
            return false;
        }
    };

    /**
     * Authenticates with the NeoBin device by sending the auth token
     */
    private authenticateDevice = async (): Promise<boolean> => {
        if (!this.connectedDevice) {
            return false;
        }

        try {
            const authData = Buffer.from('NeoBin').toString('base64');
            await this.connectedDevice.writeCharacteristicWithResponseForService(
                this.NEO_UUID,
                this.NEO_AUTH_UUID,
                authData
            );
            this.authenticated = true;
            return true;
        } catch (error) {
            console.error('Authentication error:', error);
            this.authenticated = false;
            return false;
        }
    };

    /**
     * Disconnects from the current device
     */
    disconnect = async (): Promise<void> => {
        if (this.connectedDevice) {
            await this.manager.cancelDeviceConnection(this.connectedDevice.id);
            this.connectedDevice = null;
            this.authenticated = false;
            DeviceEventEmitter.emit('deviceDisconnected');
        }
    };

    /**
     * Returns the currently connected device
     */
    getConnectedDevice = (): Device | null => {
        return this.connectedDevice;
    };

    /**
     * Gets all devices connected to the OS with the NeoBin service UUID
     */
    async getConnectedDevices() {
        try {
            return await this.manager.connectedDevices([this.NEO_UUID]);
        } catch (error) {
            console.error('Error getting connected devices:', error);
            return [];
        }
    }

    /**
     * Finds and connects to a NeoBin device already paired with the OS
     */
    async findAndConnectToNeoBin(): Promise<boolean> {
        try {
            const connectedDevices = await this.getConnectedDevices();
            console.log('OS connected devices:', connectedDevices.map(d => d.name || d.id));

            const neoBinDevice = connectedDevices.find(device => device.name === 'NeoBin');

            if (neoBinDevice) {
                console.log('Found NeoBin device already connected to OS:', neoBinDevice.id);
                return await this.connectToDevice(neoBinDevice.id);
            }

            console.log('No NeoBin device found connected to OS');
            return false;
        } catch (error) {
            console.error('Error finding and connecting to NeoBin:', error);
            return false;
        }
    }

    /**
     * Sets up notifications from the device to receive status updates
     */
    private setupDeviceNotifications = (device: Device): void => {
        const keymap: Record<string, string> = {
            'Angle': 'angleUpdate',
            'Status': 'statusUpdate',
            'Opened': 'openedUpdate',
            'maxAngle': 'maxAngleUpdate',
            'detectDistance': 'detectDistanceUpdate',
        };

        console.log('Setting up device notifications...');

        const subscription = device.monitorCharacteristicForService(
            this.NEO_UUID,
            this.NEO_INFORM_UUID,
            (error, characteristic) => {
                if (error) {
                    console.error('Notification error:', error);
                    return;
                }

                if (characteristic?.value) {
                    try {
                        const rawData = Buffer.from(characteristic.value, 'base64');
                        const textDecoded = JSON.parse(rawData.toString());
                        console.log(textDecoded);

                        const keys = Object.keys(textDecoded);
                        const values = Object.values(textDecoded);

                        if (keys.length > 0) {
                            const key = keys[0];
                            if (key in keymap) {
                                console.log(`${key} update received`);
                                DeviceEventEmitter.emit(keymap[key as keyof typeof keymap], values[0]);
                            } else {
                                console.log(`Unknown key received: ${key}`);
                            }
                        }
                    } catch (e) {
                        console.error('Error processing notification:', e);
                    }
                }
            }
        );

        console.log('Notification subscription created');
        this.subscriptions.push(subscription);
    };

    /**
     * Requests current status from device and returns diagnostics
     */
    getDiagnostics = async (): Promise<any> => {
        try {
            await this.sendCommand('STATUS');
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({
                        connected: this.isConnected()
                    });
                }, 500);
            });
        } catch (error) {
            console.error('Diagnostics error:', error);
            throw error;
        }
    };

    /**
     * Gets current settings from the device with fallback to defaults
     */
    getSettings = async (): Promise<any> => {
        try {
            if (!this.connectedDevice || !this.authenticated) {
                console.log('Not connected or authenticated, using default settings');
                return this.getDefaultSettings();
            }

            return new Promise(async (resolve) => {
                const settings = this.getDefaultSettings();
                let receivedSettings = 0;

                const maxAngleListener = DeviceEventEmitter.addListener('maxAngleUpdate', (maxAngle: number) => {
                    settings.maxAngle = maxAngle;
                    receivedSettings++;
                    checkComplete();
                });

                const detectDistanceListener = DeviceEventEmitter.addListener('detectDistanceUpdate', (detectDistance: number) => {
                    settings.detectDistance = detectDistance;
                    receivedSettings++;
                    checkComplete();
                });

                const checkComplete = () => {
                    if (receivedSettings >= 2) {
                        cleanup();
                        resolve(settings);
                    }
                };

                const cleanup = () => {
                    maxAngleListener.remove();
                    detectDistanceListener.remove();
                    clearTimeout(timeoutId);
                };

                try {
                    await this.sendCommand("GET_SETTINGS");
                    console.log('GET_SETTINGS command sent');
                } catch (error) {
                    console.error("FAILED TO SEND COMMAND");
                }

                const timeoutId = setTimeout(() => {
                    console.log('Settings request timed out, using defaults for missing values');
                    cleanup();
                    resolve(settings);
                }, 3000);
            });
        } catch (error) {
            console.error('Failed to get settings:', error);
            return this.getDefaultSettings();
        }
    };

    /**
     * Returns default device settings
     */
    getDefaultSettings = (): any => {
        return {
            maxAngle: 180,
            detectDistance: 20,
            minAngle: 0,
        };
    };

    /**
     * Updates a setting on the device
     */
    updateSetting = async (key: string, value: any): Promise<void> => {
        if (!this.connectedDevice || !this.authenticated) {
            throw new Error('Not connected or not authenticated');
        }

        const command = `SETTINGS:${JSON.stringify({ type: 'settings', key: key, value: value })}`;
        console.log(`Sending settings update: ${key}=${value}`);
        await this.sendCommand(command);
    };

    /**
     * Sends a command and sets up a listener for responses
     */
    sendCommandAndListenForReports = async (command: string): Promise<EmitterSubscription> => {
        if (!this.connectedDevice || !this.authenticated) {
            return Promise.reject(new Error('No device connected or not authenticated'));
        }

        try {
            const data = Buffer.from(command).toString('base64');
            await this.connectedDevice.writeCharacteristicWithResponseForService(
                this.NEO_UUID,
                this.NEO_WRITE_UUID,
                data
            );

            const commandType = command.split(':')[0];
            const eventName = `response_${commandType}`;
            const subscription = DeviceEventEmitter.addListener('dataReceived', (responseData) => {
                DeviceEventEmitter.emit(eventName, responseData);
            });

            this.eventSubscriptions.push(subscription);
            return subscription;
        } catch (error) {
            console.error('Command error:', error);
            return Promise.reject(error);
        }
    };

    /**
     * Sends a command to the device
     */
    sendCommand = async (command: string): Promise<boolean> => {
        if (!this.connectedDevice || !this.authenticated) {
            console.error('No device connected or not authenticated');
            return false;
        }

        try {
            const data = Buffer.from(command).toString('base64');
            await this.connectedDevice.writeCharacteristicWithResponseForService(
                this.NEO_UUID,
                this.NEO_WRITE_UUID,
                data
            );
            return true;
        } catch (error) {
            console.error('Write error:', error);
            return false;
        }
    };

    /**
     * Registers a listener for general Bluetooth events
     */
    onEvent = (event: string, callback: (...args: any[]) => void): () => void => {
        const subscription = DeviceEventEmitter.addListener(event, callback);
        this.eventSubscriptions.push(subscription);

        return () => {
            subscription.remove();
            this.eventSubscriptions = this.eventSubscriptions.filter(sub => sub !== subscription);
        };
    };

    /**
     * Cleans up resources and connections
     */
    cleanup = (): void => {
        this.subscriptions.forEach(subscription => subscription.remove());
        this.subscriptions = [];

        this.eventSubscriptions.forEach(subscription => subscription.remove());
        this.eventSubscriptions = [];

        this.disconnect();
        this.manager.destroy();
    };
}

export default new BluetoothManager();