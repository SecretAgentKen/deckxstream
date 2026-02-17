#!/usr/bin/env node

import { program } from 'commander'
import path from 'node:path'
import fs from 'node:fs'
import * as z from 'zod'

import { version } from '../package.json'

import {
  openStreamDeck,
  listStreamDecks,
  StreamDeckDeviceInfo,
} from '@elgato-stream-deck/node'
import { DeckXstreamConfig } from './types'
import DeckManager from './deckManager'
import ButtonController from './buttonController'

//const DeckManager = require('./lib/deckManager');

start()

async function start() {
  let config: DeckXstreamConfig
  let devInfo: StreamDeckDeviceInfo
  // If you press a button on the deck and then start, you'll get an initial phantom press. Prevent that at startup.
  let ignoreInput = true

  program
    .version(version)
    .option(
      '-c, --config <file>',
      'Configuration file to use.',
      path.join(process.env['HOME']!, '.deckxstream.json'),
    )
    .option('-l, --list', 'Show all detected Stream Decks and exit')
    .option(
      '-i, --init [device]',
      'Output an initial JSON file for the specified device if supplied',
    )
    .option(
      '-k, --keys [device]',
      'Outputs the keyIndex values to each button on the specified Stream Deck (or first found) and exits',
    )

  program.parse(process.argv)

  const options = program.opts()

  const devices = await listStreamDecks()

  if (devices.length === 0)
    exitError(
      'No Steam Decks found! Have you followed the instructions for elgato-stream-deck?',
    )

  if (options.list) {
    console.log(devices)
    process.exit(0)
  }

  if (options.init || options.keys) {
    devInfo = getDevice(devices, options.init || options.keys)
  } else if (options.config) {
    if (!fs.existsSync(options.config))
      exitError(`Specified config ${options.config} does not exist!`)
    const result = DeckXstreamConfig.safeParse(
      (await import(options.config, { with: { type: 'json' } })).default,
    )
    if (result.success) config = result.data
    else {
      console.error('Invalid configuration')
      console.error(z.prettifyError(result.error))
      console.error('\nDetails:\n', result.error)
      process.exit(1)
    }
    devInfo = getDevice(devices, config.device)
  }

  const streamDeck = await openStreamDeck(devInfo!.path)

  const buttons = Array.from({
    length: streamDeck.CONTROLS.filter((ctl) => ctl.type === 'button').length,
  })

  if (options.keys || options.init) {
    config = {
      deckxstreamConfigVersion: 2,
      brightness: 90,
      device: devInfo!.serialNumber,
      pages: [
        {
          pageName: 'default',
          buttons: buttons.fill(undefined).map((v, i) => {
            return { keyIndex: i, text: i.toString() }
          }),
        },
      ],
    }
  }

  if (options.init) {
    console.log(JSON.stringify(config!, null, 2))
    process.exit(0)
  }

  if (options.keys) {
    setTimeout(process.exit, 2000)
  }

  const deckMgr = new DeckManager(
    streamDeck,
    buttons as ButtonController[],
    config!,
  )

  streamDeck.clearPanel()
  deckMgr.setBrightness(config!.brightness || 90)

  deckMgr.changePage('default')

  streamDeck.on('down', (btn) => {
    if (ignoreInput) return

    deckMgr.buttonPressed(btn.index)
  })

  // Now that we're listening, allow input.
  setTimeout(() => (ignoreInput = false), 200)
}

function getDevice(
  devices: StreamDeckDeviceInfo[],
  serialPathOrModel?: string,
) {
  const result = devices.find((dev) => {
    return (
      serialPathOrModel &&
      (dev.serialNumber === serialPathOrModel ||
        dev.path === serialPathOrModel ||
        dev.model === serialPathOrModel)
    )
  })
  if (result) return result
  return devices[0]
}

function exitError(err: unknown) {
  console.error(err)
  process.exit(1)
}
