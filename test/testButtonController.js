const rewire = require('rewire');
const Promise = require('bluebird');
const events = require('events');
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const sc = require('sinon-chai');
const sharp = require('sharp');
chai.use(sc);

const buttonController = rewire('../lib/buttonController');
const deckManager = require('../lib/deckManager');

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NYlV/1HwAF7QKTgvPu3QAAAABJRU5ErkJggg==";
const PIXEL2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NI0i77DwAD+QID4vYuBwAAAABJRU5ErkJggg==";

describe('Buttons', function() {
	let deck;
	beforeEach(function() {
		deck = {clearAllKeys: sinon.fake(), clearKey: sinon.fake(), ICON_SIZE: 32, KEY_COLUMNS: 2, KEY_ROWS: 2, fillPanel: sinon.fake(), setBrightness: sinon.fake(), fillImage: sinon.fake()};
	});
	afterEach(function() {
		sinon.restore();
	});
    
	describe('Static buttons', function() {
		let bc;
		afterEach(function() {
			if (bc) bc.stop();
		});
		it('should create a basic button with text', async function() {
			this.timeout(15000); // Apparently github ci can fall behind
			let dm = new deckManager(deck, new Array(6).fill(), {});
			bc = new buttonController(dm, {keyIndex: 0, icon: PIXEL, text: ' '});
			let bc2 = new buttonController(dm, {keyIndex: 1, icon: PIXEL});
			let bc3 = new buttonController(dm, {keyIndex: 2, icon: PIXEL});
			await bc.init();
			await bc2.init();
			await bc3.init();
			expect(bc.pages).to.have.lengthOf(1);
			expect(bc2.pages[0].buffer).to.eql(bc3.pages[0].buffer);
			expect(bc.pages[0].buffer).to.not.eql(bc2.pages[0].buffer);
		});
		it('should allow changing context for text', async function() {
			let dm = new deckManager(deck, new Array(6).fill(), {});
			bc = new buttonController(dm, {keyIndex: 0, icon: PIXEL, text: 'A'});
			let bc2 = new buttonController(dm, {keyIndex: 1, icon: PIXEL, text: 'A', textSettings: {fillStyle: 'blue'}});
			await bc.init();
			await bc2.init();
			expect(bc.pages[0].buffer).to.not.eql(bc2.pages[0].buffer);
		});
		it('should error out on a bad icon', function() {
			sinon.stub(console, 'error');
			bc = new buttonController({deck}, {keyIndex: 0, icon: 'garbage'});
			expect(bc.init()).to.throw;
		});
		it('should allow a blank entry', async function() {
			let dm = new deckManager(deck, new Array(6).fill(), {});
			bc = new buttonController(dm, {keyIndex: 0});
			await bc.init();
			expect(bc.pages[0].buffer).to.be.ok;
		});
		it('should process each frame of a gif', async function() {
			bc = new buttonController({deck}, {keyIndex: 0, icon: require('path').join(__dirname, '../test_resources/blink.gif')});
			let spy = sinon.spy(bc, 'processGif');
			await bc.init();
			expect(bc.pages).to.have.lengthOf(2);
			bc.pages[0].delay = 0;
			bc.start();
			expect(spy).to.be.calledOnce;
			expect(spy).to.be.calledWith(0, sinon.match.any, 0);
			// Sinon fake timers refuse to work
			await Promise.delay(0);
			expect(spy).to.be.calledTwice;
			expect(spy).to.be.calledWith(0, sinon.match.any, 1);
		});
	});
	describe('Actions', function() {
		let bc, xdo, spawn, revertSpawn, revertXdo;
		beforeEach(function() {
			xdo = {
				sendkey: sinon.fake(),
				sendtext: sinon.fake()
			};
			spawn = sinon.stub();
			revertSpawn = buttonController.__set__('spawn', spawn);
			revertXdo = buttonController.__set__('xdo', xdo);
		});
		afterEach(function() {
			if (bc) bc.stop();
			revertXdo();
			revertSpawn();
		});
		it('should change brightness', async function() {
			let dm = new deckManager(deck, new Array(6).fill(), {});
			bc = new buttonController(dm, {keyIndex: 0, icon: PIXEL, changeBrightness: 20});
			bc.init();
			bc.activate();
			expect(deck.setBrightness).to.be.calledWith(20);
		});
		it('should send a hotkey', async function() {
			bc = new buttonController({deck}, {keyIndex: 0, icon: PIXEL, sendkey: 'Shift+A'});
			bc.init();
			bc.activate();
			expect(xdo.sendkey).to.be.calledWith('Shift+A');
		});
		it('should handle + as a key', async function() {
			bc = new buttonController({deck}, {keyIndex: 0, icon: PIXEL, sendkey: 'Shift++'});
			bc.init();
			bc.activate();
			expect(xdo.sendkey).to.be.calledWith('Shift++');
		});
		it('should send text', async function() {
			bc = new buttonController({deck}, {keyIndex: 0, icon: PIXEL, sendtext: 'Hello World'});
			bc.init();
			bc.activate();
			expect(xdo.sendtext).to.be.calledWith('Hello World');
		});
		it('should send a command', async function() {
			bc = new buttonController({deck}, {keyIndex: 0, icon: PIXEL, command: 'test'});
			bc.init();
			bc.activate();
			expect(spawn).to.be.calledWith('test');
		});
		it('should change pages', async function() {
			let dm = new deckManager(deck, new Array(6).fill(), {});
			bc = new buttonController(dm, {keyIndex: 0, icon: PIXEL, changePage: 'test'});
			bc.init();
			dm.buttons[0] = bc;
			bc.activate();
			expect(dm.buttons[0]).to.be.null;
		});
		it('should start the screensaver', async function() {
			let dm = new deckManager(deck, new Array(6).fill(), {});
			dm.startScreensaver = sinon.fake();
			bc = new buttonController(dm, {keyIndex: 0, icon: PIXEL, startScreensaver: true});
			bc.init();
			expect(dm.startScreensaver).to.not.be.called;
			bc.activate();
			expect(dm.startScreensaver).to.be.calledOnce;
		});
	});
	describe('Dynamic buttons', function() {
		let spawn, revert, so, bc;
		beforeEach(function() {
			so = {
				stdout: new events.EventEmitter(),
				kill: sinon.fake()
			};
			spawn = sinon.stub().returns(so);
			revert = buttonController.__set__('spawn', spawn);
		});
		afterEach(function() {
			if (bc) bc.stop();
			revert();
		});
        
		it('call the dynamic command on startup', async function() {
			bc = new buttonController({deck}, {keyIndex: 0, dynamic: {command: 'none', interval: 50}});
			bc.init();
			expect(spawn).to.not.be.called;
			bc.start();
			await Promise.delay(0);
			expect(spawn).to.be.calledOnce;
		});
		it('should work on an interval', async function() {
			bc = new buttonController({deck}, {keyIndex: 0, dynamic: {command: 'none', interval: 50}});
			bc.init();
			bc.start();
			await Promise.delay(0);
			expect(spawn).to.be.calledOnce;
			so.stdout.emit('data', JSON.stringify({icon: PIXEL}));
			await Promise.delay(60);
			expect(spawn).to.be.calledTwice;
		});
		it('should work peristently', async function() {
			bc = new buttonController({deck}, {keyIndex: 0, dynamic: {command: 'none', persistent: true}});
			bc.init();
			bc.start();
			await Promise.delay(0);
			expect(spawn).to.be.calledOnce;
			so.stdout.emit('data', JSON.stringify({icon: PIXEL}));
			await bc.isReady;
			let b1 = bc.pages[0].buffer;
			so.stdout.emit('data', JSON.stringify({icon: PIXEL2}));
			await bc.isReady;
			let b2 = bc.pages[0].buffer;
			expect(spawn).to.be.calledOnce;
			expect(b1).to.not.eql(b2);
			bc.stop();
			expect(so.kill).to.be.calledOnce;
		});
		it('should not rerender if the icon is the same or stopped', async function() {
			bc = new buttonController({deck}, {keyIndex: 0, dynamic: {command: 'none', persistent: true}});
			bc.init();
			bc.start();
			await Promise.delay(0);
			expect(spawn).to.be.calledOnce;
			so.stdout.emit('data', JSON.stringify({icon: PIXEL}));
			await bc.isReady;
			let b1 = bc.pages[0].buffer;
			so.stdout.emit('data', JSON.stringify({icon: PIXEL}));
			await bc.isReady;
			let b2 = bc.pages[0].buffer;
			expect(spawn).to.be.calledOnce;
			expect(b1).to.equal(b2);
			bc.stop();
			so.stdout.emit('data', JSON.stringify({icon: PIXEL}));
			let b3 = bc.pages[0].buffer;
			expect(b1).to.equal(b3);
		});
		it('should not rerender if the text is the same or stopped', async function() {
			bc = new buttonController({deck, addTextToImage: function() {
				return sharp({create: {width: 1, height: 1, channels: 3, background: 'black'}});
			}}, {keyIndex: 0, dynamic: {command: 'none', persistent: true}});
			bc.init();
			bc.start();
			await Promise.delay(0);
			expect(spawn).to.be.calledOnce;
			so.stdout.emit('data', JSON.stringify({icon: PIXEL}));
			await bc.isReady;
			let b1 = bc.pages[0].buffer;
			so.stdout.emit('data', JSON.stringify({text: 'test'}));
			await bc.isReady;
			let b2 = bc.pages[0].buffer;
			expect(spawn).to.be.calledOnce;
			expect(b1).to.not.equal(b2);
			bc.stop();
		});
		it('should survive a bad command', async function() {
			let errCheck = sinon.stub(console, 'error');
			bc = new buttonController({deck}, {keyIndex: 0, dynamic: {command: 'none', interval: 50}});
			bc.init();
			expect(spawn).to.not.be.called;
			bc.start();
			await Promise.delay(0);
			expect(spawn).to.be.calledOnce;
			so.stdout.emit('data', 'garbage');
			expect(errCheck).to.be.calledOnce;
		});
	});
});