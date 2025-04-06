# NeoBin Frontend

NeoBin is a smart bin project using Bluetooth Low Energy (BLE) for interactive waste management. This frontend is designed to interact with the NeoBin backend running on a Raspberry Pi.

## Features

- User-friendly interface for interacting with the NeoBin backend
- Real-time status updates and notifications from the smart bin
- Control and monitor the bin's lid and sensor data

## Prerequisites

- Access to the NeoBin backend server

## Installation

1. **Clone the Repository:**
    ```bash
    git clone https://github.com/Japrolol/NeoBin.git
    cd NeoBin
    git checkout frontend
    ```

2. **Install Dependencies:**
    ```bash
    npm install
    ```

3. **Start the Metro Server:**
    ```bash
    npx react-native start
    ```

## Building the Frontend

- **For iOS:**
    ```bash
    npx react-native run-ios
    ```

- **For Android:**
    ```bash
    npx react-native run-android
    ```

- Alternatively, you may have to use Xcode or Android Studio to build and run the application.

## Configuration

- You may have to modify your Xcode or Gradle settings for this project. Otherwise, everything should be plug and play.

## Usage

- The frontend interface allows users to interact with the NeoBin backend.
- Users can open/close the bin lid, view sensor data, and receive notifications.

## Development

- **Start the Metro Server:**
    ```bash
    npx react-native start
    ```

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
