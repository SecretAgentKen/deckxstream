const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const sc = require('sinon-chai');
chai.use(sc);

const deckManager = require('../lib/deckManager');

describe('Deck Manager', function() {
	describe('Constructor',function() {
		it ('should throw an error for a bad deck', function() {
			var bad = function(){ return new deckManager(null,[],{}); };
			expect(bad).to.throw('elgato');        
		});
		it ('should throw an error for a bad buttons array', function() {
			var bad = function(){ return new deckManager({}, null,{}); };
			expect(bad).to.throw('array');        
		});
		it ('should throw an error for a bad config', function() {
			var bad = function(){ return new deckManager({},[null],null); };
			expect(bad).to.throw('Config');        
		});
	});
	describe('Screensaver', function() {
		let dm, buttons, deck;
		beforeEach(function() {
			deck = {clearAllKeys: sinon.fake(), ICON_SIZE: 32, KEY_COLUMNS: 2, KEY_ROWS: 2, fillPanel: sinon.fake(), setBrightness: sinon.fake()};
			buttons = new Array(6).fill(0).map(()=>{return {stop: sinon.spy(), start: sinon.spy()};});
			dm = new deckManager(deck, buttons, {screensaver:{animation: require('path').join(__dirname,'../test_resources/blink.gif')}});
		});
		afterEach(function() {
			sinon.restore();
			dm.stopScreensaver();
		});
		it('should stop all buttons when screensaver started',function() {
			return dm.screensaver.isReady.then(()=>{
				dm.startScreensaver();
				buttons.forEach((b)=>{
					expect(b.stop).to.be.calledOnce;
				});
			});
		});
		it('should start all buttons when screensaver stopped', function(){
			dm.stopScreensaver();
			buttons.forEach((b)=>{
				expect(b.start).to.be.calledOnce;
			});
		});
		it('should restore brightness when screensaver ends', function(){
			dm.storedBrightness = 45;
			dm.stopScreensaver();
			expect(deck.setBrightness).to.be.calledWith(45);
		});
	});
});