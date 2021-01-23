const Promise = require('bluebird');
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const sc = require('sinon-chai');
chai.use(sc);

const ssControl = require('../lib/screensaverControl');
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NYlV/1HwAF7QKTgvPu3QAAAABJRU5ErkJggg==";

describe('Screen Saver', function() {
	let deck; //, buttons;
	beforeEach(function() {
		deck = {clearAllKeys: sinon.fake(), clearKey: sinon.fake(), ICON_SIZE: 32, KEY_COLUMNS: 2, KEY_ROWS: 2, fillPanel: sinon.fake(), setBrightness: sinon.fake()};
		//buttons = new Array(6).fill(0).map(()=>{return {stop: sinon.spy(), start: sinon.spy()};});
	});
	afterEach(function() {
		sinon.restore();
	});
    
	it('should not allow a bad screensaver', function() {
		sinon.stub(console, 'error');
		let ss = new ssControl({deck}, {animation: 'bad path'});
		expect(ss.init()).to.throw;
	});

	it('should support a single frame', function() {
		let ss = new ssControl({deck}, {animation: PIXEL});
		ss.init();
		expect(deck.fillPanel).to.not.be.calledOnce;
		return ss.isReady.then(() => {
			expect(ss.pages).to.have.lengthOf(1);
			ss.start();
			expect(deck.fillPanel).to.be.calledOnce;
		});
	});
    
	describe('GIF support', function() {
		let ss;
		beforeEach(function() {
			ss = new ssControl({deck}, {animation: require('path').join(__dirname, '../test_resources/blink.gif')});
			ss.init();
		});
		afterEach(function() {
			ss.stop();
		});

		it('should load all of the frames', function() {
			return ss.isReady.then(() => {
				expect(ss.pages).to.have.lengthOf(2);
			});
		});
        
		it('should process each frame', function() {
			let spy = sinon.spy(ss, 'processGif');
			return ss.isReady.then(function() {
				expect(ss.pages).to.have.lengthOf(2);
				ss.pages[0].delay = 0;
				ss.start();
				expect(spy).to.be.calledOnce;
				expect(spy).to.be.calledWith(sinon.match.any, 0);
				// Sinon fake timers refuse to work
				return Promise.delay(0);
			}).then(function() {
				expect(spy).to.be.calledTwice;
				expect(spy).to.be.calledWith(sinon.match.any, 1);
			});
		});
	});
});