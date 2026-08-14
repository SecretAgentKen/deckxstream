# Change Log

## [3.0.0] - 2026-02-15

### Added

- OBS Studio integration. Define connections in a new top-level `obsConfig` and trigger OBS WebSocket requests per-button with `obsCommands`.

### Changed

- BREAKING: Configuration schema bumped to version `2`. The version key was renamed from `deckxstream-version` to `deckxstreamConfigVersion` and must now be set to `2`.
- BREAKING: Node.js 24 is now the minimum supported version.
- BREAKING: Removed `sendkey` and `sendtext` hotkey support (and the `libxdo` bindings). Use `command` with `xdotool` instead.
- Converted the codebase to TypeScript and switched the build to esbuild.
- Bumped `@elgato-stream-deck/node` to 7.x and updated other dependencies.
- Added `zod` for configuration validation.

### Fixed

- Screensaver now handles decks with key gaps (non-contiguous button layouts).
- Fixed handling of Base64 data URI icons.
- Fixed button text rendering.

## [2.2.2] - 2023-11-24

### Changed

- Updated `sharp` to 0.32.6 due to vulnerability

## [2.2.1] - 2022-11-09

### Changed

- BREAKING: Node 14 now the minimum version
- Bumped library versions

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
