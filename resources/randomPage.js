#!/usr/bin/env node

const {program} = require('commander');

program
	.requiredOption('-k, --keys <keys>', 'Number of keys to generate buttons for');

program.parse(process.argv);

const options = program.opts();

let result = {buttons:[]};
for(let i = 0; i < options.keys; i++){
	result.buttons.push({
		keyIndex: i,
		text: i.toString(),
		dynamic:{
			command: "resources/randomButton.js -r",
			persistent: true
		}
	});
}

console.log(JSON.stringify(result));