const {createCanvas } = require('canvas');
const ButtonController = require('./buttonController.js');
const ScreensaverController = require('./screensaverControl.js');

module.exports = class DeckManager {
    constructor(deck, buttons, config){
        this.deck = deck;
        this.config = config;
        this.buttons = buttons;

        const canvas = createCanvas(deck.ICON_SIZE, deck.ICON_SIZE / 5);
        const ctx = canvas.getContext('2d');
        ctx.font = '12pt Arial'
        ctx.textAlign = 'center'
        ctx.fillStyle = 'white'
        this.ctx = ctx;
        this.canvas = canvas;

        this.smallerSize = Math.floor(deck.ICON_SIZE/5 * 4);
        this.extend = deck.ICON_SIZE - this.smallerSize;
        this.extendSide = Math.floor(this.extend/2);
        this.extendFix = this.extend % 2;

        if ( config.screensaver ) {
            this.screensaver = new ScreensaverController(this, config.screensaver);
            this.screensaver.init();
        }

        if ( config.sticky ) {
            config.sticky.forEach((btnConfig)=>{
                buttons[btnConfig.keyIndex] = new ButtonController(this, Object.assign({},btnConfig,{isSticky:true}));
                buttons[btnConfig.keyIndex].init();
                buttons[btnConfig.keyIndex].isReady.then(()=>{
                    buttons[btnConfig.keyIndex].start();
                })
            });
        }

        this.pages = {};
        if ( config.pages ) {
            config.pages.forEach((page)=>{
                this.pages[page.page_name] = new Array(buttons.length);
                page.buttons.forEach((btnConfig)=>{
                    this.pages[page.page_name][btnConfig.keyIndex] = new ButtonController(this, Object.assign({},btnConfig));
                    this.pages[page.page_name][btnConfig.keyIndex].init();
                })
            })
        }
    }

    startScreensaver(){
        this.buttons.forEach((btn)=>{
            if ( btn ) btn.stop();
        });
        this.deck.clearAllKeys();
        if ( this.config.screensaver.brightness ) {
            this.deck.setBrightness(this.config.screensaver.brightness);
        }
        this.screensaver.start();
    }

    stopScreensaver(){
        this.screensaver.stop();
        this.deck.clearAllKeys();
        this.deck.setBrightness( this.config.brightness || 90 );
        this.buttons.forEach((btn)=>{
            if ( btn ) btn.start();
        });
    }

    changePage(pageName){
        this.buttons.forEach((btn,i)=>{
            if ( btn && !btn.isSticky ) {
                btn.stop();
                this.deck.clearKey(i);
                this.buttons[i] = null;
            }
        });
        if ( this.pages[pageName] ) {
            this.pages[pageName].forEach((btn,i)=>{
                if ( !this.buttons[i] ) {
                    // Don't override sticky
                    this.buttons[i] = btn;
                    btn.isReady.then(()=>{
                        btn.start();
                    });
                }
            });
        }
    }

    addTextToImage(sharpInstance, text, ctxOverides){
        this.ctx.clearRect(0, 0, this.deck.ICON_SIZE, this.deck.ICON_SIZE / 5);
        this.ctx.fillText(text, this.deck.ICON_SIZE/2, 12);
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
}