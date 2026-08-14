const Promise = require('bluebird')
const chai = require('chai')
const expect = chai.expect
const sinon = require('sinon')
const sc = require('sinon-chai').default
chai.use(sc)

const ssControl = require('../test-build/screensaverControl').default
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2NYlV/1HwAF7QKTgvPu3QAAAABJRU5ErkJggg=='

describe('Screen Saver', function () {
  let deck, dm
  beforeEach(function () {
    deck = {
      clearPanel: sinon.fake(),
      clearKey: sinon.fake(),
      fillPanelBuffer: sinon.fake(),
      setBrightness: sinon.fake(),
    }
    dm = {
      deck,
      ICON_SIZE: 32,
      KEY_COLUMNS: 2,
      KEY_ROWS: 2,
      KEY_SPACING_COLUMNS: 25,
      KEY_SPACING_ROWS: 25,
    }
  })
  afterEach(function () {
    sinon.restore()
  })

  it('should not allow a bad screensaver', function () {
    sinon.stub(console, 'error')
    let ss = new ssControl(dm, { animation: 'bad path' })
    return ss.init().then(
      function () {
        throw new Error('Expected init to reject')
      },
      function () {
        // Expected rejection
      },
    )
  })

  it('should support a single frame', function () {
    let ss = new ssControl(dm, { animation: PIXEL })
    ss.init()
    expect(deck.fillPanelBuffer).to.not.be.calledOnce
    return ss.isReady.then(() => {
      expect(ss.pages).to.have.lengthOf(1)
      ss.start()
      expect(deck.fillPanelBuffer).to.be.calledOnce
    })
  })

  describe('GIF support', function () {
    let ss
    beforeEach(function () {
      ss = new ssControl(dm, {
        animation: require('path').join(__dirname, '../test_resources/blink.gif'),
      })
      ss.init()
    })
    afterEach(function () {
      ss.stop()
    })

    it('should load all of the frames', function () {
      return ss.isReady.then(() => {
        expect(ss.pages).to.have.lengthOf(2)
      })
    })

    it('should process each frame', function () {
      let spy = sinon.spy(ss, 'processGif')
      return ss.isReady
        .then(function () {
          expect(ss.pages).to.have.lengthOf(2)
          ss.pages[0].delay = 0
          ss.start()
          expect(spy).to.be.calledOnce
          expect(spy).to.be.calledWith(sinon.match.any, 0)
          // Sinon fake timers refuse to work
          return Promise.delay(0)
        })
        .then(function () {
          expect(spy).to.be.calledTwice
          expect(spy).to.be.calledWith(sinon.match.any, 1)
        })
    })
  })
})
