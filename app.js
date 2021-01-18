#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const {openStreamDeck} = require('elgato-stream-deck');
const robot = require("robotjs");
const DeckManager = require('./lib/deckManager');

robot.setKeyboardDelay(1);

const streamDeck = openStreamDeck();

let config;
if ( fs.existsSync('./config.json') ) {
    config = require('./config.json');
} else {
    config = {
        "deckxstream-version": 1,
        "brightness": 90,
        "pages": [
            {
                "page_name": "default",
                "buttons": new Array(streamDeck.NUM_KEYS).fill(undefined).map((v,i)=>{
                    return {keyIndex: i, text: i.toString()};
                })
            }
        ]
    }
}

const buttons = new Array(streamDeck.NUM_KEYS);
const deckMgr = new DeckManager(streamDeck, buttons, config);
let ssTimer;
let ssActive = false;

streamDeck.clearAllKeys();
if ( config.brightness ) {
    streamDeck.setBrightness(config.brightness);
}
if ( config.screensaver ) {
    ssTimer = checkScreensaver();
}

deckMgr.changePage("default");

streamDeck.on('down', (keyIndex)=>{
    if ( ssActive ) {
        deckMgr.stopScreensaver();
        ssActive = false;
    } else {
        if ( buttons[keyIndex] ) {
            buttons[keyIndex].activate();
        }
    }
    if ( ssTimer ) {
        clearTimeout(ssTimer);
    }
    // ssTimer will be null if it was started previously
    if ( config.screensaver ){
        ssTimer = checkScreensaver();
    }
});

function checkScreensaver(){
    return setTimeout(()=>{
        ssActive = true;
        ssTimer = null;
        deckMgr.startScreensaver();
    }, config.screensaver.timeoutMinutes * 60 * 1000);
}
