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

- You made have to modify the pulse width of the servo to fit your needs. I am using a MG995.

## Usage

- The backend script (`main.py`) initiates the BLE GATT service and handles hardware interactions.
- The backend listens for BLE commands and performs actions such as opening/closing the bin lid and sending notifications.

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
