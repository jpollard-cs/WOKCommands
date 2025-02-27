import { ICallbackObject, ICommand } from '../types'
import Events from '../enums/Events'

export = {
  description: 'Displays or sets the language for this Discord server',
  category: 'Configuration',

  aliases: ['lang'],
  permissions: ['ADMINISTRATOR'],

  maxArgs: 1,
  expectedArgs: '[language]',

  cooldown: '2s',

  slash: 'both',

  callback: async (options: ICallbackObject) => {
    const { channel, text, instance, interaction } = options

    const { guild } = channel
    if (!guild) {
      return
    }

    const { messageHandler } = instance

    if (!instance.isDBConnected()) {
      return instance.messageHandler.get(guild, 'NO_DATABASE_FOUND')
    }

    const lang = text.toLowerCase()

    if (!lang) {
      return instance.messageHandler.get(guild, 'CURRENT_LANGUAGE', {
        LANGUAGE: instance.messageHandler.getLanguage(guild),
      })
    }

    if (!messageHandler.languages().includes(lang)) {
      instance.emit(Events.LANGUAGE_NOT_SUPPORTED, guild, lang)

      return messageHandler.get(guild, 'LANGUAGE_NOT_SUPPORTED', {
        LANGUAGE: lang,
      })
    }

    await instance.messageHandler.setLanguage(guild, lang)

    return instance.messageHandler.get(guild, 'NEW_LANGUAGE', {
      LANGUAGE: lang,
    })
  },
} as ICommand
