import sharp  from "sharp";
import Bluebird  from 'bluebird';
import { spawn }  from 'child_process';
import DeckManager from "./deckManager";
import {  GifPage, InternalButtonConfig, OverrideButtonConfig } from "./types";

export default class ButtonController {
	public isReady!: Promise<unknown>;

	private readonly deckMgr: DeckManager;
	private btnCfg: InternalButtonConfig;
	private pages: GifPage[];
	private stopped: boolean;
	private originalCfg?: InternalButtonConfig;
	private timeout?: ReturnType<typeof setTimeout>;
	private dynamicTimer?: ReturnType<typeof setTimeout>;
	private dynamicProc?: ReturnType<typeof spawn>;

	constructor(deckMgr: DeckManager, btnCfg: InternalButtonConfig) {
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
			let tSharp = sharp({ create: { width: this.deckMgr.ICON_SIZE, height: this.deckMgr.ICON_SIZE, channels: 3, background: 'black' } });
			tSharp = this.deckMgr.addTextToImage(tSharp, this.btnCfg.text || "", this.btnCfg.textSettings);
			this.isReady = tSharp.removeAlpha()
				.raw()
				.toBuffer()
				.then((buffer) => {
					this.pages.push({ buffer, delay: 0 });
					return this.pages;
				});
		} else {
			let icon: Buffer | string = this.btnCfg.icon;
			if (icon.startsWith('data:image')) {
				// It's a URI. Translate to buffer.
				icon = Buffer.from(icon.substring(0, icon.indexOf(',') + 1), 'base64');
			}
			this.isReady = sharp(icon).metadata().then((metadata) => {
				let delays = metadata.delay;
				if (!delays) delays = [0];
				return Bluebird.each(delays, (delay, i) => {
					let prom = sharp(icon, { page: i }).flatten();
					if (this.btnCfg.text) {
						prom = this.deckMgr.addTextToImage(prom, this.btnCfg.text, this.btnCfg.textSettings);
					} else {
						prom = prom.resize(this.deckMgr.ICON_SIZE, this.deckMgr.ICON_SIZE);
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

	processGif(btnIdx: number, gifPages: GifPage[], i: number) {
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
			this.timeout = undefined;
		}
		if (this.btnCfg.dynamic) {
			if (this.btnCfg.dynamic.persistent) {
				if (this.dynamicProc) {
					this.dynamicProc.kill();
					this.dynamicProc = undefined;
				}
			} else {
				clearTimeout(this.dynamicTimer);
				this.dynamicTimer = undefined;
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
		this.dynamicProc = spawn(this.btnCfg.dynamic!.command, { shell: true });
		this.dynamicProc.stdout!.on('data', (data) => {
			try {
				const incoming = OverrideButtonConfig.parse(JSON.parse(data.toString()));
				// If we have new text or a new image, we need to reinit. Also if it's first time.
				const regen = (incoming.text && incoming.text !== this.btnCfg.text) || (incoming.icon && incoming.icon !== this.btnCfg.icon);
				this.btnCfg = Object.assign({}, this.originalCfg, incoming);
				if (!this.stopped) {
					if (regen || this.pages.length === 0) {
						this.initStatic();
					}
					this.isReady.then(() => {
						this.render();
					});

					// If we're on timer, we need to cycle. Otherwise we wait for more info.
					if (!this.btnCfg.dynamic?.persistent) {
						this.dynamicTimer = setTimeout(() => {
							this.runDynamicCommand();
						}, this.btnCfg.dynamic!.interval);
					}
				}
			} catch (err) {
				console.error(err);
			}
		});
	}

	activate() {
		if ('changeBrightness' in this.btnCfg) {
			this.deckMgr.setBrightness(this.btnCfg.changeBrightness!);
		}
		if ('command' in this.btnCfg) {
			spawn(this.btnCfg.command!, { shell: true });
		}
		if ('changePage' in this.btnCfg) {
			this.deckMgr.changePage(this.btnCfg.changePage!);
		}
		if ('startScreensaver' in this.btnCfg) {
			this.deckMgr.startScreensaver();
		}
	}
};