#!/usr/bin/env node

const sharp = require('sharp');
const {program} = require('commander');

program
	.option('-r, --repeat', 'output a new entry every 5 seconds');

program.parse(process.argv);

const options = program.opts();

if (options.repeat) {
	setInterval(genButton, 5000);
}
genButton();

function genButton() {
	let result = {};
	let color = {r: rand(0, 256), g: rand(0, 256), b: rand(0, 256)};
	result.textSettings = {fillStyle: `rgb(${color.r},${color.g},${color.b})`}; 
	sharp({create: {width: 1, height: 1, channels: 3, background: color}})
		.removeAlpha()
		.png()
		.toBuffer()
		.then((buff) => {
			result.icon = `data:image/png;base64,${buff.toString('base64')}`;
			console.log(JSON.stringify(result));
		});
}

function rand(min, max) {
	return Math.floor(Math.random() * (max - min) + min);
}