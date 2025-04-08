"""
This script sets up a Bluetooth Low Energy (BLE) service using the BlueZ stack on a Raspberry Pi.
It includes a GATT service with characteristics for authentication, writing commands, and sending notifications.
The script also handles hardware initialization for a servo motor and an ultrasonic sensor.
"""

import json
import signal
import threading
import time

import dbus
import dbus.exceptions
import dbus.mainloop.glib
import dbus.service

from gi.repository import GLib
import sys

from typing import List, Dict

import pigpio

from BluetoothManager import Characteristic, Service, Application, Descriptor, InvalidValueLengthException, \
    FailedException, BLUEZ_SERVICE_NAME, DBUS_OM_IFACE, GATT_MANAGER_IFACE, DBUS_PROP_IFACE, Agent, GATT_CHRC_IFACE, \
    Advertisement, LE_ADVERTISING_MANAGER_IFACE
import logging

import subprocess

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s: %(message)s'
)
log = logging.getLogger("NeoBin")

class NeoService(Service):
    NEO_UUID = '0000180d-0000-1000-8000-00805f9b34fb'

    SERVO_PIN = 18
    TRIG_PIN = 17
    ECHO_PIN = 27

    def __init__(self, bus, index):
        # Initialize the service and hardware
        self.settings = self.read_json()
        Service.__init__(self, bus, index, self.NEO_UUID, True)
        self.add_characteristic(AuthChrc(bus, 0, self))
        self.add_characteristic(WriteChrc(bus, 1, self))
        self.add_characteristic(InformChrc(bus, 2, self))
        self.is_auth = False
        self.status = True
        self.angle = 0
        self.opened = 180 >= self.angle > 0
        self.running = False
        self._init_hardware()

    def is_authenticated(self):
        # Check if the service is authenticated
        return self.is_auth

    def _init_hardware(self):
        # Initialize the hardware components
        try:
            log.info("Initializing hardware")
            self.pi = pigpio.pi()
            if not self.pi.connected:
                raise RuntimeError("Failed to connect to pigpio daemon. Is pigpiod running")
            self.pi.set_mode(self.TRIG_PIN, pigpio.OUTPUT)
            self.pi.set_mode(self.ECHO_PIN, pigpio.INPUT)
            self.pi.write(self.TRIG_PIN, 0)
            self.set_initial_angle()
            log.info("Hardware initialized successfully")
        except Exception as e:
            log.error(f"Hardware initialization error: {e}")
            raise

    def set_servo_angle(self, angle):
        # Set the angle of the servo motor
        if not self.status:
            raise FailedException("NeoBin is not on")
        try:
            if not (int(self.settings["settings"]["minAngle"]) <= angle <= int(self.settings["settings"]["maxAngle"])):
                log.warning(f"Invalid angle requested: {angle}")
                raise InvalidValueLengthException()
            pulse_width = 500 + ((180 - angle) * 2000 // 180)
            self.pi.set_servo_pulsewidth(self.SERVO_PIN, pulse_width)
            log.info(f"Servo angle set to {angle}")
        except Exception as e:
            log.error(f"Servo control error: {e}")

    def set_initial_angle(self):
        # Set the initial angle of the servo motor
        pulse_width = 500 + ((180-int(self.settings["settings"]["minAngle"])) * 2000 // 180)
        self.pi.set_servo_pulsewidth(self.SERVO_PIN, pulse_width)

    def read_json(self):
        # Read settings from a JSON file
        try:
            with open("settings.json", "r") as file:
                return json.load(file)
        except FileNotFoundError:
            with open("settings.json", "w") as file:
                json.dump(self.return_default(), file, indent=4)
            return self.return_default()

    def return_default(self):
        # Return default settings
        try:
            with open("default.json", "r") as file:
                return json.load(file)
        except FileNotFoundError:
            with open("default.json", "w") as file:
                json.dump({"settings": {"minAngle": 0, "maxAngle": 180, "detectDistance": 20}}, file, indent=4)
            return {"settings": {"minAngle": 0, "maxAngle": 180, "detectDistance": 20}}

    def save_json(self, data):
        # Save settings to a JSON file
        try:
            with open("settings.json", "r+") as file:
                settings = json.load(file)
                settings[data["type"]][data["key"]] = data["value"]
                file.seek(0)
                json.dump(settings, file, indent=4)
                file.truncate()
            self.settings = settings
            return True
        except (FileNotFoundError, json.JSONDecodeError) as e:
            log.error(f"Error reading or writing settings.json: {e}")
            raise FailedException(f"Couldn't save file: {e}")
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise FailedException(f"Couldn't save file: {e}")

    def measure_distance(self):
        # Measure distance using the ultrasonic sensor
        if not self.status:
            return 0
        try:
            self.pi.write(self.TRIG_PIN, 1)
            time.sleep(0.00001)
            self.pi.write(self.TRIG_PIN, 0)
            start_time = time.time()
            pulse_start = start_time
            while self.pi.read(self.ECHO_PIN) == 0:
                pulse_start = time.time()
                if pulse_start - start_time > 0.1:
                    return 0
            start_time = time.time()
            pulse_end = pulse_start
            while self.pi.read(self.ECHO_PIN) == 1:
                pulse_end = time.time()
                if pulse_end - start_time > 0.1:
                    return 0
            pulse_duration = pulse_end - pulse_start
            distance = pulse_duration * 34300 / 2
            return distance if 0 < distance < 300 else 0
        except Exception as e:
            log.error(f"Distance measurement error: {e}")
            return 0

    def sensor_loop(self):
        # Continuously monitor the proximity sensor
        log.info("Starting proximity sensor monitoring")
        while self.running:
            try:
                distance = self.measure_distance()
                if distance > 0 and distance < self.settings["settings"]["detectDistance"]:
                    log.info(f"Motion detected at {distance:.1f}cm")
                    self.characteristics[1].set_open()
                    time.sleep(3)
                    if self.running:
                        self.characteristics[1].set_close()
                    time.sleep(0.5)
            except Exception as e:
                log.error(f"Sensor loop error: {e}")
                time.sleep(1)

class AuthChrc(Characteristic):
    NEO_AUTH_UUID = '00002a37-0000-1000-8000-00805f9b34fb'

    def __init__(self, bus, index, service):
        # Initialize the authentication characteristic
        Characteristic.__init__(self, bus, index, self.NEO_AUTH_UUID, ['write'], service)
        self.PASS = b"NeoBin" # Set to something safe

    def WriteValue(self, value, options):
        # Handle write requests for authentication
        device = options.get('device', 'unknown')
        log.info(f"Authorizing ${device}")
        if bytes(value) != self.PASS:
            log.warning(f"{device} failed authentication")
            self.service.is_auth = False
            raise FailedException("Authentication Failed")
        else:
            self.service.is_auth = True
            log.info(f"${device} has successfully authenticated")
            return

class WriteChrc(Characteristic):
    NEO_WRITE_UUID = '00002a38-0000-1000-8000-00805f9b34fb'

    def __init__(self, bus, index, service):
        # Initialize the write characteristic
        Characteristic.__init__(self, bus, index, self.NEO_WRITE_UUID, ['write'], service)
        self.command_handler = {
            "OPEN": self.set_open,
            "CLOSE": self.set_close,
            "STATUS": self.set_status,
            "SETTINGS": self.update_settings,
            "GET_SETTINGS": self.get_settings,
            "WIFI_DISCONNECT": self.disconnect_from_wifi,
            "GET_WIFI": self.get_wifi
        }

    def get_settings(self):
        # Send all current settings to the client
        try:
            self.service.characteristics[2].send_notification(
                {'maxAngle': int(self.service.settings["settings"]["maxAngle"])}
            )
            self.service.characteristics[2].send_notification(
                {'detectDistance': int(self.service.settings["settings"]["detectDistance"])}
            )
            log.info("Sent settings to client")
        except Exception as e:
            log.error(f"Error sending settings: {e}")
            raise FailedException(str(e))
    def get_wifi(self):
        try:
            self.service.characteristics[2].send_notification(
                {'WiFiConnectionData': self.service.characteristics[2].get_wifi_status()}
            )
            log.info("SENT WIFI DATA TO CLIENT")
        except Exception as e:
            log.error(f"Error sending wifi: {e}")
            raise FailedException(str(e))

    def update_settings(self, data):
        # Update settings based on client input
        try:
            data = json.loads(data)
            new_data = {
                "type": data["type"],
                "key": data["key"],
                "value": data["value"]
            }
            result = self.service.save_json(new_data)
            if result:
                log.info("Settings have been updated")
                self.service.characteristics[2].send_notification({new_data["key"]: new_data["value"]})
        except (json.JSONDecodeError, KeyError) as e:
            log.error(f"Failed to update settings: {e}")
            raise InvalidValueLengthException()

    def disconnect_from_wifi(self):
        try:
            subprocess.run(["sudo","nmcli","device","disconnect","wlan0"])
            log.info("Successfully disconnected from WiFi")
            self.service.characteristics[2].send_notification(
                {'WiFiConnectionData': self.service.characteristics[2].get_wifi_status()}
            )
        except subprocess.CalledProcessError as e:
            subprocess.run(["sudo", "nmcli", "device", "disconnect", "wlan0"])
            log.error(f"Failed to disconnect from wifi: {e}")

    def connect_to_wifi(self, command):
        # Connect to the WiFi
        ssid = command.split(":")[0]
        password = command.split(":")[1]

        try:
            subprocess.run(["sudo", "nmcli", "device", "wifi", "connect", ssid, "password", password], check=True)
            log.info(f"Successfully connected to WiFi network: {ssid}")
            self.service.characteristics[2].send_notification(
                {'WiFiConnectionData': self.service.characteristics[2].get_wifi_status()}
            )
        except subprocess.CalledProcessError as e:
            log.error(f"Failed to connect to WiFi network: {ssid}. Error: {e}")
            self.service.characteristics[2].send_notification(
                {'WiFiConnectionData': self.service.characteristics[2].get_wifi_status()}
            )

    def set_open(self):
        # Open the NeoBin
        self.service.angle = int(self.service.settings["settings"]["maxAngle"])
        self.service.set_servo_angle(self.service.angle)
        self.service.opened = int(self.service.settings["settings"]["maxAngle"]) >= self.service.angle > int(self.service.settings["settings"]["minAngle"])
        log.info(f"NeoBin has been opened")
        self.service.characteristics[2].send_notification({'Angle': self.service.angle})
        self.service.characteristics[2].send_notification({'Opened': self.service.opened})

    def set_close(self):
        # Close the NeoBin
        self.service.angle = int(self.service.settings["settings"]["minAngle"])
        self.service.set_servo_angle(self.service.angle)
        self.service.opened = int(self.service.settings["settings"]["maxAngle"]) >= self.service.angle > int(self.service.settings["settings"]["minAngle"])
        log.info(f"NeoBin has been closed")
        self.service.characteristics[2].send_notification({'Angle': self.service.angle})
        self.service.characteristics[2].send_notification({'Opened': self.service.opened})

    def set_status(self):
        # Toggle the status of the NeoBin
        self.service.status = not self.service.status
        log.info(f"NeoBin status has been set to {self.service.status}")
        self.service.characteristics[2].send_notification({'Status': self.service.status})

    def WriteValue(self, value, options):
        # Handle write requests for commands
        if not self.service.is_authenticated():
            raise FailedException("Not authenticated")
        try:
            command = bytes(value).decode('utf-8')
            log.info(f"Received command: {command}, options: {options}")
            if command.startswith("ANGLE:"):
                try:
                    angle = int(command[6:])
                    self.service.angle = angle
                    self.service.set_servo_angle(self.service.angle)
                    self.service.opened = int(self.service.settings["settings"]["maxAngle"]) >= self.service.angle > int(self.service.settings["settings"]["minAngle"])
                    log.info(f"Angle set to: {angle}")
                    self.service.characteristics[2].send_notification({'Angle': self.service.angle})
                    self.service.characteristics[2].send_notification({'Opened': self.service.opened})
                except ValueError:
                    log.warning("Invalid angle format")
                    raise InvalidValueLengthException()
            elif command.startswith(("CONNECT:")):
                self.connect_to_wifi(command[8:])
            elif command.startswith("SETTINGS:"):
                self.update_settings(command[9:])
            elif command in self.command_handler:
                self.command_handler[command]()
            else:
                raise FailedException("Invalid command")
        except Exception as e:
            log.error(f"Error processing write value: {e}")
            raise FailedException(str(e))

class InformChrc(Characteristic):
    NEO_INFORM_UUID = '00002a39-0000-1000-8000-00805f9b34fb'

    def __init__(self, bus, index, service):
        # Initialize the inform characteristic
        Characteristic.__init__(self, bus, index, self.NEO_INFORM_UUID, ['notify', 'read'], service)
        self.command_handler = {
            "STATUS": self.get_status,
            "OPENED": self.get_open,
            "ANGLE": self.get_angle
        }
        self.notifying = False

    def get_status(self):
        # Get the status of the NeoBin
        return self.service.status

    def get_angle(self):
        # Get the current angle of the servo motor
        return self.service.angle

    def get_open(self):
        # Check if the NeoBin is open
        return self.service.opened

    def get_wifi_status(self):
        try:
            wifi_info = {"connected": False, "ssid": None, "ip_address": None}

            # Check if WiFi is connected at all
            conn_result = subprocess.run(
                ["nmcli", "-t", "-f", "TYPE,NAME,DEVICE,STATE", "connection", "show", "--active"],
                capture_output=True,
                text=True,
                check=False
            )

            wifi_device = None
            # Find active WiFi connection and get device name
            for line in conn_result.stdout.strip().split('\n'):
                if line.startswith('802-11-wireless:'):
                    parts = line.split(':')
                    if len(parts) >= 4 and parts[3] == 'activated':
                        wifi_info["connected"] = True
                        wifi_device = parts[2]
                        break

            if not wifi_info["connected"] or not wifi_device:
                return wifi_info

            # Get SSID using iw dev command
            try:
                ssid_result = subprocess.run(
                    ["iw", "dev", wifi_device, "link"],
                    capture_output=True,
                    text=True,
                    check=False
                )

                for line in ssid_result.stdout.strip().split('\n'):
                    if "SSID:" in line:
                        wifi_info["ssid"] = line.split("SSID:")[1].strip()
                        break
            except Exception as e:
                log.warning(f"Failed to get SSID with iw command: {e}")

            # If SSID is still None, try nmcli dev wifi
            if not wifi_info["ssid"]:
                try:
                    ssid_result = subprocess.run(
                        ["nmcli", "-t", "-f", "active,ssid", "dev", "wifi"],
                        capture_output=True,
                        text=True,
                        check=False
                    )

                    for line in ssid_result.stdout.strip().split('\n'):
                        if line.startswith('yes:'):
                            wifi_info["ssid"] = line.split(':', 1)[1]
                            break
                except Exception as e:
                    log.warning(f"Failed to get SSID with nmcli dev wifi: {e}")

            # Get IP address
            if wifi_device:
                ip_result = subprocess.run(
                    ["ip", "-f", "inet", "addr", "show", wifi_device],
                    capture_output=True,
                    text=True,
                    check=False
                )

                # Extract IP address
                for line in ip_result.stdout.strip().split('\n'):
                    if "inet " in line:
                        ip_addr = line.split("inet ")[1].split("/")[0]
                        wifi_info["ip_address"] = ip_addr
                        break

            log.info(f"WiFi status: {wifi_info}")
            return wifi_info

        except Exception as e:
            log.error(f"Error getting WiFi status: {e}")
            return {"connected": False, "ssid": None, "ip_address": None}


    def ReadValue(self, options):
        # Handle read requests
        if not self.service.is_authenticated():
            raise FailedException("Not authenticated")
        if options not in self.command_handler:
            raise FailedException("Invalid command")
        else:
            return self.command_handler[options]()

    def StartNotify(self):
        # Start sending notifications
        if self.notifying:
            log.info("Already notifying, nothing to do")
            return
        if not self.service.is_authenticated():
            raise FailedException("Not authenticated")
        self.notifying = True
        log.info("Start notifying")

    def StopNotify(self):
        # Stop sending notifications
        if not self.notifying:
            log.info("Not notifying, nothing to do")
            return
        self.notifying = False
        log.info("Stop notifying")

    def send_notification(self, data):
        # Send a notification to the client
        if not self.notifying:
            log.warning("Not notifying, skipping notification")
            return
        try:
            byte_data = dbus.ByteArray(json.dumps(data).encode('utf-8'))
            self.PropertiesChanged(GATT_CHRC_IFACE, {'Value': byte_data}, [])
            log.info(f"Notification sent: {data}")
        except Exception as e:
            log.error(f"Error sending notification: {e}")

class NeoAdvertisement(Advertisement):
    def __init__(self, bus, index):
        # Initialize the advertisement
        Advertisement.__init__(self, bus, index, 'peripheral')
        self.add_service_uuid('0000180d-0000-1000-8000-00805f9b34fb')
        self.add_manufacturer_data(0xABCD, [ord(c) for c in "HeralNeoBin"])
        self.add_local_name('NeoBin')
        self.include_tx_power = True

def register_app_cb():
    # Callback for successful GATT application registration
    log.info('GATT application registered')

def register_ad_cb():
    # Callback for successful advertisement registration
    log.info('Advertisement registered')

def register_ad_error_cb(error):
    # Callback for advertisement registration error
    log.warning('Failed to register advertisement: ' + str(error))
    mainloop.quit()

def register_app_error_cb(error):
    # Callback for GATT application registration error
    log.warning('Failed to register application: ' + str(error))

def find_adapter(bus):
    # Find the Bluetooth adapter
    remote_om = dbus.Interface(bus.get_object(BLUEZ_SERVICE_NAME, '/'), DBUS_OM_IFACE)
    objects = remote_om.GetManagedObjects()
    for o, props in objects.items():
        if LE_ADVERTISING_MANAGER_IFACE in props:
            return o
    return None

def shutdown(timeout, ad_manager, adv_path):
    # Shutdown the advertisement after a timeout
    log.info('Advertising for {} seconds...'.format(timeout))
    time.sleep(timeout)
    log.info('Unregistering advertisement...')
    try:
        ad_manager.UnregisterAdvertisement(adv_path)
        log.info('Advertisement unregistered')
    except Exception as e:
        log.error(f"Failed to unregister advertisement: {e}")

def unregister_application(service_manager, app_path):
    # Unregister the GATT application
    try:
        service_manager.UnregisterApplication(app_path)
        log.info('GATT application unregistered')
    except Exception as e:
        log.warning(f'Failed to unregister application: ${e}')

def signal_handler(sig, frame, service_manager, app_path, mainloop, neo_service):
    # Handle termination signals
    log.info('Exiting...')
    unregister_application(service_manager, app_path)
    neo_service.running = False
    neo_service.pi.set_servo_pulsewidth(neo_service.SERVO_PIN, 0)
    neo_service.pi.stop()
    mainloop.quit()
    sys.exit(0)

def register_agent(bus, adapter_path, agent_path):
    # Register the agent for handling pairing requests
    agent_manager = dbus.Interface(
        bus.get_object(BLUEZ_SERVICE_NAME, '/org/bluez'),
        'org.bluez.AgentManager1'
    )
    agent_manager.RegisterAgent(agent_path, 'KeyboardDisplay')
    log.info('Agent registered')

def main(timeout=0):
    # Main function to set up and run the BLE service
    global mainloop

    dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)

    bus = dbus.SystemBus()

    adapter = find_adapter(bus)
    if not adapter:
        log.warning('GATTManager1 interface not found')
        return

    adapter_object = bus.get_object(BLUEZ_SERVICE_NAME, adapter)
    adapter_props = dbus.Interface(adapter_object, DBUS_PROP_IFACE)

    adapter_props.Set(BLUEZ_SERVICE_NAME + '.Adapter1', 'Powered', dbus.Boolean(1))
    adapter_props.Set(BLUEZ_SERVICE_NAME + '.Adapter1', 'Discoverable', True)
    adapter_props.Set(BLUEZ_SERVICE_NAME + '.Adapter1', 'Pairable', True)

    ad_manager = dbus.Interface(adapter_object, LE_ADVERTISING_MANAGER_IFACE)

    adv = NeoAdvertisement(bus, 0)
    adv_path = adv.get_path()

    agent = Agent(bus)
    register_agent(bus, adapter, Agent.AGENT_PATH)

    service_manager = dbus.Interface(bus.get_object(BLUEZ_SERVICE_NAME, adapter), GATT_MANAGER_IFACE)
    app = Application(bus, NeoService)
    app_path = app.get_path()

    mainloop = GLib.MainLoop()

    ad_manager.RegisterAdvertisement(adv.get_path(), {}, reply_handler=register_ad_cb, error_handler=register_ad_error_cb)

    neo_service = app.get_service()
    neo_service.running = True

    sensor_thread = threading.Thread(target=neo_service.sensor_loop, daemon=True, name="SensorThread")
    sensor_thread.start()

    if timeout > 0:
        threading.Thread(target=shutdown, args=(timeout, ad_manager, adv_path)).start()
    else:
        log.info('Advertising forever...')

    log.info('Registering GATT application...')

    service_manager.RegisterApplication(app.get_path(), {}, reply_handler=register_app_cb, error_handler=register_app_error_cb)

    signal.signal(signal.SIGINT, lambda sig, frame: signal_handler(sig, frame, service_manager, app_path, mainloop, neo_service))

    mainloop.run()

if __name__ == '__main__':
    main(30)