import { Canvas, CanvasRenderingContext2D, createCanvas } from 'canvas'
import ButtonController from './buttonController'
import ScreensaverController from './screensaverControl'
import { spawn } from 'node:child_process'
import {
  StreamDeck,
  StreamDeckButtonControlDefinitionLcdFeedback,
} from '@elgato-stream-deck/node'
import { DeckXstreamConfig, DynamicButtonResponse, ObsConfigEntry } from './types'
import { Sharp } from 'sharp'
import { OBSWebSocket } from 'obs-websocket-js'

type DeckPage = ButtonController[] & { dynamicPage?: string }

export default class DeckManager {
  public readonly ICON_SIZE: number
  public readonly KEY_COLUMNS: number
  public readonly KEY_ROWS: number
  public readonly deck: StreamDeck

  private config: DeckXstreamConfig
  private buttons: (ButtonController | undefined)[]
  private storedBrightness: number
  private ssTimer?: ReturnType<typeof setTimeout>
  private ssActive: boolean
  private ctx: CanvasRenderingContext2D
  private canvas: Canvas
  private smallerSize: number
  private extend: number
  private extendSide: number
  private extendFix: number
  private screensaver?: ScreensaverController
  private pages: Record<string, DeckPage>
  private obsEntries: ObsConfigEntry[]

  constructor(
    deck: StreamDeck,
    buttons: (ButtonController | undefined)[],
    config: DeckXstreamConfig,
  ) {
    if (!deck)
      throw new TypeError(
        'Invalid deck reference. Use a reference from elgato-stream-deck openStreamDeck',
      )
    if (!buttons || !buttons.length)
      throw new TypeError('Invalid buttons reference. Must be a sized array')
    if (!config) throw new TypeError('Configuration not supplied')

    this.deck = deck
    this.config = config
    this.buttons = buttons
    this.storedBrightness = 90
    this.ssTimer = undefined
    this.ssActive = false

    this.obsEntries = this.config.obsConfig?.map(entry => {
      return {...entry, socket: new OBSWebSocket()}
    }) || [{name: 'default', url: 'ws://127.0.0.1:4455', socket: new OBSWebSocket()}]

    this.obsEntries.forEach(async (entry)=>{
      try {
        await entry.socket.connect(entry.url)
      } catch (err) {
        console.error(err)
      }
    })

    this.ICON_SIZE = (
      deck.CONTROLS.filter(
        (ctl) => ctl.type === 'button',
      )[0] as StreamDeckButtonControlDefinitionLcdFeedback
    ).pixelSize.width
    this.KEY_COLUMNS =
      deck.CONTROLS.filter((ctl) => ctl.type === 'button').reduce(
        (acc, btn) => Math.max(acc, btn.column),
        0,
      ) + 1
    this.KEY_ROWS =
      deck.CONTROLS.filter((ctl) => ctl.type === 'button').reduce(
        (acc, btn) => Math.max(acc, btn.row),
        0,
      ) + 1

    const canvas = createCanvas(this.ICON_SIZE, this.ICON_SIZE / 5)
    const ctx = canvas.getContext('2d')
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'white'
    this.ctx = ctx
    this.canvas = canvas

    this.smallerSize = Math.floor((this.ICON_SIZE / 5) * 4)
    this.extend = this.ICON_SIZE - this.smallerSize
    this.extendSide = Math.floor(this.extend / 2)
    this.extendFix = this.extend % 2

    if (config.screensaver) {
      this.screensaver = new ScreensaverController(this, config.screensaver)
      this.screensaver.init()
      this.ssTimer = this.checkScreensaver()
    }

    if (config.sticky) {
      config.sticky.forEach((btnConfig) => {
        buttons[btnConfig.keyIndex] = new ButtonController(
          this,
          Object.assign({}, btnConfig, { isSticky: true }),
        )
        buttons[btnConfig.keyIndex]!.init()
        buttons[btnConfig.keyIndex]!.isReady.then(() => {
          buttons[btnConfig.keyIndex]?.start()
        })
      })
    }

    this.pages = {}
    if (config.pages) {
      config.pages.forEach((page) => {
        this.pages[page.pageName] = Array.from({ length: buttons.length })
        if ('dynamicPage' in page)
          this.pages[page.pageName].dynamicPage = page.dynamicPage
        else {
          page.buttons.forEach((btnConfig) => {
            this.pages[page.pageName][btnConfig.keyIndex] =
              new ButtonController(this, Object.assign({}, btnConfig))
            this.pages[page.pageName][btnConfig.keyIndex].init()
          })
        }
      })
    }
  }

  startScreensaver() {
    if (!this.ssActive) {
      this.ssActive = true
      if (this.ssTimer) {
        clearTimeout(this.ssTimer)
        this.ssTimer = undefined
      }
      this.buttons.forEach((btn) => {
        if (btn) btn.stop()
      })
      this.deck.clearPanel()
      if (this.config.screensaver?.brightness) {
        this.deck.setBrightness(this.config.screensaver.brightness)
      }
      this.screensaver?.start()
    }
  }

  stopScreensaver() {
    this.ssActive = false
    // Force clear the timer. It will be restarted by the button press.
    if (this.ssTimer) {
      clearTimeout(this.ssTimer)
      this.ssTimer = undefined
    }
    this.screensaver?.stop()
    this.deck.clearPanel()
    this.deck.setBrightness(this.storedBrightness)
    this.buttons.forEach((btn) => {
      if (btn) btn.start()
    })
  }

  checkScreensaver() {
    return setTimeout(
      () => {
        this.ssTimer = undefined
        this.startScreensaver()
      },
      (this.config.screensaver?.timeoutMinutes || 1) * 60 * 1000,
    )
  }

  buttonPressed(keyIndex: number) {
    if (this.ssActive) {
      this.stopScreensaver()
    } else {
      if (this.buttons[keyIndex]) {
        this.buttons[keyIndex].activate()
      }
    }
    if (this.ssTimer) {
      clearTimeout(this.ssTimer)
    }
    // ssTimer will be null if it was started previously
    if (this.config.screensaver) {
      this.ssTimer = this.checkScreensaver()
    }
  }

  changePage(pageName: string) {
    this.buttons.forEach((btn, i) => {
      if (btn && !btn.isSticky) {
        btn.stop()
        this.deck.clearKey(i)
        this.buttons[i] = undefined
      }
    })
    if (this.pages[pageName]) {
      // Is dynamic?
      if (this.pages[pageName].dynamicPage) {
        const dynamicProc = spawn(this.pages[pageName].dynamicPage, {
          shell: true,
        })
        dynamicProc.stdout.on('data', (data) => {
          try {
            const incoming = DynamicButtonResponse.parse(
              JSON.parse(data.toString()),
            )
            incoming.buttons.forEach((btnCfg) => {
              if (!this.buttons[btnCfg.keyIndex]) {
                // Don't override sticky
                this.buttons[btnCfg.keyIndex] = new ButtonController(
                  this,
                  Object.assign({}, btnCfg),
                )
                this.buttons[btnCfg.keyIndex]!.init().then(() => {
                  this.buttons[btnCfg.keyIndex]?.start()
                })
              }
            })
          } catch (err) {
            console.error(err)
          }
        })
      } else {
        this.pages[pageName].forEach((btn, i) => {
          if (!this.buttons[i]) {
            // Don't override sticky
            this.buttons[i] = btn
            if (btn)
              btn.isReady.then(() => {
                btn.start()
              })
          }
        })
      }
    }
  }

  setBrightness(val: number) {
    this.storedBrightness = val
    this.deck.setBrightness(val)
  }

  addTextToImage(
    sharpInstance: Sharp,
    text: string,
    textSettings?: Record<string, unknown>,
  ) {
    this.ctx.clearRect(0, 0, this.ICON_SIZE, this.ICON_SIZE / 5)

    // Set context
    const previousSettings = this.updateCtx(this.ctx, textSettings)
    this.ctx.fillText(text, this.ICON_SIZE / 2, 12, this.ICON_SIZE)
    this.updateCtx(this.ctx, previousSettings)

    return sharpInstance
      .resize(this.smallerSize, this.smallerSize)
      .extend({
        top: 0,
        bottom: this.extend,
        left: this.extendSide,
        right: this.extendSide + this.extendFix,
      })
      .composite([
        {
          input: this.canvas.toBuffer('image/png'),
          gravity: 'south',
        },
      ])
  }

  updateCtx(ctx: CanvasRenderingContext2D, settings?: Record<string, unknown>) {
    if (!settings) return undefined
    const result: Record<string, unknown> = {}
    Object.keys(settings).forEach((key: string) => {
      result[key] = (ctx as unknown as Record<string, unknown>)[key]
      ;(ctx as unknown as Record<string, unknown>)[key] = settings[key]
    })
    return result
  }

  getObsSocket(name?: string) {
    if ( name ) return this.obsEntries.find((entry) => entry.name === name)?.socket
    return this.obsEntries[0].socket
  }
}
