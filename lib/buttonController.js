const sharp = require("sharp");
const Promise = require('bluebird');
const { spawn } = require('child_process');
const robot = require("robotjs");

module.exports = class ButtonController {
    constructor(deckMgr, btnCfg) {
        this.deckMgr = deckMgr;
        this.btnCfg = btnCfg;

        this.pages = [];
        this.stopped = true;
    }

    init() {
        if ( this.btnCfg.dynamic ) {
            return this.initDynamic();
        } else {
            return this.initStatic();
        }
    }

    initDynamic(){
        // Backup the original
        this.originalCfg = Object.assign({}, this.btnCfg);
        // We can't process...yet. But we're ready
        this.isReady = Promise.resolve();
        return this.isReady;
    }

    initStatic(){
        // Set the icons/text
        this.pages = [];
        if (!this.btnCfg.icon) {
            this.isReady = sharp({create:{width: this.deckMgr.deck.ICON_SIZE, height: this.deckMgr.deck.ICON_SIZE, channels: 3, background:'black'}});
            this.isReady = this.deckMgr.addTextToImage(this.isReady, this.btnCfg.text);
            this.isReady = this.isReady.removeAlpha()
                .raw()
                .toBuffer()
                .then((buffer)=>{
                    this.pages.push({buffer, delay: 0});
                    return this.pages;
                });
        } else {
            let icon = this.btnCfg.icon;
            if ( icon.startsWith('data:image') ){
                // It's a URI. Translate to buffer.
                icon = Buffer.from(icon.substr(icon.indexOf(',')+1), 'base64');
            }
            this.isReady = sharp(icon).metadata().then((metadata) => {
                let delays = metadata.delay;
                if (!delays) delays = [0];
                return Promise.each(delays, (delay, i) => {
                    let prom = sharp(icon, { page: i }).flatten();
                    if (this.btnCfg.text) {
                        prom = this.deckMgr.addTextToImage(prom, this.btnCfg.text);
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
                })
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
        this.deckMgr.deck.fillImage(btnIdx, gifPages[i].buffer);
        this.timeout = setTimeout(() => {
            i = (i + 1) % gifPages.length;
            this.processGif(btnIdx, gifPages, i);
        }, gifPages[i].delay);
    }

    start() {
        this.stopped = false;
        // If we're dynamic, kick that off.
        if ( this.btnCfg.dynamic ) {
            setTimeout(()=>{
                this.runDynamicCommand();
            },0);
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
        if ( this.dynamic ){
            clearTimeout(this.dynamicTimer);
            this.dynamicTimer = null;
        }
    }

    render(){
        if (this.pages.length === 1) {
            this.deckMgr.deck.fillImage(this.btnCfg.keyIndex, this.pages[0].buffer);
        } else {
            this.processGif(this.btnCfg.keyIndex, this.pages, 0);
        }
    }

    runDynamicCommand(){
        let ex = spawn(this.btnCfg.dynamic, {shell: true});
        ex.stdout.on('data', (data)=>{
            try {
                let incoming = JSON.parse(data.toString());
                // If we have new text or a new image, we need to reinit. Also if it's first time.
                let regen = (incoming.text && incoming.text !== this.btnCfg.text) || (incoming.icon && incoming.icon !== this.btnCfg.icon);
                this.btnCfg = Object.assign({}, this.originalCfg, incoming);
                // FIXME - Optimize not redoing graphics if unecessary
                if ( !this.stopped ) {
                    if ( regen || this.pages.length === 0 ) {
                        this.initStatic()
                    } 
                    this.isReady.then(()=>{
                        this.render();
                    })
                    
                    this.dynamicTimer = setTimeout(()=>{
                        this.runDynamicCommand();
                    }, this.btnCfg.dynamicInterval);
                }
            } catch(err){
                console.error(err);    
            }
        })
    }

    activate() {
        if (this.btnCfg.hasOwnProperty('change_brightness')) {
            this.deckMgr.deck.setBrightness(this.btnCfg.change_brightness);
        }
        if (this.btnCfg.hasOwnProperty('sendkey')) {
            // Extract the keys plus meta.
            let str = this.btnCfg.sendkey;
            let key = null;
            let meta = null;
            if (str[str.length - 1] === '+') {
                key = '+';
                str = str.substr(0, str.length - 2);
                meta = str.split('+')
            } else {
                meta = str.split('+')
                key = meta.pop();
            }
            robot.keyTap(key, meta);
        }
        if (this.btnCfg.hasOwnProperty('sendtext')) {
            robot.typeString(this.btnCfg.sendtext);
        }
        if (this.btnCfg.hasOwnProperty('command')) {
            spawn(this.btnCfg.command, { shell: true });
        }
        if (this.btnCfg.hasOwnProperty('change_page')) {
            this.deckMgr.changePage(this.btnCfg.change_page);
        }
    }
}