import * as z from 'zod';

const ObsConfig = z.strictObject({
    name: z.string().min(1),
    url: z.string().min(1)
});

const ObsCommand = z.strictObject({
    name: z.string().min(1).optional(),
    command: z.string(),
    data: z.any().optional()
});

const DynamicButtonConfig = z.xor([
    z.strictObject({
        command: z.string().min(1),
        persistent: z.literal(true)
    }),
    z.strictObject({
        command: z.string().min(1),
        persistent: z.literal(false).optional(),
        interval: z.int().min(0)
    })
]);

export const OverrideButtonConfig = z.strictObject({
    icon: z.string().optional(),
    text: z.string().optional(),
    textSettings: z.looseObject({}).optional(),
    changePage: z.string().optional(),
    changeBrightness: z.int().min(0).max(100).optional(),
    command: z.string().min(1).optional(),
    obsCommands: z.array(ObsCommand).optional(),
    startScreensaver: z.boolean().optional(),
});

export type OverrideButtonConfig = z.infer<typeof OverrideButtonConfig>

export const ButtonConfig = OverrideButtonConfig.extend({
    keyIndex: z.int().min(0),
    dynamic: DynamicButtonConfig.optional()
});

export type ButtonConfig = z.infer<typeof ButtonConfig>

export type InternalButtonConfig = ButtonConfig & {isSticky?: boolean}

export const DynamicButtonResponse = z.strictObject({
    buttons: z.array(ButtonConfig)
});

export type DynamicButtonResponse = z.infer<typeof DynamicButtonResponse>

const ScreensaverConfig = z.strictObject({
    animation: z.string().min(1),
    brightness: z.int().min(0).max(100).optional(),
    timeoutMinutes: z.int().min(1)
});

export type ScreensaverConfig = z.infer<typeof ScreensaverConfig>

const PageConfig = z.xor([
    z.strictObject({
        pageName: z.string().min(1),
        dynamicPage: z.string().min(1),
    }),
    z.strictObject({
        pageName: z.string().min(1),
        buttons: z.array(ButtonConfig)
    })
]);

export const DeckXstreamConfig = z.strictObject({
    deckxstreamConfigVersion: z.literal(2),
    brightness: z.int().min(0).max(100).optional(),
    device: z.string().optional(),
    obsConfig: z.array(ObsConfig).optional(),
    screensaver: ScreensaverConfig.optional(),
    sticky: z.array(ButtonConfig).optional(),
    pages: z.array(PageConfig).optional()
});

export type DeckXstreamConfig = z.infer<typeof DeckXstreamConfig> 

export type GifPage = {
	buffer: Buffer,
	delay: number
}