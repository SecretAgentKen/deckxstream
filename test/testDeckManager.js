const rewire = require('rewire');
const events = require('events');
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const sc = require('sinon-chai');
chai.use(sc);

// Use require because rewire breaks sinon timers if first
const deckManager = require('../lib/deckManager');

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NYlV/1HwAF7QKTgvPu3QAAAABJRU5ErkJggg==";

describe('Deck Manager', function() {
	let deck, buttons;
	beforeEach(function() {
		deck = {clearAllKeys: sinon.fake(), clearKey: sinon.fake(), ICON_SIZE: 32, KEY_COLUMNS: 2, KEY_ROWS: 2, fillPanel: sinon.fake(), setBrightness: sinon.fake()};
		buttons = new Array(6).fill(0).map(() => {
			return {stop: sinon.spy(), start: sinon.spy(), activate: sinon.spy()};
		});
		// Set one to null
		buttons[2] = null;
	});
	afterEach(function() {
		sinon.restore();
	});

	describe('Constructor', function() {
		it ('should throw an error for a bad deck', function() {
			var bad = function() {
				return new deckManager(null, [], {}); 
			};
			expect(bad).to.throw('elgato');        
		});
		it ('should throw an error for a bad buttons array', function() {
			var bad = function() {
				return new deckManager({}, null, {}); 
			};
			expect(bad).to.throw('array');        
		});
		it ('should throw an error for a bad config', function() {
			var bad = function() {
				return new deckManager({}, [null], null); 
			};
			expect(bad).to.throw('Config');        
		});
	});

	describe('Standard buttons', function() {
		it('should handle standard buttons', function() {
			let dm = new deckManager(deck, buttons, {});
			dm.buttonPressed(0);
			dm.buttonPressed(2);
			expect(buttons[2]).to.be.null;
			expect(buttons[0].activate).to.be.calledOnce;
		});
	});

	describe('Screensaver', function() {
		let dm, clock;
		beforeEach(function() {
			clock = sinon.useFakeTimers();
			dm = new deckManager(deck, buttons, {screensaver: {animation: require('path').join(__dirname, '../test_resources/blink.gif'), brightness: 10, timeoutMinutes: 1}});
			return dm.screensaver.isReady;
		});
		afterEach(function() {
			dm.stopScreensaver();
			clock.restore();
			sinon.restore();
		});
		it('should stop all buttons when screensaver started', function() {
			dm.startScreensaver();
			buttons.forEach((b) => {
				if (b) expect(b.stop).to.be.calledOnce;
			});
		});
		it('should trigger a start after a timeout', async function() {
			expect(dm.ssActive).to.be.false;
			await clock.tickAsync(61 * 1000);
			expect(dm.ssActive).to.be.true;
		});
		it('should start all buttons when screensaver stopped', function() {
			dm.stopScreensaver();
			buttons.forEach((b) => {
				if (b) expect(b.start).to.be.calledOnce;
			});
		});
		it('should set brightness when screensaver starts', function() {
			dm.startScreensaver();
			expect(deck.setBrightness).to.be.calledWith(10);
		});
		it('should not touch brightness if not supplied', function() {
			delete dm.config.screensaver.brightness;
			dm.startScreensaver();
			expect(deck.setBrightness).to.not.be.called;
		});
		it('should restore brightness when screensaver ends', function() {
			dm.storedBrightness = 45;
			dm.stopScreensaver();
			expect(deck.setBrightness).to.be.calledWith(45);
		});
		it('should stop a screensaver on button press', function() {
			dm.startScreensaver();
			expect(dm.ssActive).to.be.true;
			dm.buttonPressed(0);
			expect(dm.ssActive).to.be.false;
		});
		it('should stop a screensaver and activate on a second press', function() {
			dm.startScreensaver();
			expect(dm.ssActive).to.be.true;
			dm.buttonPressed(0);
			expect(dm.ssActive).to.be.false;
			dm.buttonPressed(0);
			expect(buttons[0].activate).to.be.calledOnce;
		});
		it('should not start the screensaver twice', async function(){
			dm.screensaver = {start: sinon.fake(), stop: sinon.fake()};
			buttons[0] = {start: sinon.fake(), stop: sinon.fake(), activate: function(){ dm.startScreensaver() }};
			dm.buttonPressed(0);
			await clock.tickAsync(61 * 1000);
			expect(dm.screensaver.start).to.be.calledOnce;
		});
	});

	describe('Sticky buttons', function() {
		let dm;
		beforeEach(function() {
			dm = new deckManager(deck, buttons, {sticky: [{keyIndex: 0, icon: PIXEL}]});
		});

		it('should start sticky buttons on startup', function() {
			let spy = sinon.spy(buttons[0], 'start');
			return buttons[0].isReady.then(() => {
				expect(buttons[0].isSticky);
				expect(buttons[0].stopped).to.be.false;
				expect(spy).to.be.calledOnce;
			});
		});
		it('should preserve a sticky button between page changes', function() {
			let spy = sinon.spy(buttons[0], 'start');
			dm.changePage('not_there');
			return buttons[0].isReady.then(() => {
				expect(buttons[0].isSticky);
				expect(buttons[0].stopped).to.be.false;
				expect(spy).to.be.calledOnce;
				expect(buttons[0].start).to.be.eql(spy);
			});
		});
	});

	describe('Pages', function() {
		let dm;
		// eslint-disable-next-line
		beforeEach(function() {
			dm = new deckManager(deck, buttons, {pages: [{
				pageName: "testPage",
				buttons: [{keyIndex: 0, icon: PIXEL}]
			}]});
		});

		it('should load a button on the proper page', function() {
			expect(buttons[0].render).to.be.undefined;
			dm.changePage('testPage');
			expect(buttons[0].render).to.not.be.undefined;
			dm.changePage('default');
			expect(buttons[0]).to.be.null;
		});

		it('should preserve sticky buttons', function() {
			dm = new deckManager(deck, buttons, {
				sticky: [{keyIndex: 0, icon: PIXEL, command: 'none'}],
				pages: [{
					pageName: "testPage",
					buttons: [{keyIndex: 0, icon: PIXEL}],
				}]
			});
			expect(buttons[0].btnCfg.command).to.eql('none');
			dm.changePage('testPage');
			expect(buttons[0].btnCfg.command).to.eql('none');
		});
	});

	describe('Dynamic page', function() {
		let dm, spawn, revert, so, deckManager;
		// Do rewire
		before(function() {
			deckManager = rewire('../lib/deckManager');
		});
		beforeEach(function() {
			so = {
				stdout: new events.EventEmitter()
			};
			spawn = sinon.stub().returns(so);
			revert = deckManager.__set__('spawn', spawn);
			dm = new deckManager(deck, buttons, {
				sticky: [
					{keyIndex: 1, icon: PIXEL}
				],
				pages: [
					{
						pageName: 'testPage',
						dynamicPage: 'testing'
					}
				]
			});
		});
		afterEach(function() {
			revert();
		});

		it('should call the command specified on page load', function() {
			expect(spawn).to.not.be.called;
			dm.changePage('testPage');
			expect(spawn).to.be.calledOnce;
		});
		it('should load a page based on command output', function() {
			dm.changePage('testPage');
			buttons.forEach((b) => {
				if (b) {
					expect(b.btnCfg.keyIndex).to.eql(1);
				} else {
					expect(b).to.be.null;
				}
			});
			so.stdout.emit('data', JSON.stringify({
				buttons: [
					{
						keyIndex: 1,
						icon: PIXEL
					},
					{
						keyIndex: 3,
						icon: PIXEL
					}
				]
			}));
			buttons.forEach((b, i) => {
				if (i === 1 || i === 3) {
					expect(b).to.not.be.null;
				} else {
					expect(b).to.be.null;
				}
			});
		});
		it('should survive bad JSON', function() {
			let con = sinon.stub(console, 'error');
			dm.changePage('testPage');
			buttons.forEach((b) => {
				if (b) {
					expect(b.btnCfg.keyIndex).to.eql(1);
				} else {
					expect(b).to.be.null;
				}
			});
			expect(con).to.not.be.called;
			so.stdout.emit('data', 'garbage');
			buttons.forEach((b) => {
				if (b) {
					expect(b.btnCfg.keyIndex).to.eql(1);
				} else {
					expect(b).to.be.null;
				}
			});
			expect(con).to.be.calledOnce;
		});
	});

	describe('setBrightness', function() {
		let dm;
		beforeEach(function() {
			dm = new deckManager(deck, buttons, {brightness: 15});
		});

		it('should store the value to allow restoration', function() {
			dm.setBrightness(50);
			expect(dm.storedBrightness).to.eql(50);
			dm.setBrightness(5);
			expect(dm.storedBrightness).to.eql(5);
		});

		it('should set brightness on the deck', function() {
			expect(deck.setBrightness).to.not.be.called;
			dm.setBrightness(5);
			expect(deck.setBrightness).to.be.calledOnce;
		});
	});
});