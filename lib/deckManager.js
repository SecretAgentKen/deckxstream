const {createCanvas } = require('canvas');
const ButtonController = require('./buttonController.js');
const ScreensaverController = require('./screensaverControl.js');
const { spawn } = require('child_process');

module.exports = class DeckManager {
	constructor(deck, buttons, config) {
		if (!deck) throw new TypeError('Invalid deck reference. Use a reference from elgato-stream-deck openStreamDeck');
		if (!buttons || !buttons.length) throw new TypeError('Invalid buttons reference. Must be a sized array');
		if (!config) throw new TypeError('Configuration not supplied');

		this.deck = deck;
		this.config = config;
		this.buttons = buttons;
		this.storedBrightness = 90;
		this.ssTimer = null;
		this.ssActive = false;

		const canvas = createCanvas(deck.ICON_SIZE, deck.ICON_SIZE / 5);
		const ctx = canvas.getContext('2d');
		ctx.font = 'bold 14px sans-serif';
		ctx.textAlign = 'center';
		ctx.fillStyle = 'white';
		this.ctx = ctx;
		this.canvas = canvas;

		this.smallerSize = Math.floor(deck.ICON_SIZE/5 * 4);
		this.extend = deck.ICON_SIZE - this.smallerSize;
		this.extendSide = Math.floor(this.extend/2);
		this.extendFix = this.extend % 2;

		if (config.screensaver) {
			this.screensaver = new ScreensaverController(this, config.screensaver);
			this.screensaver.init();
			this.ssTimer = this.checkScreensaver();
		}

		if (config.sticky) {
			config.sticky.forEach((btnConfig) => {
				buttons[btnConfig.keyIndex] = new ButtonController(this, Object.assign({}, btnConfig, {isSticky: true}));
				buttons[btnConfig.keyIndex].init();
				buttons[btnConfig.keyIndex].isReady.then(() => {
					buttons[btnConfig.keyIndex].start();
				});
			});
		}

		this.pages = {};
		if (config.pages) {
			config.pages.forEach((page) => {
				this.pages[page.pageName] = new Array(deck.NUM_KEYS);
				this.pages[page.pageName].dynamicPage = page.dynamicPage;
				if (!page.dynamicPage) {
					page.buttons.forEach((btnConfig) => {
						this.pages[page.pageName][btnConfig.keyIndex] = new ButtonController(this, Object.assign({}, btnConfig));
						this.pages[page.pageName][btnConfig.keyIndex].init();
					});
				}
			});
		}
	}

	startScreensaver() {
		if ( !this.ssActive ) {
			this.ssActive = true;
			if (this.ssTimer) {
				clearTimeout(this.ssTimer);
				this.ssTimer = null;
			}
			this.buttons.forEach((btn) => {
				if (btn) btn.stop();
			});
			this.deck.clearAllKeys();
			if (this.config.screensaver.brightness) {
				this.deck.setBrightness(this.config.screensaver.brightness);
			}
			this.screensaver.start();
		}
	}

	stopScreensaver() {
		this.ssActive = false;
		// Force clear the timer. It will be restarted by the button press.
		if (this.ssTimer) {
			clearTimeout(this.ssTimer);
			this.ssTimer = null;
		}
		this.screensaver.stop();
		this.deck.clearAllKeys();
		this.deck.setBrightness(this.storedBrightness);
		this.buttons.forEach((btn) => {
			if (btn) btn.start();
		});
	}

	checkScreensaver() {
		return setTimeout(() => {
			this.ssTimer = null;
			this.startScreensaver();
		}, this.config.screensaver.timeoutMinutes * 60 * 1000);
	}

	buttonPressed(keyIndex) {
		if (this.ssActive) {
			this.stopScreensaver();
		} else {
			if (this.buttons[keyIndex]) {
				this.buttons[keyIndex].activate();
			}
		}
		if (this.ssTimer) {
			clearTimeout(this.ssTimer);
		}
		// ssTimer will be null if it was started previously
		if (this.config.screensaver) {
			this.ssTimer = this.checkScreensaver();
		}
	}

	changePage(pageName) {
		this.buttons.forEach((btn, i) => {
			if (btn && !btn.isSticky) {
				btn.stop();
				this.deck.clearKey(i);
				this.buttons[i] = null;
			}
		});
		if (this.pages[pageName]) {
			// Is dynamic?
			if (this.pages[pageName].dynamicPage) {
				let dynamicProc = spawn(this.pages[pageName].dynamicPage, {shell: true});
				dynamicProc.stdout.on('data', (data) => {
					try {
						let incoming = JSON.parse(data.toString());
						incoming.buttons.forEach((btnCfg) => {
							if (!this.buttons[btnCfg.keyIndex]) {
								// Don't override sticky
								this.buttons[btnCfg.keyIndex] = new ButtonController(this, Object.assign({}, btnCfg));
								this.buttons[btnCfg.keyIndex].init().then(() => {
									this.buttons[btnCfg.keyIndex].start();
								});
							}
						});
					} catch (err) {
						console.error(err);    
					}
				});
			} else {
				this.pages[pageName].forEach((btn, i) => {
					if (!this.buttons[i]) {
						// Don't override sticky
						this.buttons[i] = btn;
						btn.isReady.then(() => {
							btn.start();
						});
					}
				});
			}
		}
	}

	setBrightness(val) {
		this.storedBrightness = val;
		this.deck.setBrightness(val);
	}

	addTextToImage(sharpInstance, text, textSettings) {
		this.ctx.clearRect(0, 0, this.deck.ICON_SIZE, this.deck.ICON_SIZE / 5);

		// Set context
		let previousSettings = this.updateCtx(this.ctx, textSettings);
		this.ctx.fillText(text, this.deck.ICON_SIZE/2, 12, this.deck.ICON_SIZE);
		this.updateCtx(this.ctx, previousSettings);

		return sharpInstance
			.resize(this.smallerSize, this.smallerSize)
			.extend({
				top: 0,
				bottom: this.extend,
				left: this.extendSide,
				right: this.extendSide+this.extendFix
			})
			.composite([
				{
					input: this.canvas.toBuffer("image/png"), 
					gravity: 'south'
				}
			]);
	}

	updateCtx(ctx, settings) {
		if (!settings) return null;
		let result = {};
		Object.keys(settings).forEach((key) => {
			result[key] = ctx[key];
			ctx[key] = settings[key];
		});
		return result;
	}
};