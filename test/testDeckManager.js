const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const sc = require('sinon-chai');
chai.use(sc);

const deckManager = require('../lib/deckManager');

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NYlV/1HwAF7QKTgvPu3QAAAABJRU5ErkJggg==";

describe('Deck Manager', function() {
	let deck, buttons;
	beforeEach(function() {
		deck = {clearAllKeys: sinon.fake(), clearKey: sinon.fake(), ICON_SIZE: 32, KEY_COLUMNS: 2, KEY_ROWS: 2, fillPanel: sinon.fake(), setBrightness: sinon.fake()};
		buttons = new Array(6).fill(0).map(()=>{return {stop: sinon.spy(), start: sinon.spy()};});
	});

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
		let dm;
		beforeEach(function() {
			buttons = new Array(6).fill(0).map(()=>{return {stop: sinon.spy(), start: sinon.spy()};});
			dm = new deckManager(deck, buttons, {screensaver:{animation: require('path').join(__dirname,'../test_resources/blink.gif'), brightness: 10}});
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
		it('should set brightness when screensaver starts', function(){
			return dm.screensaver.isReady.then(()=>{
				dm.startScreensaver();
				expect(deck.setBrightness).to.be.calledWith(10);
			});
		});
		it('should restore brightness when screensaver ends', function(){
			dm.storedBrightness = 45;
			dm.stopScreensaver();
			expect(deck.setBrightness).to.be.calledWith(45);
		});
	});

	describe('Sticky buttons',function(){
		let dm;
		beforeEach(function() {
			dm = new deckManager(deck, buttons, {sticky:[{keyIndex:0, icon: PIXEL}]});
		});
		afterEach(function() {
			sinon.restore();
		});
		it('should start sticky buttons on startup', function(){
			let spy = sinon.spy(buttons[0], 'start');
			return buttons[0].isReady.then(()=>{
				expect(buttons[0].isSticky);
				expect(buttons[0].stopped).to.be.false;
				expect(spy).to.be.calledOnce;
			});
		});
		it('should preserve a sticky button between page changes', function(){
			let spy = sinon.spy(buttons[0], 'start');
			dm.changePage('not_there');
			return buttons[0].isReady.then(()=>{
				expect(buttons[0].isSticky);
				expect(buttons[0].stopped).to.be.false;
				expect(spy).to.be.calledOnce;
				expect(buttons[0].start).to.be.eql(spy);
			});
		});
	});

	describe('Pages', function(){
		let dm;
		beforeEach(function() {
			dm = new deckManager(deck, buttons, {pages:[{
				pageName:"testPage",
				buttons:[{keyIndex:0, icon: PIXEL}]
			}]});
		});
		afterEach(function() {
			sinon.restore();
		});
		it('should load a button on the proper page', function(){
			expect(buttons[0].render).to.be.undefined;
			dm.changePage('testPage');
			expect(buttons[0].render).to.not.be.undefined;
			dm.changePage('default');
			expect(buttons[0]).to.be.null;
		});
	});

	describe('Dynamic page', function(){
		let dm, spawn;
		beforeEach(function() {
			dm = new deckManager(deck, buttons, {pages:[{
				pageName:'testPage',
				dynamicPage: 'testing'
			}]});
		});
		afterEach(function() {
			sinon.restore();
		});
		it('should call the command specified on page load', function(){
			spawn = sinon.fake();
			dm.spawn = spawn;
			spawn.stdout = {on: sinon.fake()};
			expect(spawn).to.not.be.called;
			dm.changePage('testPage');
			expect(spawn).to.be.calledOnce;
		});
	})
});