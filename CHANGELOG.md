# Change Log

## [2.1.0] - 2022-06-13

### Changed

- BREAKING: Upgraded to `@elgato-stream-deck/node` which requires additional udev rules. See the README
- Bumped library versions

## [2.0.0] - 2021-03-07

### Changed 

- BREAKING: Removed Robot.js due to building issues and having to use a random git commit instead of a proper release. Replaced it with raw `xdo` calls with a new module. This means no more Windows or Mac support. Also hotkeys will need to be modified to be X Keysym strings. For example, `Command` should now be `Super`.
- Bumped library versions

## [1.0.1] - 2021-02-02

### Changed

- Fix bug where `startScreensaver` would still allow the normal screensaver to start and they run in parallel.

## [1.0.0] - 2021-01-30

### Added

- The screensaver can now be immediately triggered with `startScreensaver`

## [0.0.4] - 2021-01-23

### Added

- Added support for data URIs for screensaver

### Changed

- Modified the `setKeyboardDelay` for RobotJS to be 20ms instead of 1ms to make hotkeys in RetroArch more consistent.

## [0.0.3] - 2021-01-22

Initial Version

