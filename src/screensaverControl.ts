import sharp from "sharp";
import Bluebird from 'bluebird';
import DeckManager from "./deckManager";
import { GifPage, ScreensaverConfig } from "./types";



export default class ScreensaverController {
	private deckMgr: DeckManager;
	private ssCfg: ScreensaverConfig;
	private pages: GifPage[];
	private isReady?: Promise<GifPage[]>;
	private timeout?: ReturnType<typeof setTimeout>;

	constructor(deckMgr: DeckManager, ssCfg: ScreensaverConfig) {
		this.deckMgr = deckMgr;
		this.ssCfg = ssCfg;

		this.pages = [];
	}

	init() {
		// Set the icons
		let anim: string | Buffer = this.ssCfg.animation;
		if (anim.startsWith('data:image')) {
			// It's a URI. Translate to buffer.
			anim = Buffer.from(anim.substring(0, anim.indexOf(',') + 1), 'base64');
		}
		this.isReady = sharp(anim).metadata().then((metadata) => {
			let delays = metadata.delay;
			if (!delays) delays = [0];
			return Bluebird.each(delays, (delay, i) => {
				return sharp(anim, { page: i })
					.flatten()
					.resize(this.deckMgr.ICON_SIZE * this.deckMgr.KEY_COLUMNS, this.deckMgr.ICON_SIZE * this.deckMgr.KEY_ROWS)
					.removeAlpha()
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
			console.error('Failed on icon', this.ssCfg.animation);
			throw err;
		});
		return this.isReady;
	}

	processGif(gifPages: GifPage[], i: number) {
		this.deckMgr.deck.fillPanelBuffer(gifPages[i].buffer);
		this.timeout = setTimeout(() => {
			i = (i + 1) % gifPages.length;
			this.processGif(gifPages, i);
		}, gifPages[i].delay);
	}

	start() {
		if (this.pages.length === 1) {
			this.deckMgr.deck.fillPanelBuffer(this.pages[0].buffer);
		} else {
			this.processGif(this.pages, 0);
		}
	}

	stop() {
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = undefined;
		}
	}
};