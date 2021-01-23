const sharp = require("sharp");
const Promise = require('bluebird');

module.exports = class ScreensaverController {
	constructor(deckMgr, ssCfg) {
		this.deckMgr = deckMgr;
		this.ssCfg = ssCfg;

		this.pages = [];
	}

	init () {
		// Set the icons
		let anim = this.ssCfg.animation;
		if (anim.startsWith('data:image')) {
			// It's a URI. Translate to buffer.
			anim = Buffer.from(anim.substr(anim.indexOf(',')+1), 'base64');
		}
		this.isReady = sharp(anim).metadata().then((metadata) => {
			let delays = metadata.delay;
			if (!delays) delays = [0];
			return Promise.each(delays, (delay, i) => {
				return sharp(anim, {page: i})
					.flatten()
					.resize(this.deckMgr.deck.ICON_SIZE * this.deckMgr.deck.KEY_COLUMNS, this.deckMgr.deck.ICON_SIZE * this.deckMgr.deck.KEY_ROWS)
					.removeAlpha()
					.raw()
					.toBuffer()
					.then((buffer) => {
						this.pages.push({buffer, delay});
					});
			}).then(() => {
				return this.pages;
			});
		}).catch((err) => {
			console.error(err);
			console.error('Failed on icon', this.ssCfg.animation);
			throw err;
		});
		return this.isReady;
	}

	processGif(gifPages, i) {
		this.deckMgr.deck.fillPanel(gifPages[i].buffer);
		this.timeout = setTimeout(() => {
			i = (i+1) % gifPages.length;
			this.processGif(gifPages, i);
		}, gifPages[i].delay);
	}

	start() {
		if (this.pages.length === 1) {
			this.deckMgr.deck.fillPanel(this.pages[0].buffer);
		} else {
			this.processGif(this.pages, 0);
		}
	}

	stop() {
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
	}
};