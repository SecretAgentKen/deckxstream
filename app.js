#!/usr/bin/env node

const {program} = require('commander');
const path = require('path');
const fs = require('fs');
const robot = require("robotjs");
const {openStreamDeck} = require('elgato-stream-deck');
const DeckManager = require('./lib/deckManager');

program
	.option('-c, --config <file>', 'Configuration file to use.', path.join(process.env.HOME, '.deckxstream.json'))
	.option('-k, --keys', 'Outputs the keyIndex values to each button on the Stream Deck and exits')

program.parse(process.argv);

const options = program.opts();

robot.setKeyboardDelay(1);

let config;
if ( options.keys ) {
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
	setTimeout(process.exit, 2000);
} else if ( options.config ) {
	if ( !fs.existsSync(options.config) ) exitError(`Specified config ${options.config} does not exist!`);
	config = require(options.config);
}

// FIXME - Use the specified deck id here
const streamDeck = openStreamDeck();

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

function exitError(err){
	console.error(err);
	process.exit(1);
}
