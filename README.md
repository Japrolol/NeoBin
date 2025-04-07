# NeoBin Backend

NeoBin is a smart bin project using Bluetooth Low Energy (BLE) for interactive waste management. This backend runs on a Raspberry Pi with a Python backend using the BlueZ stack.

## Features

- GATT service for authentication, command execution, and notifications
- Hardware integration with a servo motor and ultrasonic sensor for automated lid control
- BLE communication for seamless interaction with mobile devices

## Prerequisites

- Raspberry Pi with BlueZ stack installed
- Python 3.7+
- Required Python packages (listed in `requirements.txt`)

## Installation

1. **Clone the Repository:**
    ```bash
    git clone https://github.com/Japrolol/NeoBin.git
    cd NeoBin
    git checkout backend
    ```

2. **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3. **Run the Backend:**
    ```bash
    python main.py
    ```

## Configuration

- You may have to adjust pulse width based on the servo you use.

## Usage

- The backend script (`main.py`) initiates the BLE GATT service and handles hardware interactions.
- The backend listens for BLE commands and performs actions such as opening/closing the bin lid and sending notifications.

## Service File for Automatic Startup

You can set up the backend to start automatically on system boot by using the provided service file. Follow these steps:

1. **Modify the Service File:**
    - Open the `neobin.service` file located in the repository.
    - Update the `ExecStart` and `WorkingDirectory` paths to match your installation directory.
    - Update the `User` field to match your username.

2. **Copy the Service File:**
    ```bash
    sudo cp /path/to/NeoBin/backend/neobin.service /etc/systemd/system/
    ```

3. **Reload the Systemd Daemon and Enable the Service:**
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable neobin.service
    ```

4. **Start the Service:**
    ```bash
    sudo systemctl start neobin.service
    ```

## Hardware Integration

- **Servo Motor:** Controls the lid of the bin.
- **Ultrasonic Sensor:** Detects the presence of objects near the bin.

## GATT Service

- The GATT service is responsible for handling BLE communication, including:
  - **Authentication:** Verifies the identity of connected devices.
  - **Command Execution:** Executes commands received via BLE.
  - **Notifications:** Sends status updates and alerts to connected devices.

## Contributing

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a pull request.

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Japrolol - [GitHub Profile](https://github.com/Japrolol)

Project Link: [https://github.com/Japrolol/NeoBin](https://github.com/Japrolol/NeoBin)
