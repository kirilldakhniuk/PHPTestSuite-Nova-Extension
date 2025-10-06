# PHP Test Suite

Is an extension for Panic's Nova code editor that provides seamless integration for running PHP tests using PHPUnit and PEST. It allows you to execute tests directly from the editor, making your testing workflow faster and more efficient.

## Features

- Sidebar integration for browsing and running tests.
- Command palette support for quick actions like Run File, Run Nearest, Run Latest.
- Customizable execution prefix for environments like Docker containers (e.g., Laravel Sail/Spin).
- Double-click functionality to run specific tests from the sidebar.
- Support for both PHPUnit and PEST frameworks.

## Requirements

- Your PHP project must include a composer.json file with either PHPUnit or PEST installed as dependencies.
- PHP installed on your system or accessible via a configured environment.

## Usage

### Sidebar

- Open the PHPTestSuite sidebar in Nova.
- Browse your project's tests.
- Double-click a test method to run it individually.
- Right-click a file in the sidebar to access the context menu and run the entire file.

### Command Palette

- Open the Command Palette (⌘ + Shift + P).
- Type "PHP Test Suite" to see available commands, such as:

* **Run File**: Runs all tests in the current file.
* **Run Nearest**: Runs the test nearest to your cursor.
* **Run Latest**: Re-runs the most recently executed test.

## Configuration

You can customize the extension via Nova's preferences:

Go to **Extensions > PHPTestSuite > Preferences**.
Set a command prefix for test execution. This is useful for containerized environments.

For example, in a Laravel Sail/Spin setup with Docker, you might set the prefix to `sail` or `spin exec php` so tests run inside the container: `spin exec php vendor/bin/phpunit --filter TestMethod`.

## Contributing

Contributions are welcome! Feel free to open issues, submit pull requests, or start discussions on the GitHub repository.
