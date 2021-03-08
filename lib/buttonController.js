const sharp = require("sharp");
const Promise = require('bluebird');
const { spawn } = require('child_process');
const xdo = require("../build/Release/xdo");

module.exports = class ButtonController {
	constructor(deckMgr, btnCfg) {
		this.deckMgr = deckMgr;
		this.btnCfg = btnCfg;

		this.pages = [];
		this.stopped = true;
	}

	init() {
		if (this.btnCfg.dynamic) {
			return this.initDynamic();
		} else {
			return this.initStatic();
		}
	}

	initDynamic() {
		// Backup the original
		this.originalCfg = Object.assign({}, this.btnCfg);
		// We can't process...yet. But we're ready
		this.isReady = Promise.resolve();
		return this.isReady;
	}

	initStatic() {
		// Set the icons/text
		this.pages = [];
		if (!this.btnCfg.icon) {
			this.isReady = sharp({create: {width: this.deckMgr.deck.ICON_SIZE, height: this.deckMgr.deck.ICON_SIZE, channels: 3, background: 'black'}});
			this.isReady = this.deckMgr.addTextToImage(this.isReady, this.btnCfg.text, this.btnCfg.textSettings);
			this.isReady = this.isReady.removeAlpha()
				.raw()
				.toBuffer()
				.then((buffer) => {
					this.pages.push({buffer, delay: 0});
					return this.pages;
				});
		} else {
			let icon = this.btnCfg.icon;
			if (icon.startsWith('data:image')) {
				// It's a URI. Translate to buffer.
				icon = Buffer.from(icon.substr(icon.indexOf(',')+1), 'base64');
			}
			this.isReady = sharp(icon).metadata().then((metadata) => {
				let delays = metadata.delay;
				if (!delays) delays = [0];
				return Promise.each(delays, (delay, i) => {
					let prom = sharp(icon, { page: i }).flatten();
					if (this.btnCfg.text) {
						prom = this.deckMgr.addTextToImage(prom, this.btnCfg.text, this.btnCfg.textSettings);
					} else {
						prom = prom.resize(this.deckMgr.deck.ICON_SIZE, this.deckMgr.deck.ICON_SIZE);
					}
					return prom.removeAlpha()
						.raw()
						.toBuffer()
						.then((buffer) => {
							this.pages.push({ buffer, delay });
						});
				}).then(() => {
					return this.pages;
				});
			}).catch((err) => {
				console.error(err);
				console.error('Failed on icon', this.btnCfg.icon);
				throw err;
			});
		}
		return this.isReady;
	}

	get isSticky() {
		return this.btnCfg.isSticky;
	}

	processGif(btnIdx, gifPages, i) {
		this.deckMgr.deck.fillKeyBuffer(btnIdx, gifPages[i].buffer);
		this.timeout = setTimeout(() => {
			i = (i + 1) % gifPages.length;
			this.processGif(btnIdx, gifPages, i);
		}, gifPages[i].delay);
	}

	start() {
		this.stopped = false;
		// If we're dynamic, kick that off.
		if (this.btnCfg.dynamic) {
			setTimeout(() => {
				this.runDynamicCommand();
			}, 0);
		} else {
			this.render();
		}
	}

	stop() {
		this.stopped = true;
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		if (this.btnCfg.dynamic) {
			if (this.btnCfg.dynamic.persistent) {
				if (this.dynamicProc) {
					this.dynamicProc.kill();
					this.dynamicProc = null;
				}
			} else {
				clearTimeout(this.dynamicTimer);
				this.dynamicTimer = null;
			}
		}
	}

	render() {
		if (this.pages.length === 1) {
			this.deckMgr.deck.fillKeyBuffer(this.btnCfg.keyIndex, this.pages[0].buffer);
		} else {
			this.processGif(this.btnCfg.keyIndex, this.pages, 0);
		}
	}

	runDynamicCommand() {
		this.dynamicProc = spawn(this.btnCfg.dynamic.command, {shell: true});
		this.dynamicProc.stdout.on('data', (data) => {
			try {
				let incoming = JSON.parse(data.toString());
				// If we have new text or a new image, we need to reinit. Also if it's first time.
				let regen = (incoming.text && incoming.text !== this.btnCfg.text) || (incoming.icon && incoming.icon !== this.btnCfg.icon);
				// FIXME -- Validate input
				this.btnCfg = Object.assign({}, this.originalCfg, incoming);
				if (!this.stopped) {
					if (regen || this.pages.length === 0) {
						this.initStatic();
					} 
					this.isReady.then(() => {
						this.render();
					});
					
					// If we're on timer, we need to cycle. Otherwise we wait for more info.
					if (!this.btnCfg.dynamic.persistent) {
						this.dynamicTimer = setTimeout(() => {
							this.runDynamicCommand();
						}, this.btnCfg.dynamic.interval);
					}
				}
			} catch (err) {
				console.error(err);    
			}
		});
	}

	activate() {
		if (Object.prototype.hasOwnProperty.call(this.btnCfg, 'changeBrightness')) {
			this.deckMgr.setBrightness(this.btnCfg.changeBrightness);
		}
		if (Object.prototype.hasOwnProperty.call(this.btnCfg, 'sendkey')) {
			// Extract the keys plus meta.
			/*
			let str = this.btnCfg.sendkey;
			let key = null;
			let meta = null;
			if (str[str.length - 1] === '+') {
				key = '+';
				str = str.substr(0, str.length - 2);
				meta = str.split('+');
			} else {
				meta = str.split('+');
				key = meta.pop();
			}
			robot.keyTap(key, meta);
			*/
			xdo.sendkey(this.btnCfg.sendkey);
		}
		if (Object.prototype.hasOwnProperty.call(this.btnCfg, 'sendtext')) {
			//robot.typeString(this.btnCfg.sendtext);
			xdo.sendtext(this.btnCfg.sendtext);
		}
		if (Object.prototype.hasOwnProperty.call(this.btnCfg, 'command')) {
			spawn(this.btnCfg.command, { shell: true });
		}
		if (Object.prototype.hasOwnProperty.call(this.btnCfg, 'changePage')) {
			this.deckMgr.changePage(this.btnCfg.changePage);
		}
		if (Object.prototype.hasOwnProperty.call(this.btnCfg, 'startScreensaver')) {
			this.deckMgr.startScreensaver();
		}
	}
};