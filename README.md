# deckxstream

> **`deckxstream` is NOT ready for widespread use yet. Expect bugs and nastiness until some polish has been applied.**

`deckxstream` is a controller application for the [Elgato Stream Deck](https://www.elgato.com/en/gaming/stream-deck). The application was created to allow Linux usage of a Stream Deck but the application should allow for cross-platform usage. The application relies heavily on the [elgato-stream-deck](https://github.com/Julusian/node-elgato-stream-deck) NPM library. **Be sure to follow their udev and native dependency instructions applicable to your platform or else this application will not work!**

## Features

* Support for multiple image formats including PNG, SVG, and animated GIF
* Support for hotkeys and text input (via [RobotJS](https://www.npmjs.com/package/robotjs)), application running (via `child_process.spawn`)
* Dynamic buttons where any command/icon/text can be replaced via output from a running application
* Sticky buttons available on any page
* Data URI support for icons so they don't even need to be on disk
* Screensaver for full panel animations

## Installation

> NOTE: This is not currently in NPM, so use git for now.

Clone the repo

`$ npm install`

## Running

`$ node app`

```
Usage: app [options]

Options:
  -V, --version        output the version number
  -c, --config <file>  Configuration file to use. (default: "$HOME/.deckxstream.json")
  -l, --list           Show all detected Stream Decks and exit
  -i, --init [device]  Output an initial JSON file for the specified device if supplied
  -k, --keys [device]  Outputs the keyIndex values to each button on the specified Stream Deck (or first found) and exits
  -h, --help           display help for command
```

## Configuration

`deckxstream` requires a configuration file. By default, it will attempt to load `.deckxstream.json` in the HOME directory. 

> Example
```json
{
    "deckxstream-version": 1,
    "brightness": 70,
    "device": "somename",
    "screensaver": {
        "animation": "tumbler.gif",
        "brightness": 10,
        "timeoutMinutes": 20 
    },
    "sticky": [
        {
            "keyIndex": 0,
            "icon": "/some/dir/home.png",
            "changePage": "default",
            "text": "Home",
            "textSettings": {
                "fillStyle": "blue"
            }
        },
        {
            "keyIndex": 4,
            "icon": "/some/dir/speaker.svg",
            "text": "Mute",
            "command": "amixer set Master toggle"
        }
    ],
    "pages": [
        {
            "pageName": "default",
            "buttons": [
                {
                    "keyIndex": 1,
                    "icon": "/some/dir/retroarch.svg",
                    "changePage": "retroarch"
                },
                {
                    "keyIndex": 5,
                    "icon": "/some/dir/staticicondyntext.png",
                    "dynamic": "bspc query -N | wc -l | awk '{ print \"{\\\"text\\\": \"$1\"}\"}'",
                    "dynamicInterval": 5000
                },
                {
                    "keyIndex": 6,
                    "icon": "data:image/svg+xml;base64,PD94bWwgdmVy..."
                }
                {
                    "keyIndex": 10,
                    "icon": "/some/dir/lockscreen.svg",
                    "sendkey": "command+l"
                },
                {
                    "keyIndex": 13,
                    "icon": "redshift.svg",
                    "changeBrightness": 10,
                    "command": "redshift -x; redshift -O 4000 -b .5"
                },
                {
                    "keyIndex": 14,
                    "icon": "brightness.svg",
                    "changeBrightness": 70,
                    "command": "redshift -x"
                }
            ]
        },
        {
            "pageName": "retroarch",
            "buttons": [
                {
                    "keyIndex": 1,
                    "icon": "/some/dir/retroarch.svg",
                },
                {
                    "keyIndex": 10,
                    "icon": "save.svg",
                    "sendkey": "f2",
                    "text": "Save"
                },
                {
                    "keyIndex": 7,
                    "icon": "plus.svg",
                    "sendkey": "f7"
                },
                {
                    "keyIndex": 12,
                    "icon": "minus.svg",
                    "sendkey": "f6"
                },
                {
                    "keyIndex": 14,
                    "icon": "load.svg",
                    "sendkey": "f4",
                    "text": "Load"
                }
            ]
        }
    ]
}
```

### Details

<a name="version"></a>`deckxstream-version` - Version number for the JSON file schema. Currently only `1`.

<a name="brightness"></a>`brightness` - Brightness to set to at start of application. Supports `0-100`. (Default: `90`)

<a name="device"></a>`device` - The device serial number to use if multiple Stream Decks are in use. (Default: first found)

<a name="screensaver"></a>`screensaver` - Configuration block for the screensaver (Optional)

| Value     | Required | Notes|
|-----------|----------|------|
| animation | Yes      | Filename of the GIF to use as a screensaver 
| brightness| No       | Brightness to change the deck to when screensaver turns on
| timeoutMinutes | Yes | Time in minutes until screensaver kicks in 

<a name="sticky"></a>`sticky` - Sticky buttons. These buttons are available on EVERY page. If another page tries to load a button in the same location, it will be ignored. Entries follow the <a href="#button">button</a> format in an array. (Optional)

<a name="pages"></a>`pages` - Pages for deck. On startup, a `default` page will be loaded. (Optional)

| Value    | Required | Notes|
|----------|----------|------
| pageName| Yes      | The name for the page. `default` is loaded on startup. Use `changePage` to go to a different page.
| buttons  | Yes      | Array of <a href=#button>buttons</a> to load on the page.

#### <a name="button"></a> Button Format

| Value              | Required | Notes
|--------------------|----------|-----
| keyIndex           | Yes      | The key to bind to. For example, the standard Stream Deck would have 0-14. Run `deckxstream` without a configuration file to see the numbering for yours.
| icon               | No       | Either the filename or a Base64 data URI for an image to display in the button. The image will be automatically resized (respecting aspect ratio) to fit.
| text               | No       | A text label to place at the bottom of the button. If an `icon` is specified, it will be resized to allow the text to fit.
| textSettings       | No       | Changes the look of the label text. Use an object with properties for [CanvasRenderingContext2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D) like `fillStyle` and `font`.
| changePage        | No       | On click, change the deck to the named page from the array of <a href="#pages">pages</a>.
| changeBrightness  | No       | On click, change the brightness of the deck. Values of `0-100` supported.
| command            | No       | On click, run the given command using `child_process.spawn`
| sendkey            | No       | On click, send the given hotkey. Follows the naming of keys from [RobotJS](http://robotjs.io/docs/syntax#keys). To support meta keys, supply them at the start seperated by plus signs. Example: `control+alt+delete`.
| sendtext           | No       | On click, send the given string to active window. 
| dynamic            | No       | Run the given command using `child_process.spawn` and listen on standard output based on the `dynamicInterval`. The output must be properly formed JSON. The JSON will overwrite any of the above values until the next interval. See below for an example.
| dynamicInterval    | No (Yes if dynamic) | Time in ms between running the `dynamic` command. Keep in mind that if the `text` or `icon` of the button is changed, this can have an impact on system resources if the timeout is very short.

#### Example of `dynamic` overwrite

As an example of `dynamic`, let's say you have a `checkEmail.sh` script which opens your mail client and `hasEmail.sh` which checks to see if you have any new mail. 

Given a button config of
```json
{
    "keyIndex": 0,
    "icon": "/dir/mail.png",
    "command": "checkEmail.sh",
    "dynamic": "hasEmail.sh",
    "dynamicInterval": 60000
}
```
If `hasEmail.sh` returns
```json
{
    "icon": "/dir/mailanimated.gif",
    "text": "6 New!"
}
```
The button will now be
```json
{
    "keyIndex": 0,
    "icon": "/dir/mailanimated.gif",
    "text": "6 New!",
    "command": "checkEmail.sh",
    "dynamic": "hasEmail.sh",
    "dynamicInterval": 60000
}
```
If it then returns
```json
{
    "text": "0 New"
}
```

Then the button becomes
```json
{
    "keyIndex": 0,
    "icon": "/dir/mail.png",
    "text": "0 New",
    "command": "checkEmail.sh",
    "dynamic": "hasEmail.sh",
    "dynamicInterval": 60000
}
```
The original configuration is used as the base between runs, not the the results of the previous run.