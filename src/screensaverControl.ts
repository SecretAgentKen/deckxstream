import sharp, { Sharp } from 'sharp'
import Bluebird from 'bluebird'
import DeckManager from './deckManager'
import { GifPage, ScreensaverConfig } from './types'

type TileEntry = {
  buffer: Promise<Buffer>
  top: number
  left: number
}

export default class ScreensaverController {
  private deckMgr: DeckManager
  private ssCfg: ScreensaverConfig
  private pages: GifPage[]
  private isReady?: Promise<GifPage[]>
  private timeout?: ReturnType<typeof setTimeout>

  constructor(deckMgr: DeckManager, ssCfg: ScreensaverConfig) {
    this.deckMgr = deckMgr
    this.ssCfg = ssCfg

    this.pages = []
  }

  init() {
    // Set the icons
    let anim: string | Buffer = this.ssCfg.animation
    if (anim.startsWith('data:image')) {
      // It's a URI. Translate to buffer.
      anim = Buffer.from(anim.substring(anim.indexOf(',') + 1), 'base64')
    }
    this.isReady = sharp(anim)
      .metadata()
      .then((metadata) => {
        let delays = metadata.delay
        if (!delays) delays = [0]
        return Bluebird.each(delays, (delay, i) => {
          return this.createTiled(sharp(anim, { page: i })).then((buffer) => {
            this.pages.push({ buffer, delay })
          })
        }).then(() => {
          return this.pages
        })
      })
      .catch((err) => {
        console.error(err)
        console.error('Failed on icon', this.ssCfg.animation)
        throw err
      })
    return this.isReady
  }

  createTiled(img: Sharp) {
    const base = img
      .flatten()
      .removeAlpha()
      .resize(
        this.deckMgr.ICON_SIZE * this.deckMgr.KEY_COLUMNS +
          this.deckMgr.KEY_SPACING_COLUMNS * (this.deckMgr.KEY_COLUMNS - 1),
        this.deckMgr.ICON_SIZE * this.deckMgr.KEY_ROWS +
          this.deckMgr.KEY_SPACING_ROWS * (this.deckMgr.KEY_ROWS - 1),
      )
      .raw()

    // Generate all of the tiles
    const buffers: TileEntry[] = []
    for (let r = 0; r < this.deckMgr.KEY_ROWS; r++) {
      for (let c = 0; c < this.deckMgr.KEY_COLUMNS; c++) {
        buffers.push({
          buffer: base
            .extract({
              left: c * this.deckMgr.ICON_SIZE + c * this.deckMgr.KEY_SPACING_COLUMNS,
              top: r * this.deckMgr.ICON_SIZE + r * this.deckMgr.KEY_SPACING_ROWS,
              width: this.deckMgr.ICON_SIZE,
              height: this.deckMgr.ICON_SIZE,
            })
            .toBuffer(),
          top: r * this.deckMgr.ICON_SIZE,
          left: c * this.deckMgr.ICON_SIZE,
        })
      }
    }

    // We now have Promises for all of the tiles.
    return Bluebird.all(buffers.map((e) => e.buffer)).then((buffs) => {
      // Now take all of the buffers and create a new image
      return sharp({
        create: {
          width: this.deckMgr.ICON_SIZE * this.deckMgr.KEY_COLUMNS,
          height: this.deckMgr.ICON_SIZE * this.deckMgr.KEY_ROWS,
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      })
        .composite(
          buffers.map((entry, i) => {
            return {
              input: buffs[i],
              top: entry.top,
              left: entry.left,
              raw: {
                width: this.deckMgr.ICON_SIZE,
                height: this.deckMgr.ICON_SIZE,
                channels: 3,
              },
            }
          }),
        )
        .flatten()
        .removeAlpha()
        .raw()
        .toBuffer()
    })
  }

  processGif(gifPages: GifPage[], i: number) {
    this.deckMgr.deck.fillPanelBuffer(gifPages[i].buffer)
    this.timeout = setTimeout(() => {
      i = (i + 1) % gifPages.length
      this.processGif(gifPages, i)
    }, gifPages[i].delay)
  }

  start() {
    if (this.pages.length === 1) {
      this.deckMgr.deck.fillPanelBuffer(this.pages[0].buffer)
    } else {
      this.processGif(this.pages, 0)
    }
  }

  stop() {
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = undefined
    }
  }
}
