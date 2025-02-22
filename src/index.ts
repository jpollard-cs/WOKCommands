import { Client, Collection, ColorResolvable, Guild, GuildEmoji } from 'discord.js'
import { EventEmitter } from 'events'

import FeatureHandler from './FeatureHandler'
import mongo from './persistence/mongo/connection'
import MessageHandler from './message-handler'
import SlashCommands from './SlashCommands'
import { ICategorySetting, Options } from './types'
import Events from './enums/Events'
import CommandHandler from './CommandHandler'
import { IGuildSettingsRepository } from './persistence/IGuildSettingsRepository'
import { ICooldownRepository } from './persistence/ICooldownRepository'
import { GuildSettingsAggregate } from './domain/GuildSettingsAggregate'
import { MongoCooldownRepository } from './persistence/mongo/MongoCooldownRepository'
import { MongoGuildSettingsRepository } from './persistence/mongo/MongoGuildSettingsRepository'
import { GuildPrefix } from './domain/GuildPrefix'
import { enumFromName } from './enums/utils'
import { DbConnectionStatus } from './enums/DbConnectionStatus'

export default class WOKCommands extends EventEmitter {
  private _client: Client
  private _defaultPrefix = '!'
  private _commandsDir = 'commands'
  private _featuresDir = ''
  private _displayName = ''
  private _guildSettings = new Collection<string, GuildSettingsAggregate>()
  private _categories: Map<String, String | GuildEmoji> = new Map() // <Category Name, Emoji Icon>
  private _hiddenCategories: string[] = []
  private _color: ColorResolvable | null = null
  private _commandHandler: CommandHandler | null = null
  private _featureHandler: FeatureHandler | null = null
  private _tagPeople = true
  private _showWarns = true
  private _delErrMsgCooldown = -1
  private _ignoreBots = true
  private _botOwner: string[] = []
  private _testServers: string[] = []
  private _defaultLanguage = 'english'
  private _ephemeral = true
  private _debug = false
  private _messageHandler: MessageHandler | null = null
  private _slashCommand: SlashCommands | null = null
  private _isDbConnected?: () => boolean
  private _getDbConnectionStatus?: () => DbConnectionStatus
  private _guildSettingsRepository?: IGuildSettingsRepository
  private _cooldownRepository?: ICooldownRepository

  constructor(client: Client, options?: Options) {
    super()

    this._client = client

    this.setUp(client, options)
  }

  private async setUp(client: Client, options?: Options) {
    if (!client) {
      throw new Error('No Discord JS Client provided as first argument!')
    }

    let {
      commandsDir = '',
      commandDir = '',
      featuresDir = '',
      featureDir = '',
      messagesPath,
      showWarns = true,
      delErrMsgCooldown = -1,
      defaultLanguage = 'english',
      ignoreBots = true,
      testServers,
      botOwners,
      disabledDefaultCommands = [],
      typeScript = false,
      ephemeral = true,
      debug = false
    } = options || {}

    let useDb = false;
    if (options?.dbConnectionStrategy === 'MONGOOSE' && options?.mongoUri) {
      const { mongoUri, dbOptions } = options;
      const connection = await mongo(mongoUri, this, dbOptions)

      this._isDbConnected = () => {
        return !!(connection && connection.readyState === 1)
      }

      this._getDbConnectionStatus = () => {
        const results: {
          [name: number]: string
        } = {
          0: 'DISCONNECTED',
          1: 'CONNECTED',
          2: 'CONNECTING',
          3: 'DISCONNECTING',
        }

        return enumFromName(results[connection.readyState] || 'UNKNOWN', DbConnectionStatus);
      }

      this._guildSettingsRepository = new MongoGuildSettingsRepository();
      this._cooldownRepository = new MongoCooldownRepository();
      useDb = true;
    } else if (options?.dbConnectionStrategy === 'GENERIC') {
      this._isDbConnected = options.isDbConnected
      this._getDbConnectionStatus = options.getDbConnectionStatus
      this._guildSettingsRepository = options.guildSettingsRepository
      this._cooldownRepository = options.cooldownRepository
      useDb = true;
    } else {
      if (showWarns) {
        console.warn(
          'WOKCommands > No DB connection info provided. Some features might not work! See this for more details:\nhttps://docs.wornoffkeys.com/databases'
        )
      }

      this.emit(Events.DATABASE_CONNECTED, DbConnectionStatus.NO_DATABASE)
    }

    if (useDb) {
      const connectionStatus = this.dbConnectionStatus
      this.emit(Events.DATABASE_CONNECTED, connectionStatus)

      if (connectionStatus !== DbConnectionStatus.CONNECTED) {
        throw new Error('WOKCommands > Database not connected!')
      }

      const guildSettings = await this.guildSettingsRepository.findAll()
      this._guildSettings = guildSettings.reduce((agg, settings) => {
        agg.set(settings.guildId, settings);
        return agg;
      }, new Collection<string, GuildSettingsAggregate>())
    }

    this._commandsDir = commandsDir || commandDir || this._commandsDir
    this._featuresDir = featuresDir || featureDir || this._featuresDir
    this._ephemeral = ephemeral
    this._debug = debug

    if (
      this._commandsDir &&
      !(this._commandsDir.includes('/') || this._commandsDir.includes('\\'))
    ) {
      throw new Error(
        "WOKCommands > The 'commands' directory must be an absolute path. This can be done by using the 'path' module. More info: https://docs.wornoffkeys.com/setup-and-options-object"
      )
    }

    if (
      this._featuresDir &&
      !(this._featuresDir.includes('/') || this._featuresDir.includes('\\'))
    ) {
      throw new Error(
        "WOKCommands > The 'features' directory must be an absolute path. This can be done by using the 'path' module. More info: https://docs.wornoffkeys.com/setup-and-options-object"
      )
    }

    if (testServers) {
      if (typeof testServers === 'string') {
        testServers = [testServers]
      }
      this._testServers = testServers
    }

    if (botOwners) {
      if (typeof botOwners === 'string') {
        botOwners = [botOwners]
      }
      this._botOwner = botOwners
    }

    this._showWarns = showWarns
    this._delErrMsgCooldown = delErrMsgCooldown
    this._defaultLanguage = defaultLanguage.toLowerCase()
    this._ignoreBots = ignoreBots

    if (typeof disabledDefaultCommands === 'string') {
      disabledDefaultCommands = [disabledDefaultCommands]
    }

    this._commandHandler = new CommandHandler(
      this,
      client,
      this._commandsDir,
      disabledDefaultCommands,
      typeScript
    )
    this._slashCommand = new SlashCommands(this, true, typeScript)
    this._messageHandler = new MessageHandler(this, messagesPath || '')

    this.setCategorySettings([
      {
        name: 'Configuration',
        emoji: '⚙',
      },
      {
        name: 'Help',
        emoji: '❓',
      },
    ])

    this._featureHandler = new FeatureHandler(
      client,
      this,
      this._featuresDir,
      typeScript
    )

    console.log('WOKCommands > Your bot is now running.')
  }

  public isDBConnected(): boolean {
    return !!(this._isDbConnected && this._isDbConnected())
  }

  public get dbConnectionStatus(): DbConnectionStatus {
    if (!this._getDbConnectionStatus) {
      return DbConnectionStatus.UNKNOWN
    }
    return this._getDbConnectionStatus()
  }

  public get guildSettingsRepository(): IGuildSettingsRepository {
    if (!this.isDBConnected()) {
      throw new Error('DB not connected!')
    }

    if (!this._guildSettingsRepository) {
      throw new Error('_guildSettingsRepository not defined!')
    }

    return this._guildSettingsRepository
  }

  public get cooldownRepository(): ICooldownRepository {
    if (!this.isDBConnected()) {
      throw new Error('DB not connected!')
    }

    if (!this._cooldownRepository) {
      throw new Error('_cooldownRepository not defined!')
    }

    return this._cooldownRepository
  }

  public get guildSettings(): Collection<string, GuildSettingsAggregate> {
    return this._guildSettings
  }

  public setMongoPath(mongoPath: string | undefined): WOKCommands {
    console.warn(
      'WOKCommands > .setMongoPath() no longer works as expected. Please pass in your mongo URI as a "mongoUri" property using the options object. For more information: https://docs.wornoffkeys.com/databases/mongodb'
    )
    return this
  }

  public get client(): Client {
    return this._client
  }

  public get displayName(): string {
    return this._displayName
  }

  public setDisplayName(displayName: string): WOKCommands {
    this._displayName = displayName
    return this
  }

  public get defaultPrefix(): string {
    return this._defaultPrefix
  }

  public setDefaultPrefix(defaultPrefix: string): WOKCommands {
    this._defaultPrefix = defaultPrefix
    return this
  }

  public getPrefix(guild: Guild | null): string {
    if (guild) {
      return this.guildSettings.get(guild.id)?.prefix.value || this._defaultPrefix
    }
    return this._defaultPrefix;
  }

  /**
   * gets guild settings if they exist
   * otherwise it creates them and stores them in the local cache
   * @param guildId 
   * @returns 
   */
  public async getOrCreateGuildSettings(guildId: string): Promise<GuildSettingsAggregate> {
    let guildSettings = this.guildSettings.get(guildId)
    if (!guildSettings) {
      guildSettings = await this.guildSettingsRepository.findOne({ guildId })
      guildSettings =  guildSettings || new GuildSettingsAggregate({ guildId })
      this.setGuildSettings(guildId, guildSettings)
    }
    return guildSettings
  }

  public setGuildSettings(guildId: string, guildSettings: GuildSettingsAggregate) {
    this.guildSettings.set(guildId, guildSettings)
  }

  public async setPrefix(guild: Guild | null, prefix: string): Promise<void> {
    // TODO: are there any legitimate reasons for this to be null here? DM?
    if (guild) {
      const guildSettings = await this.getOrCreateGuildSettings(guild.id)
      guildSettings.setPrefix({ prefix: new GuildPrefix({ value: prefix }) })
      // TODO: can we safely assume a guild settings object should exist in memory?
      // probably not the same for cooldowns
      const updated = await this.guildSettingsRepository.save(guildSettings)
      this.guildSettings.set(guild.id, updated)
    }
  }

  public get categories(): Map<String, String | GuildEmoji> {
    return this._categories
  }

  public get hiddenCategories(): string[] {
    return this._hiddenCategories
  }

  public get color(): ColorResolvable | null {
    return this._color
  }

  public setColor(color: ColorResolvable | null): WOKCommands {
    this._color = color
    return this
  }

  public getEmoji(category: string): string {
    const emoji = this._categories.get(category) || ''
    if (typeof emoji === 'object') {
      // @ts-ignore
      return `<:${emoji.name}:${emoji.id}>`
    }

    return emoji
  }

  public getCategory(emoji: string | null): string {
    let result = ''

    this._categories.forEach((value, key) => {
      // == is intended here
      if (emoji == value) {
        // @ts-ignore
        result = key
        return false
      }
    })

    return result
  }

  public setCategorySettings(category: ICategorySetting[]): WOKCommands {
    for (let { emoji, name, hidden, customEmoji } of category) {
      if (emoji.startsWith('<:') && emoji.endsWith('>')) {
        customEmoji = true
        emoji = emoji.split(':')[2]
        emoji = emoji.substring(0, emoji.length - 1)
      }

      let targetEmoji: string | GuildEmoji | undefined = emoji

      if (customEmoji) {
        targetEmoji = this._client.emojis.cache.get(emoji)
      }

      if (this.isEmojiUsed(targetEmoji)) {
        console.warn(
          `WOKCommands > The emoji "${targetEmoji}" for category "${name}" is already used.`
        )
      }

      this._categories.set(name, targetEmoji || this.categories.get(name) || '')

      if (hidden) {
        this._hiddenCategories.push(name)
      }
    }

    return this
  }

  private isEmojiUsed(emoji: string | GuildEmoji | undefined): boolean {
    if (!emoji) {
      return false
    }

    let isUsed = false

    this._categories.forEach((value) => {
      if (value === emoji) {
        isUsed = true
      }
    })

    return isUsed
  }

  public get commandHandler(): CommandHandler {
    return this._commandHandler!
  }

  public setTagPeople(tagPeople: boolean): WOKCommands {
    this._tagPeople = tagPeople
    return this
  }

  public get tagPeople(): boolean {
    return this._tagPeople
  }

  public get showWarns(): boolean {
    return this._showWarns
  }

  public get delErrMsgCooldown(): number {
    return this._delErrMsgCooldown
  }

  public get ignoreBots(): boolean {
    return this._ignoreBots
  }

  public get botOwner(): string[] {
    return this._botOwner
  }

  public setBotOwner(botOwner: string | string[]): WOKCommands {
    console.log(
      'WOKCommands > setBotOwner() is deprecated. Please specify your bot owners in the object constructor instead. See https://docs.wornoffkeys.com/setup-and-options-object'
    )

    if (typeof botOwner === 'string') {
      botOwner = [botOwner]
    }
    this._botOwner = botOwner
    return this
  }

  public get testServers(): string[] {
    return this._testServers
  }

  public get defaultLanguage(): string {
    return this._defaultLanguage
  }

  public setDefaultLanguage(defaultLanguage: string): WOKCommands {
    this._defaultLanguage = defaultLanguage
    return this
  }

  public get ephemeral(): boolean {
    return this._ephemeral
  }

  public get debug(): boolean {
    return this._debug
  }

  public get messageHandler(): MessageHandler {
    return this._messageHandler!
  }

  public get slashCommands(): SlashCommands {
    return this._slashCommand!
  }
}

module.exports = WOKCommands
